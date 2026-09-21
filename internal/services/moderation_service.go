package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/models/dto"
	"bbs-go/internal/pkg/jev"
	"bbs-go/internal/pkg/params"
	"bbs-go/internal/repositories"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

var ModerationService = newModerationService()

func newModerationService() *moderationService {
	return &moderationService{}
}

type moderationService struct {
}

// ModerationDecision 表示经过 Jev 规则引擎求值后的决策结果
type ModerationDecision struct {
	SuggestedAction    string            `json:"suggestedAction"`    // "pass" | "review" | "reject"
	FinalAction        string            `json:"finalAction"`        // 最终采取动作
	RejectReasons      []string          `json:"rejectReasons"`      // 触发下架的原因列表
	ReviewReasons      []string          `json:"reviewReasons"`      // 触发待审的原因列表
	IsSpamProb         float64           `json:"isSpamProb"`         // 垃圾营销概率
	ToxicityScore      float64           `json:"toxicityScore"`      // 攻击辱骂得分
	ToxicityConfidence float64           `json:"toxicityConfidence"` // 置信度
	ChoiceResults      map[string]string `json:"choiceResults"`      // Choice 各维度的优胜选项
	RawResponse        string            `json:"rawResponse"`        // Jev 原始返回 JSON
}

// getClient 根据当前最新配置构建 Jev 客户端实例
func (s *moderationService) getClient(cfg dto.JevConfig) *jev.Client {
	timeout := time.Duration(cfg.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	return jev.NewClient(cfg.Endpoint, cfg.ApiKey, timeout)
}

// buildQuestions 依据 JevRuleConfig 组装待评估问题集
func (s *moderationService) buildQuestions(ruleCfg dto.JevRuleConfig) map[string]jev.Question {
	questions := make(map[string]jev.Question)

	// 1. Noul 连续概率问询
	for _, n := range ruleCfg.NoulQuestions {
		if n.Enabled && n.Key != "" {
			questions[n.Key] = jev.Question{
				Type:         jev.TypeNoul,
				Instructions: n.Instructions,
			}
		}
	}

	// 2. Score 阶梯打分问询
	for _, sc := range ruleCfg.ScoreQuestions {
		if sc.Enabled && sc.Key != "" {
			questions[sc.Key] = jev.Question{
				Type:         jev.TypeScore,
				Instructions: sc.Instructions,
				Criteria:     sc.Criteria,
			}
		}
	}

	// 3. Choice 离散多分类问询
	for _, ch := range ruleCfg.ChoiceQuestions {
		if ch.Enabled && ch.Key != "" {
			criteriaMap := make(map[string]any, len(ch.Criteria))
			for k, v := range ch.Criteria {
				criteriaMap[k] = v
			}
			questions[ch.Key] = jev.Question{
				Type:         jev.TypeChoice,
				Instructions: ch.Instructions,
				Criteria:     criteriaMap,
			}
		}
	}

	return questions
}

// evaluateContent 执行 Jev 评估请求并根据规则引擎多维度配置做出裁决
func (s *moderationService) evaluateContent(ctx context.Context, client *jev.Client, model string, title, content string, ruleCfg dto.JevRuleConfig) (*ModerationDecision, *jev.SystemOneResponse, error) {
	maxLen := ruleCfg.MaxContentLength
	if maxLen <= 0 {
		maxLen = 500
	}

	contentRune := []rune(content)
	if len(contentRune) > maxLen {
		contentRune = contentRune[:maxLen]
	}
	truncatedContent := string(contentRune)

	var state any
	if ruleCfg.IncludeTitle && title != "" {
		state = map[string]string{
			"title":   title,
			"content": truncatedContent,
		}
	} else {
		state = truncatedContent
	}

	questions := s.buildQuestions(ruleCfg)
	if len(questions) == 0 {
		// 若未启用任何问题，直接默认放行
		return &ModerationDecision{
			SuggestedAction: "pass",
			FinalAction:     "pass",
			ChoiceResults:   make(map[string]string),
		}, nil, nil
	}

	req := &jev.SystemOneRequest{
		Model:     model,
		State:     state,
		Questions: questions,
	}

	resp, err := client.Evaluate(ctx, req)
	if err != nil {
		return nil, nil, err
	}

	rawJSON, _ := json.Marshal(resp)
	decision := &ModerationDecision{
		SuggestedAction: "pass",
		FinalAction:     "pass",
		RejectReasons:   make([]string, 0),
		ReviewReasons:   make([]string, 0),
		ChoiceResults:   make(map[string]string),
		RawResponse:     string(rawJSON),
	}

	// 1. 评估 Noul 概率问题
	for _, n := range ruleCfg.NoulQuestions {
		if !n.Enabled || n.Key == "" {
			continue
		}
		ans, err := jev.ParseNoul(resp, n.Key)
		if err != nil {
			continue
		}
		if n.Key == "is_spam" {
			decision.IsSpamProb = ans.Noul
		}
		if n.RejectThreshold > 0 && ans.Noul >= n.RejectThreshold {
			decision.RejectReasons = append(decision.RejectReasons, fmt.Sprintf("Noul [%s](%s) 概率 %.2f >= 下架阈值 %.2f", n.Label, n.Key, ans.Noul, n.RejectThreshold))
		} else if n.ReviewThreshold > 0 && ans.Noul >= n.ReviewThreshold {
			decision.ReviewReasons = append(decision.ReviewReasons, fmt.Sprintf("Noul [%s](%s) 概率 %.2f >= 待审阈值 %.2f", n.Label, n.Key, ans.Noul, n.ReviewThreshold))
		}
	}

	// 2. 评估 Score 阶梯打分问题
	for _, sc := range ruleCfg.ScoreQuestions {
		if !sc.Enabled || sc.Key == "" {
			continue
		}
		ans, err := jev.ParseScore(resp, sc.Key)
		if err != nil {
			continue
		}
		if sc.Key == "toxicity" {
			decision.ToxicityScore = ans.Score
			decision.ToxicityConfidence = ans.Confidence
		}
		if sc.RejectThreshold > 0 && ans.Score >= sc.RejectThreshold {
			decision.RejectReasons = append(decision.RejectReasons, fmt.Sprintf("Score [%s](%s) 得分 %.2f >= 下架阈值 %.2f", sc.Label, sc.Key, ans.Score, sc.RejectThreshold))
		} else if sc.ReviewThreshold > 0 && ans.Score >= sc.ReviewThreshold {
			decision.ReviewReasons = append(decision.ReviewReasons, fmt.Sprintf("Score [%s](%s) 得分 %.2f >= 待审阈值 %.2f", sc.Label, sc.Key, ans.Score, sc.ReviewThreshold))
		}
	}

	// 3. 评估 Choice 离散归因分类问题
	for _, ch := range ruleCfg.ChoiceQuestions {
		if !ch.Enabled || ch.Key == "" {
			continue
		}
		ans, err := jev.ParseChoice(resp, ch.Key)
		if err != nil {
			continue
		}
		decision.ChoiceResults[ch.Key] = ans.Choice
		// 检查自动下架命中
		for _, opt := range ch.AutoRejectOptions {
			if ans.Choice == opt {
				decision.RejectReasons = append(decision.RejectReasons, fmt.Sprintf("Choice [%s](%s) 归因命中高危分类 [%s]", ch.Label, ch.Key, ans.Choice))
				break
			}
		}
		// 检查人工待审命中
		for _, opt := range ch.AutoReviewOptions {
			if ans.Choice == opt {
				decision.ReviewReasons = append(decision.ReviewReasons, fmt.Sprintf("Choice [%s](%s) 归因命中待审分类 [%s]", ch.Label, ch.Key, ans.Choice))
				break
			}
		}
	}

	// 综合裁决优先级：任意维度触发 Reject 则下架；否则若有触发 Review 则待审；否则通过
	if len(decision.RejectReasons) > 0 {
		decision.SuggestedAction = "reject"
		decision.FinalAction = "reject"
	} else if len(decision.ReviewReasons) > 0 {
		decision.SuggestedAction = "review"
		decision.FinalAction = "review"
	}

	return decision, resp, nil
}

// Simulate 提供给管理后台 Playground 的即时仿真评测接口
func (s *moderationService) Simulate(ctx context.Context, title, content string, customRuleCfg *dto.JevRuleConfig) (*ModerationDecision, *jev.SystemOneResponse, error) {
	cfg := SysConfigService.GetJevConfig()
	if !cfg.Enabled || cfg.ApiKey == "" {
		return nil, nil, errors.New("Jev 智能风控未启用或未配置 API Key")
	}

	ruleCfg := SysConfigService.GetJevRuleConfig()
	if customRuleCfg != nil {
		ruleCfg = *customRuleCfg
	}

	client := s.getClient(cfg)
	if client == nil {
		return nil, nil, errors.New("jev client not initialized")
	}

	return s.evaluateContent(ctx, client, cfg.Model, title, content, ruleCfg)
}

// AuditTopic 对话题（Topic）执行异步智能风控与垃圾过滤
func (s *moderationService) AuditTopic(ctx context.Context, topic *models.Topic) (*models.ModerationRecord, error) {
	if topic == nil {
		return nil, errors.New("topic is nil")
	}

	cfg := SysConfigService.GetJevConfig()
	if !cfg.Enabled || cfg.ApiKey == "" {
		return nil, nil
	}

	client := s.getClient(cfg)
	if client == nil {
		return nil, errors.New("jev client not initialized")
	}

	ruleCfg := SysConfigService.GetJevRuleConfig()
	decision, _, err := s.evaluateContent(ctx, client, cfg.Model, topic.Title, topic.Content, ruleCfg)
	if err != nil {
		slog.Warn("[JevModeration] 话题评估请求失败，降级跳过", slog.Int64("topicId", topic.Id), slog.Any("err", err))
		return nil, err
	}

	if decision.FinalAction == "reject" {
		slog.Warn("[JevModeration] 话题命中高危阈值，执行自动下架",
			slog.Int64("topicId", topic.Id),
			slog.Any("reasons", decision.RejectReasons),
		)
		_ = repositories.TopicRepository.UpdateColumn(sqls.DB(), topic.Id, "status", constants.StatusDeleted)
		UserService.IncrViolationCount(topic.UserId, fmt.Sprintf("Jev智能风控拦截话题 #%d: %s", topic.Id, strings.Join(decision.RejectReasons, "; ")))
	} else if decision.FinalAction == "review" {
		slog.Info("[JevModeration] 话题判定存疑，进入待审队列",
			slog.Int64("topicId", topic.Id),
			slog.Any("reasons", decision.ReviewReasons),
		)
		_ = repositories.TopicRepository.UpdateColumn(sqls.DB(), topic.Id, "status", constants.StatusReview)
		if ruleCfg.AutoCreateReport {
			s.createReviewReport(constants.EntityTopic, topic.Id, decision.ReviewReasons)
		}
	}

	now := dates.NowTimestamp()
	contentSnapshot := fmt.Sprintf("Title: %s\nContent: %s", topic.Title, topic.Content)
	if len([]rune(contentSnapshot)) > 500 {
		contentSnapshot = string([]rune(contentSnapshot)[:500])
	}

	record := &models.ModerationRecord{
		EntityType:         constants.EntityTopic,
		EntityId:           topic.Id,
		UserId:             topic.UserId,
		ContentSnapshot:    contentSnapshot,
		IsSpamProb:         decision.IsSpamProb,
		ToxicityScore:      decision.ToxicityScore,
		ToxicityConfidence: decision.ToxicityConfidence,
		SuggestedAction:    decision.SuggestedAction,
		FinalAction:        decision.FinalAction,
		RawResponse:        decision.RawResponse,
		CreateTime:         now,
		UpdateTime:         now,
	}

	if err := repositories.ModerationRecordRepository.Create(sqls.DB(), record); err != nil {
		slog.Error("[JevModeration] 保存留痕记录失败", slog.Any("err", err))
	}

	return record, nil
}

// AuditComment 对评论（Comment）执行异步智能风控
func (s *moderationService) AuditComment(ctx context.Context, comment *models.Comment) (*models.ModerationRecord, error) {
	if comment == nil {
		return nil, errors.New("comment is nil")
	}

	cfg := SysConfigService.GetJevConfig()
	if !cfg.Enabled || cfg.ApiKey == "" {
		return nil, nil
	}

	client := s.getClient(cfg)
	if client == nil {
		return nil, errors.New("jev client not initialized")
	}

	ruleCfg := SysConfigService.GetJevRuleConfig()
	decision, _, err := s.evaluateContent(ctx, client, cfg.Model, "", comment.Content, ruleCfg)
	if err != nil {
		slog.Warn("[JevModeration] 评论评估请求失败，降级跳过", slog.Int64("commentId", comment.Id), slog.Any("err", err))
		return nil, err
	}

	if decision.FinalAction == "reject" {
		slog.Warn("[JevModeration] 评论命中高危阈值，自动下架",
			slog.Int64("commentId", comment.Id),
			slog.Any("reasons", decision.RejectReasons),
		)
		_ = repositories.CommentRepository.UpdateColumn(sqls.DB(), comment.Id, "status", constants.StatusDeleted)
		UserService.IncrViolationCount(comment.UserId, fmt.Sprintf("Jev智能风控拦截评论 #%d: %s", comment.Id, strings.Join(decision.RejectReasons, "; ")))
	} else if decision.FinalAction == "review" {
		slog.Info("[JevModeration] 评论判定存疑，转为待审",
			slog.Int64("commentId", comment.Id),
			slog.Any("reasons", decision.ReviewReasons),
		)
		_ = repositories.CommentRepository.UpdateColumn(sqls.DB(), comment.Id, "status", constants.StatusReview)
		if ruleCfg.AutoCreateReport {
			s.createReviewReport(constants.EntityComment, comment.Id, decision.ReviewReasons)
		}
	}

	now := dates.NowTimestamp()
	contentSnapshot := comment.Content
	if len([]rune(contentSnapshot)) > 300 {
		contentSnapshot = string([]rune(contentSnapshot)[:300])
	}

	record := &models.ModerationRecord{
		EntityType:         constants.EntityComment,
		EntityId:           comment.Id,
		UserId:             comment.UserId,
		ContentSnapshot:    contentSnapshot,
		IsSpamProb:         decision.IsSpamProb,
		ToxicityScore:      decision.ToxicityScore,
		ToxicityConfidence: decision.ToxicityConfidence,
		SuggestedAction:    decision.SuggestedAction,
		FinalAction:        decision.FinalAction,
		RawResponse:        decision.RawResponse,
		CreateTime:         now,
		UpdateTime:         now,
	}

	if err := repositories.ModerationRecordRepository.Create(sqls.DB(), record); err != nil {
		slog.Error("[JevModeration] 保存评论留痕记录失败", slog.Any("err", err))
	}

	return record, nil
}

// AuditArticle 对文章（Article）执行异步智能风控与垃圾过滤
func (s *moderationService) AuditArticle(ctx context.Context, article *models.Article) (*models.ModerationRecord, error) {
	if article == nil {
		return nil, errors.New("article is nil")
	}

	cfg := SysConfigService.GetJevConfig()
	if !cfg.Enabled || cfg.ApiKey == "" {
		return nil, nil
	}

	client := s.getClient(cfg)
	if client == nil {
		return nil, errors.New("jev client not initialized")
	}

	ruleCfg := SysConfigService.GetJevRuleConfig()
	decision, _, err := s.evaluateContent(ctx, client, cfg.Model, article.Title, article.Content, ruleCfg)
	if err != nil {
		slog.Warn("[JevModeration] 文章评估请求失败，降级跳过", slog.Int64("articleId", article.Id), slog.Any("err", err))
		return nil, err
	}

	if decision.FinalAction == "reject" {
		slog.Warn("[JevModeration] 文章命中高危阈值，执行自动下架",
			slog.Int64("articleId", article.Id),
			slog.Any("reasons", decision.RejectReasons),
		)
		_ = repositories.ArticleRepository.UpdateColumn(sqls.DB(), article.Id, "status", constants.StatusDeleted)
		UserService.IncrViolationCount(article.UserId, fmt.Sprintf("Jev智能风控拦截文章 #%d: %s", article.Id, strings.Join(decision.RejectReasons, "; ")))
	} else if decision.FinalAction == "review" {
		slog.Info("[JevModeration] 文章判定存疑，进入待审队列",
			slog.Int64("articleId", article.Id),
			slog.Any("reasons", decision.ReviewReasons),
		)
		_ = repositories.ArticleRepository.UpdateColumn(sqls.DB(), article.Id, "status", constants.StatusReview)
		if ruleCfg.AutoCreateReport {
			s.createReviewReport(constants.EntityArticle, article.Id, decision.ReviewReasons)
		}
	}

	now := dates.NowTimestamp()
	contentSnapshot := fmt.Sprintf("Title: %s\nContent: %s", article.Title, article.Content)
	if len([]rune(contentSnapshot)) > 500 {
		contentSnapshot = string([]rune(contentSnapshot)[:500])
	}

	record := &models.ModerationRecord{
		EntityType:         constants.EntityArticle,
		EntityId:           article.Id,
		UserId:             article.UserId,
		ContentSnapshot:    contentSnapshot,
		IsSpamProb:         decision.IsSpamProb,
		ToxicityScore:      decision.ToxicityScore,
		ToxicityConfidence: decision.ToxicityConfidence,
		SuggestedAction:    decision.SuggestedAction,
		FinalAction:        decision.FinalAction,
		RawResponse:        decision.RawResponse,
		CreateTime:         now,
		UpdateTime:         now,
	}

	if err := repositories.ModerationRecordRepository.Create(sqls.DB(), record); err != nil {
		slog.Error("[JevModeration] 保存文章留痕记录失败", slog.Any("err", err))
	}

	return record, nil
}

// Get 根据 ID 获取风控记录
func (s *moderationService) Get(id int64) *models.ModerationRecord {
	return repositories.ModerationRecordRepository.Get(sqls.DB(), id)
}

// FindPageByParams 分页查询风控记录
func (s *moderationService) FindPageByParams(params *params.QueryParams) (list []models.ModerationRecord, paging *sqls.Paging) {
	return repositories.ModerationRecordRepository.FindPageByParams(sqls.DB(), params)
}

// FindPageByCnd 根据条件分页查询风控记录
func (s *moderationService) FindPageByCnd(cnd *sqls.Cnd) (list []models.ModerationRecord, paging *sqls.Paging) {
	return repositories.ModerationRecordRepository.FindPageByCnd(sqls.DB(), cnd)
}

// Count 统计记录数
func (s *moderationService) Count(cnd *sqls.Cnd) int64 {
	return repositories.ModerationRecordRepository.Count(sqls.DB(), cnd)
}

// createReviewReport 当内容存疑进入待审时，自动创建一条待人工复核的工单（统一收拢至用户举报工作流）
func (s *moderationService) createReviewReport(entityType string, entityId int64, reasons []string) {
	if sqls.DB() == nil {
		return
	}
	// 幂等防重：若已存在针对该实体的未处理工单，则不重复写入
	existing := repositories.UserReportRepository.FindOne(sqls.DB(), sqls.NewCnd().
		Eq("data_type", entityType).
		Eq("data_id", entityId).
		Eq("audit_status", 0))
	if existing != nil {
		slog.Info("[JevModeration] 待审工单已存在，跳过重复创建", slog.String("entityType", entityType), slog.Int64("entityId", entityId), slog.Int64("reportId", existing.Id))
		return
	}

	reasonText := "[Jev 智能风控] 判定存疑，进入待审队列"
	if len(reasons) > 0 {
		reasonText = fmt.Sprintf("[Jev 智能风控] %s", strings.Join(reasons, "; "))
	}

	now := dates.NowTimestamp()
	report := &models.UserReport{
		DataType:    entityType,
		DataId:      entityId,
		UserId:      0, // 0 标识该工单由 Jev AI 自动送审
		Reason:      reasonText,
		AuditStatus: 0, // 0: 待处理
		CreateTime:  now,
	}

	if err := repositories.UserReportRepository.Create(sqls.DB(), report); err != nil {
		slog.Error("[JevModeration] 创建用户举报待审工单失败", slog.String("entityType", entityType), slog.Int64("entityId", entityId), slog.Any("err", err))
	} else {
		slog.Info("[JevModeration] 成功创建用户举报待审工单", slog.String("entityType", entityType), slog.Int64("entityId", entityId), slog.Int64("reportId", report.Id))
	}
}

// HandleAuditTimeouts 扫描并自动处理超时未审的内容，解决人工审核通道死锁阻塞
func (s *moderationService) HandleAuditTimeouts(ctx context.Context) error {
	if sqls.DB() == nil {
		return nil
	}
	ruleCfg := SysConfigService.GetJevRuleConfig()
	if ruleCfg.ReviewTimeoutMinutes <= 0 {
		return nil // 未开启超时自动处置
	}

	// 计算超时时间戳（毫秒）
	timeoutMs := int64(ruleCfg.ReviewTimeoutMinutes) * 60 * 1000
	now := dates.NowTimestamp()
	threshold := now - timeoutMs

	targetAction := strings.ToLower(ruleCfg.ReviewTimeoutAction)
	if targetAction != "reject" {
		targetAction = "pass" // 默认宽容放行
	}

	s.resolveTimeoutTopics(threshold, targetAction, now)
	s.resolveTimeoutArticles(threshold, targetAction, now)
	s.resolveTimeoutComments(threshold, targetAction, now)

	return nil
}

// resolveTimeoutTopics 处理超时话题
func (s *moderationService) resolveTimeoutTopics(threshold int64, targetAction string, now int64) {
	var topics []models.Topic
	sqls.DB().Where("status = ? AND create_time <= ?", constants.StatusReview, threshold).
		Limit(50).Find(&topics)

	for _, topic := range topics {
		if targetAction == "pass" {
			if err := TopicService.Audit(topic.Id); err != nil {
				slog.Error("[AuditTimeout] 超时放行话题失败", slog.Int64("topicId", topic.Id), slog.Any("err", err))
				continue
			}
			slog.Info("[AuditTimeout] 话题超时未审，执行自动放行上线", slog.Int64("topicId", topic.Id))
			s.closeUserReport(constants.EntityTopic, topic.Id, 2)
			s.recordTimeoutAudit(constants.EntityTopic, topic.Id, topic.UserId, "timeout_pass")
		} else {
			res := sqls.DB().Model(&models.Topic{}).Where("id = ? AND status = ?", topic.Id, constants.StatusReview).
				Updates(map[string]interface{}{"status": constants.StatusDeleted})
			if res.RowsAffected > 0 {
				slog.Warn("[AuditTimeout] 话题超时未审，执行自动下架", slog.Int64("topicId", topic.Id))
				s.closeUserReport(constants.EntityTopic, topic.Id, 1)
				s.recordTimeoutAudit(constants.EntityTopic, topic.Id, topic.UserId, "timeout_reject")
			}
		}
	}
}

// resolveTimeoutArticles 处理超时文章
func (s *moderationService) resolveTimeoutArticles(threshold int64, targetAction string, now int64) {
	var articles []models.Article
	sqls.DB().Where("status = ? AND create_time <= ?", constants.StatusReview, threshold).
		Limit(50).Find(&articles)

	for _, article := range articles {
		if targetAction == "pass" {
			if err := ArticleService.UpdateColumn(article.Id, "status", constants.StatusOk); err != nil {
				slog.Error("[AuditTimeout] 超时放行文章失败", slog.Int64("articleId", article.Id), slog.Any("err", err))
				continue
			}
			slog.Info("[AuditTimeout] 文章超时未审，执行自动放行上线", slog.Int64("articleId", article.Id))
			s.closeUserReport(constants.EntityArticle, article.Id, 2)
			s.recordTimeoutAudit(constants.EntityArticle, article.Id, article.UserId, "timeout_pass")
		} else {
			res := sqls.DB().Model(&models.Article{}).Where("id = ? AND status = ?", article.Id, constants.StatusReview).
				Updates(map[string]interface{}{"status": constants.StatusDeleted})
			if res.RowsAffected > 0 {
				slog.Warn("[AuditTimeout] 文章超时未审，执行自动下架", slog.Int64("articleId", article.Id))
				s.closeUserReport(constants.EntityArticle, article.Id, 1)
				s.recordTimeoutAudit(constants.EntityArticle, article.Id, article.UserId, "timeout_reject")
			}
		}
	}
}

// resolveTimeoutComments 处理超时评论
func (s *moderationService) resolveTimeoutComments(threshold int64, targetAction string, now int64) {
	var comments []models.Comment
	sqls.DB().Where("status = ? AND create_time <= ?", constants.StatusReview, threshold).
		Limit(50).Find(&comments)

	for _, comment := range comments {
		if targetAction == "pass" {
			if err := CommentService.Audit(comment.Id); err != nil {
				slog.Error("[AuditTimeout] 超时放行评论失败", slog.Int64("commentId", comment.Id), slog.Any("err", err))
				continue
			}
			slog.Info("[AuditTimeout] 评论超时未审，执行自动放行上线", slog.Int64("commentId", comment.Id))
			s.closeUserReport(constants.EntityComment, comment.Id, 2)
			s.recordTimeoutAudit(constants.EntityComment, comment.Id, comment.UserId, "timeout_pass")
		} else {
			res := sqls.DB().Model(&models.Comment{}).Where("id = ? AND status = ?", comment.Id, constants.StatusReview).
				Updates(map[string]interface{}{"status": constants.StatusDeleted})
			if res.RowsAffected > 0 {
				slog.Warn("[AuditTimeout] 评论超时未审，执行自动下架", slog.Int64("commentId", comment.Id))
				s.closeUserReport(constants.EntityComment, comment.Id, 1)
				s.recordTimeoutAudit(constants.EntityComment, comment.Id, comment.UserId, "timeout_reject")
			}
		}
	}
}

// closeUserReport 闭环超时工单状态
func (s *moderationService) closeUserReport(dataType string, dataId int64, auditStatus int64) {
	sqls.DB().Model(&models.UserReport{}).
		Where("data_type = ? AND data_id = ? AND audit_status = 0", dataType, dataId).
		Updates(map[string]interface{}{
			"audit_status":  auditStatus,
			"audit_user_id": 0, // 0 标识系统超时流转
			"audit_time":    dates.NowTimestamp(),
		})
}

// recordTimeoutAudit 留痕超时处置事件
func (s *moderationService) recordTimeoutAudit(entityType string, entityId, userId int64, finalAction string) {
	now := dates.NowTimestamp()
	rec := &models.ModerationRecord{
		EntityType:      entityType,
		EntityId:        entityId,
		UserId:          userId,
		ContentSnapshot: "[审核超时自动兜底流转]",
		SuggestedAction: "review",
		FinalAction:     finalAction,
		CreateTime:      now,
		UpdateTime:      now,
	}
	_ = repositories.ModerationRecordRepository.Create(sqls.DB(), rec)
}
