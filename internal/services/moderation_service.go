package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
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

// getClient 根据当前最新配置构建 Jev 客户端实例
func (s *moderationService) getClient(cfg dto.JevConfig) *jev.Client {
	timeout := time.Duration(cfg.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	return jev.NewClient(cfg.Endpoint, cfg.ApiKey, timeout)
}

// AuditTopic 对话题（Topic）执行异步智能风控与垃圾过滤
func (s *moderationService) AuditTopic(ctx context.Context, topic *models.Topic) (*models.ModerationRecord, error) {
	if topic == nil {
		return nil, errors.New("topic is nil")
	}

	cfg := SysConfigService.GetJevConfig()
	if !cfg.Enabled || cfg.ApiKey == "" {
		// 未启用 Jev 或未配置 API Key，静默跳过
		return nil, nil
	}

	client := s.getClient(cfg)
	if client == nil {
		return nil, errors.New("jev client not initialized")
	}

	// 截取内容快照，防止超长输入消耗过多 Token
	contentRune := []rune(topic.Content)
	if len(contentRune) > 500 {
		contentRune = contentRune[:500]
	}
	snapshot := fmt.Sprintf("Title: %s\nContent: %s", topic.Title, string(contentRune))

	// 1. 构造 Speculative Fan-out 评估请求
	req := &jev.SystemOneRequest{
		Model: cfg.Model,
		State: map[string]string{
			"title":   topic.Title,
			"content": string(contentRune),
		},
		Questions: map[string]jev.Question{
			// 问题 1 (Noul): 是否包含垃圾广告、诈骗推广、色情赌博引流或非法链接？
			"is_spam": {
				Type:         jev.TypeNoul,
				Instructions: "Does `title` or `content` contain spam, commercial ads, fraudulent schemes, or prohibited promotional links?",
			},
			// 问题 2 (Score): 攻击性、辱骂与违规严重程度打分 (0~2)
			"toxicity": {
				Type:         jev.TypeScore,
				Instructions: "How toxic, abusive, or hostile is the tone of this post?",
				Criteria: []string{
					"Civil and rational discussion; friendly or neutral",
					"Mildly uncivil, sarcastic, or slightly provocative, but still technical/relevant",
					"Severe personal attacks, vulgar abuse, hate speech, threats, or explicit harassment",
				},
			},
			// 问题 3 (Choice): 违规主要归因类型
			"violation_category": {
				Type:         jev.TypeChoice,
				Instructions: "If this content violates community standards, which category does it primarily belong to?",
				Criteria: map[string]string{
					"clean":        "No violation found; normal discussion",
					"spam_ad":      "Unsolicited advertisement, promotional spam, or marketing",
					"flame_abuse":  "Personal attacks, insults, or harassment",
					"illegal_info": "Fraud, gambling, pornography, or prohibited items",
					"other":        "Other community guideline violations",
				},
			},
		},
	}

	// 2. 调用 Jev 接口
	resp, err := client.Evaluate(ctx, req)
	if err != nil {
		slog.Warn("[JevModeration] 评估请求失败，降级跳过", slog.Int64("topicId", topic.Id), slog.Any("err", err))
		return nil, err
	}

	// 3. 解析结果
	var isSpamProb float64
	var toxicityScore float64
	var toxicityConfidence float64

	if noulAns, err := jev.ParseNoul(resp, "is_spam"); err == nil {
		isSpamProb = noulAns.Noul
	}
	if scoreAns, err := jev.ParseScore(resp, "toxicity"); err == nil {
		toxicityScore = scoreAns.Score
		toxicityConfidence = scoreAns.Confidence
	}

	// 4. 业务规则决策引擎
	suggestedAction := "pass"
	finalAction := "pass"

	isHighRisk := isSpamProb >= cfg.AutoRejectSpamThreshold || toxicityScore >= cfg.AutoRejectScoreThreshold
	isMediumRisk := isSpamProb >= cfg.AutoReviewSpamThreshold || toxicityScore >= cfg.AutoReviewScoreThreshold || (toxicityScore > 0.6 && toxicityConfidence < 0.5)

	if isHighRisk {
		suggestedAction = "reject"
		finalAction = "reject"
		// 自动软删除下架
		slog.Warn("[JevModeration] 话题命中高危阈值，执行自动下架",
			slog.Int64("topicId", topic.Id),
			slog.Float64("spam", isSpamProb),
			slog.Float64("toxicity", toxicityScore),
		)
		_ = repositories.TopicRepository.UpdateColumn(sqls.DB(), topic.Id, "status", constants.StatusDeleted)
	} else if isMediumRisk {
		suggestedAction = "review"
		finalAction = "review"
		// 自动流转为人工待审
		slog.Info("[JevModeration] 话题判定存疑，进入待审队列",
			slog.Int64("topicId", topic.Id),
			slog.Float64("spam", isSpamProb),
			slog.Float64("toxicity", toxicityScore),
			slog.Float64("confidence", toxicityConfidence),
		)
		_ = repositories.TopicRepository.UpdateColumn(sqls.DB(), topic.Id, "status", constants.StatusReview)
	}

	rawJSON, _ := json.Marshal(resp)
	now := dates.NowTimestamp()

	record := &models.ModerationRecord{
		EntityType:         constants.EntityTopic,
		EntityId:           topic.Id,
		UserId:             topic.UserId,
		ContentSnapshot:    snapshot,
		IsSpamProb:         isSpamProb,
		ToxicityScore:      toxicityScore,
		ToxicityConfidence: toxicityConfidence,
		SuggestedAction:    suggestedAction,
		FinalAction:        finalAction,
		RawResponse:        string(rawJSON),
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

	contentRune := []rune(comment.Content)
	if len(contentRune) > 300 {
		contentRune = contentRune[:300]
	}
	snapshot := string(contentRune)

	req := &jev.SystemOneRequest{
		Model: cfg.Model,
		State: snapshot,
		Questions: map[string]jev.Question{
			"is_spam": {
				Type:         jev.TypeNoul,
				Instructions: "Does this comment contain spam, unsolicited advertisement, or malicious links?",
			},
			"toxicity": {
				Type:         jev.TypeScore,
				Instructions: "Rate the hostility or abuse of this comment",
				Criteria: []string{
					"Civil, constructive, or neutral",
					"Sarcastic, rude, or mildly aggressive",
					"Severe harassment, insults, or hate speech",
				},
			},
		},
	}

	resp, err := client.Evaluate(ctx, req)
	if err != nil {
		slog.Warn("[JevModeration] 评论评估请求失败，降级跳过", slog.Int64("commentId", comment.Id), slog.Any("err", err))
		return nil, err
	}

	var isSpamProb float64
	var toxicityScore float64
	var toxicityConfidence float64

	if noulAns, err := jev.ParseNoul(resp, "is_spam"); err == nil {
		isSpamProb = noulAns.Noul
	}
	if scoreAns, err := jev.ParseScore(resp, "toxicity"); err == nil {
		toxicityScore = scoreAns.Score
		toxicityConfidence = scoreAns.Confidence
	}

	suggestedAction := "pass"
	finalAction := "pass"

	isHighRisk := isSpamProb >= cfg.AutoRejectSpamThreshold || toxicityScore >= cfg.AutoRejectScoreThreshold
	isMediumRisk := isSpamProb >= cfg.AutoReviewSpamThreshold || toxicityScore >= cfg.AutoReviewScoreThreshold

	if isHighRisk {
		suggestedAction = "reject"
		finalAction = "reject"
		slog.Warn("[JevModeration] 评论命中高危阈值，自动下架", slog.Int64("commentId", comment.Id))
		_ = repositories.CommentRepository.UpdateColumn(sqls.DB(), comment.Id, "status", constants.StatusDeleted)
	} else if isMediumRisk {
		suggestedAction = "review"
		finalAction = "review"
		slog.Info("[JevModeration] 评论判定存疑，转为待审", slog.Int64("commentId", comment.Id))
		_ = repositories.CommentRepository.UpdateColumn(sqls.DB(), comment.Id, "status", constants.StatusReview)
	}

	rawJSON, _ := json.Marshal(resp)
	now := dates.NowTimestamp()

	record := &models.ModerationRecord{
		EntityType:         constants.EntityComment,
		EntityId:           comment.Id,
		UserId:             comment.UserId,
		ContentSnapshot:    snapshot,
		IsSpamProb:         isSpamProb,
		ToxicityScore:      toxicityScore,
		ToxicityConfidence: toxicityConfidence,
		SuggestedAction:    suggestedAction,
		FinalAction:        finalAction,
		RawResponse:        string(rawJSON),
		CreateTime:         now,
		UpdateTime:         now,
	}

	if err := repositories.ModerationRecordRepository.Create(sqls.DB(), record); err != nil {
		slog.Error("[JevModeration] 保存评论留痕记录失败", slog.Any("err", err))
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
