package services

import (
	"bbs-go/internal/models/constants"
	"bbs-go/internal/models/dto"
	"bbs-go/internal/pkg/config"
	"bbs-go/internal/pkg/locales"
	"bbs-go/internal/pkg/msg"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/common/jsons"
	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/sqls"
	"github.com/tidwall/gjson"

	"gorm.io/gorm"

	"bbs-go/internal/cache"
	"bbs-go/internal/models"
	"bbs-go/internal/repositories"
)

var SysConfigService = newSysConfigService()

const (
	maxScriptInjectionCount   = 20
	maxScriptInjectionCodeLen = 20 * 1024
	maxScriptInjectionNameLen = 200
)

func newSysConfigService() *sysConfigService {
	return &sysConfigService{}
}

type sysConfigService struct {
}

func (s *sysConfigService) Get(id int64) *models.SysConfig {
	return repositories.SysConfigRepository.Get(sqls.DB(), id)
}

func (s *sysConfigService) Take(where ...interface{}) *models.SysConfig {
	return repositories.SysConfigRepository.Take(sqls.DB(), where...)
}

func (s *sysConfigService) Find(cnd *sqls.Cnd) []models.SysConfig {
	return repositories.SysConfigRepository.Find(sqls.DB(), cnd)
}

func (s *sysConfigService) FindOne(cnd *sqls.Cnd) *models.SysConfig {
	return repositories.SysConfigRepository.FindOne(sqls.DB(), cnd)
}

func (s *sysConfigService) FindPageByParams(params *params.QueryParams) (list []models.SysConfig, paging *sqls.Paging) {
	return repositories.SysConfigRepository.FindPageByParams(sqls.DB(), params)
}

func (s *sysConfigService) FindPageByCnd(cnd *sqls.Cnd) (list []models.SysConfig, paging *sqls.Paging) {
	return repositories.SysConfigRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *sysConfigService) GetAll() []models.SysConfig {
	return repositories.SysConfigRepository.Find(sqls.DB(), sqls.NewCnd().Asc("id"))
}

func (s *sysConfigService) SetAll(configStr string) error {
	json := gjson.Parse(configStr)
	configs, ok := json.Value().(map[string]interface{})
	if !ok {
		return errors.New(locales.Get("settings.invalid_format"))
	}

	if siteNavs := json.Get(constants.SysConfigSiteNavs); siteNavs.Exists() {
		if err := validateSiteNavs(siteNavs.String()); err != nil {
			return err
		}
	}
	if aboutPageConfig := json.Get(constants.SysConfigAboutPageConfig); aboutPageConfig.Exists() {
		if err := validateAboutPageConfig(aboutPageConfig.String()); err != nil {
			return err
		}
	}
	if footerLinks := json.Get(constants.SysConfigFooterLinks); footerLinks.Exists() {
		if err := validateFooterLinks(footerLinks.String()); err != nil {
			return err
		}
	}
	if linkPageConfig := json.Get(constants.SysConfigLinkPageConfig); linkPageConfig.Exists() {
		if err := validateLinkPageConfig(linkPageConfig.String()); err != nil {
			return err
		}
	}
	if signatureMinLevel := json.Get(constants.SysConfigSignatureMinLevel); signatureMinLevel.Exists() {
		if err := validateSignatureMinLevel(signatureMinLevel.String()); err != nil {
			return err
		}
	}
	if scriptInjections := json.Get(constants.SysConfigScriptInjections); scriptInjections.Exists() {
		if err := validateScriptInjections(scriptInjections.String()); err != nil {
			return err
		}
	}
	return sqls.DB().Transaction(func(tx *gorm.DB) error {
		for k := range configs {
			v := json.Get(k).String()
			if err := s.setSingle(tx, k, v, "", ""); err != nil {
				return err
			}
		}
		return nil
	})
}

// Set 设置配置，如果配置不存在，那么创建
func (s *sysConfigService) Set(key, value string) error {
	return sqls.DB().Transaction(func(tx *gorm.DB) error {
		if err := s.setSingle(tx, key, value, "", ""); err != nil {
			return err
		}
		return nil
	})
}

func (s *sysConfigService) setSingle(db *gorm.DB, key, value, name, description string) error {
	if len(key) == 0 {
		return errors.New("sys config key is null")
	}
	sysConfig := repositories.SysConfigRepository.GetByKey(db, key)
	if sysConfig == nil {
		sysConfig = &models.SysConfig{
			CreateTime: dates.NowTimestamp(),
		}
	}
	sysConfig.Key = key
	sysConfig.Value = value
	sysConfig.UpdateTime = dates.NowTimestamp()

	if strs.IsNotBlank(name) {
		sysConfig.Name = name
	}
	if strs.IsNotBlank(description) {
		sysConfig.Description = description
	}

	var err error
	if sysConfig.Id > 0 {
		err = repositories.SysConfigRepository.Update(db, sysConfig)
	} else {
		err = repositories.SysConfigRepository.Create(db, sysConfig)
	}
	if err != nil {
		return err
	} else {
		cache.SysConfigCache.Invalidate(key)
		return nil
	}
}

func (s *sysConfigService) GetTokenExpireDays() int {
	tokenExpireDays := cache.SysConfigCache.GetInt(constants.SysConfigTokenExpireDays)
	if tokenExpireDays <= 0 {
		tokenExpireDays = constants.DefaultTokenExpireDays
	}
	return tokenExpireDays
}

func (s *sysConfigService) IsCreateTopicEmailVerified() bool {
	return cache.SysConfigCache.GetBool(constants.SysConfigCreateTopicEmailVerified)
}

func (s *sysConfigService) IsCreateArticleEmailVerified() bool {
	return cache.SysConfigCache.GetBool(constants.SysConfigCreateArticleEmailVerified)
}

func (s *sysConfigService) IsCreateCommentEmailVerified() bool {
	return cache.SysConfigCache.GetBool(constants.SysConfigCreateCommentEmailVerified)
}

func (s *sysConfigService) IsEnableHideContent() bool {
	return cache.SysConfigCache.GetBool(constants.SysConfigEnableHideContent)
}

func (s *sysConfigService) IsEnableQaBounty() bool {
	return cache.SysConfigCache.GetBool(constants.SysConfigEnableQaBounty)
}

func (s *sysConfigService) GetQaBountyMin() int {
	return cache.SysConfigCache.GetInt(constants.SysConfigQaBountyMin)
}

func (s *sysConfigService) GetQaBountyMax() int {
	return cache.SysConfigCache.GetInt(constants.SysConfigQaBountyMax)
}

func (s *sysConfigService) IsQaBountyRequired() bool {
	return cache.SysConfigCache.GetBool(constants.SysConfigQaBountyRequired)
}

func (s *sysConfigService) IsArticlePending() bool {
	return cache.SysConfigCache.GetBool(constants.SysConfigArticlePending)
}

func (s *sysConfigService) IsTopicPending() bool {
	return cache.SysConfigCache.GetBool(constants.SysConfigTopicPending)
}

func (s *sysConfigService) IsTopicCaptcha() bool {
	return cache.SysConfigCache.GetBool(constants.SysConfigTopicCaptcha)
}

func (s *sysConfigService) GetDefaultCategoryId() int64 {
	return cache.SysConfigCache.GetInt64(constants.SysConfigDefaultCategoryId)
}

func (s *sysConfigService) GetTopicListStyle() string {
	return normalizeTopicListStyle(cache.SysConfigCache.GetStr(constants.SysConfigTopicListStyle))
}

func normalizeTopicListStyle(style string) string {
	switch strings.TrimSpace(style) {
	case constants.TopicListStyleCompact:
		return constants.TopicListStyleCompact
	default:
		return constants.TopicListStyleDefault
	}
}

func (s *sysConfigService) GetSiteNavs() []dto.ActionLink {
	siteNavs := cache.SysConfigCache.GetStr(constants.SysConfigSiteNavs)
	var siteNavsArr []dto.ActionLink
	if strs.IsNotBlank(siteNavs) {
		if err := jsons.Parse(siteNavs, &siteNavsArr); err != nil {
			slog.Warn("站点导航数据错误", slog.Any("err", err))
		}
	}
	return siteNavsArr
}

func (s *sysConfigService) GetModules() dto.ModulesConfig {
	return parseModulesConfig(cache.SysConfigCache.GetStr(constants.SysConfigModules))
}

func defaultModulesConfig() dto.ModulesConfig {
	return dto.ModulesConfig{
		Tweet:   true,
		Topic:   true,
		QA:      true,
		Article: true,
	}
}

func parseModulesConfig(str string) dto.ModulesConfig {
	modulesConfig := defaultModulesConfig()
	if strs.IsBlank(str) {
		return modulesConfig
	}

	if err := jsons.Parse(str, &modulesConfig); err != nil {
		slog.Warn("启用模块配置错误", slog.Any("err", err))
		return defaultModulesConfig()
	}

	// 兼容历史配置：以前只有 topic 开关，提问跟随帖子。
	// 新配置存在 qa 字段时，提问可以独立于帖子开关控制。
	if !gjson.Get(str, "qa").Exists() {
		modulesConfig.QA = modulesConfig.Topic
	}
	return modulesConfig
}

func (s *sysConfigService) GetAboutPageConfig() dto.AboutPageConfig {
	str := cache.SysConfigCache.GetStr(constants.SysConfigAboutPageConfig)
	cfg := dto.AboutPageConfig{
		Content: dto.LocalizedText{},
	}
	if strings.TrimSpace(str) == "" {
		return cfg
	}
	if err := jsons.Parse(str, &cfg); err != nil {
		slog.Warn("关于页配置错误", slog.Any("err", err))
		return dto.AboutPageConfig{Content: dto.LocalizedText{}}
	}
	if cfg.Content == nil {
		cfg.Content = dto.LocalizedText{}
	}
	return cfg
}

func (s *sysConfigService) GetFooterLinks() []dto.FooterLink {
	str := cache.SysConfigCache.GetStr(constants.SysConfigFooterLinks)
	cfg := []dto.FooterLink{}
	if strings.TrimSpace(str) == "" {
		return cfg
	}
	if err := jsons.Parse(str, &cfg); err != nil {
		slog.Warn("底部链接配置错误", slog.Any("err", err))
		return []dto.FooterLink{}
	}
	return cfg
}

func (s *sysConfigService) GetLinkPageConfig() dto.LinkPageConfig {
	str := cache.SysConfigCache.GetStr(constants.SysConfigLinkPageConfig)
	// 默认开启 favicon，符合“实时抓取、空旷优化”诉求
	if strings.TrimSpace(str) == "" {
		return dto.LinkPageConfig{ShowFavicon: true}
	}
	var cfg dto.LinkPageConfig
	if err := jsons.Parse(str, &cfg); err != nil {
		slog.Warn("友链页配置错误", slog.Any("err", err))
		return dto.LinkPageConfig{ShowFavicon: true}
	}
	return cfg
}

func (s *sysConfigService) GetSignatureMinLevel() int {
	// 默认 3 级可设签名，0 表示不限制
	val := cache.SysConfigCache.GetInt(constants.SysConfigSignatureMinLevel)
	if val < 0 {
		return 0
	}
	if val == 0 {
		// 未配置时返回默认 3，避免新功能对低等级用户过度开放
		// 若管理员显式设为 0，则表示不限制
		str := cache.SysConfigCache.GetStr(constants.SysConfigSignatureMinLevel)
		if strings.TrimSpace(str) == "" {
			return 3
		}
	}
	return val
}

// GetEmailWhitelist 邮箱白名单
func (s *sysConfigService) GetEmailWhitelist() []string {
	str := cache.SysConfigCache.GetStr(constants.SysConfigEmailWhitelist)
	var emailWhitelist []string
	if strs.IsNotBlank(str) {
		_ = jsons.Parse(str, &emailWhitelist)
	}
	return emailWhitelist
}

// GetEmailNoticeIntervalSeconds 邮件通知间隔（秒），<=0 表示不限制
func (s *sysConfigService) GetEmailNoticeIntervalSeconds() int {
	return cache.SysConfigCache.GetInt(constants.SysConfigEmailNoticeIntervalSeconds)
}

// GetNotificationTypes 各消息类型的站内信/邮件开关，缺省为全部开启
func (s *sysConfigService) GetNotificationTypes() map[string]dto.NoticeTypeConfig {
	str := cache.SysConfigCache.GetStr(constants.SysConfigNotificationTypes)
	out := make(map[string]dto.NoticeTypeConfig)
	if strs.IsNotBlank(str) {
		_ = jsons.Parse(str, &out)
	}
	// 默认补全缺失类型：topicDelete 默认不发邮件（保持历史行为），其余全部开启
	allKeys := []string{"topicComment", "commentReply", "topicLike", "topicFavorite", "topicRecommend", "topicDelete", "articleComment", "userLevelUp", "userBadgeGrant", "qaAnswerAccepted"}
	for _, k := range allKeys {
		if _, ok := out[k]; !ok {
			if k == "topicDelete" {
				out[k] = dto.NoticeTypeConfig{Site: true, Email: false}
			} else {
				out[k] = dto.NoticeTypeConfig{Site: true, Email: true}
			}
		}
	}
	return out
}

// msgTypeToKey msg.Type 与 notificationTypes 的 key 对应
func msgTypeToKey(t msg.Type) string {
	switch t {
	case msg.TypeTopicComment:
		return "topicComment"
	case msg.TypeCommentReply:
		return "commentReply"
	case msg.TypeTopicLike:
		return "topicLike"
	case msg.TypeTopicFavorite:
		return "topicFavorite"
	case msg.TypeTopicRecommend:
		return "topicRecommend"
	case msg.TypeTopicDelete:
		return "topicDelete"
	case msg.TypeArticleComment:
		return "articleComment"
	case msg.TypeUserLevelUp:
		return "userLevelUp"
	case msg.TypeUserBadgeGrant:
		return "userBadgeGrant"
	case msg.TypeQaAnswerAccepted:
		return "qaAnswerAccepted"
	default:
		return ""
	}
}

// IsSiteNoticeEnabled 该消息类型是否发站内信
func (s *sysConfigService) IsSiteNoticeEnabled(msgType msg.Type) bool {
	key := msgTypeToKey(msgType)
	if key == "" {
		return true
	}
	types := s.GetNotificationTypes()
	c, ok := types[key]
	if !ok {
		return true
	}
	return c.Site
}

// IsEmailNoticeEnabled 该消息类型是否发邮件（在已发站内信前提下）
func (s *sysConfigService) IsEmailNoticeEnabled(msgType msg.Type) bool {
	key := msgTypeToKey(msgType)
	if key == "" {
		return true
	}
	types := s.GetNotificationTypes()
	c, ok := types[key]
	if !ok {
		return true
	}
	return c.Email
}

func (s *sysConfigService) IsUrlRedirect() bool {
	return cache.SysConfigCache.GetBool(constants.SysConfigUrlRedirect)
}

func (s *sysConfigService) GetLoginConfig() dto.LoginConfig {
	str := cache.SysConfigCache.GetStr(constants.SysConfigLoginConfig)
	var loginConfig dto.LoginConfig
	if err := jsons.Parse(str, &loginConfig); err != nil {
		slog.Warn("登录配置错误", slog.Any("err", err))
	}

	// 如果全部禁用，那么默认启用密码登录
	if loginConfig.IsAllDisabled() {
		loginConfig.PasswordLogin.Enabled = true
	}

	return loginConfig
}

func (s *sysConfigService) GetUploadConfig() dto.UploadConfig {
	str := cache.SysConfigCache.GetStr(constants.SysConfigUploadConfig)
	var uploadConfig dto.UploadConfig
	if err := jsons.Parse(str, &uploadConfig); err != nil {
		slog.Warn("上传配置错误", slog.Any("err", err))
	}
	return uploadConfig
}

// GetAttachmentConfig 附件配置（帖子附件）
func (s *sysConfigService) GetAttachmentConfig() dto.AttachmentConfig {
	str := cache.SysConfigCache.GetStr(constants.SysConfigAttachmentConfig)
	var cfg dto.AttachmentConfig
	if err := jsons.Parse(str, &cfg); err != nil {
		slog.Warn("附件配置解析错误", slog.Any("err", err))
	}
	// 默认值
	if cfg.MaxSizeMB <= 0 {
		cfg.MaxSizeMB = 10
	}
	if cfg.MaxCount <= 0 {
		cfg.MaxCount = 5
	}
	if len(cfg.AllowedTypes) == 0 {
		cfg.AllowedTypes = []string{".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".csv", ".zip", ".rar", ".7z", ".tar", ".gz"}
	}
	return cfg
}

func (s *sysConfigService) GetSmtpConfig() dto.SmtpConfig {
	str := cache.SysConfigCache.GetStr(constants.SysConfigSmtpConfig)
	var smtpConfig dto.SmtpConfig
	if strings.TrimSpace(str) == "" {
		return smtpConfig
	}
	if err := jsons.Parse(str, &smtpConfig); err != nil {
		slog.Warn("smtp配置错误", slog.Any("err", err))
	}
	return smtpConfig
}

func (s *sysConfigService) GetScriptInjections() []dto.ScriptInjection {
	str := cache.SysConfigCache.GetStr(constants.SysConfigScriptInjections)
	if strings.TrimSpace(str) == "" {
		return []dto.ScriptInjection{}
	}

	var injections []dto.ScriptInjection
	if err := jsons.Parse(str, &injections); err != nil {
		slog.Warn("脚本注入配置错误", slog.Any("err", err))
		return []dto.ScriptInjection{}
	}
	return injections
}

func (s *sysConfigService) GetBaseURL() string {
	baseURL := strings.TrimSpace(cache.SysConfigCache.GetStr(constants.SysConfigBaseURL))
	if baseURL == "" {
		return "/"
	}
	for len(baseURL) > 1 && strings.HasSuffix(baseURL, "/") {
		baseURL = strings.TrimSuffix(baseURL, "/")
	}
	return baseURL
}

func validateSiteNavs(siteNavsJson string) error {
	if strings.TrimSpace(siteNavsJson) == "" {
		return nil
	}
	var navs []dto.ActionLink
	if err := jsons.Parse(siteNavsJson, &navs); err != nil {
		return errors.New("invalid site navigation data format")
	}
	return validateActionLinks(navs, 1)
}

func validateAboutPageConfig(aboutPageConfigJSON string) error {
	if strings.TrimSpace(aboutPageConfigJSON) == "" {
		return nil
	}

	var cfg dto.AboutPageConfig
	if err := jsons.Parse(aboutPageConfigJSON, &cfg); err != nil {
		return errors.New("invalid about page config data format")
	}
	return nil
}

func validateFooterLinks(footerLinksJSON string) error {
	if strings.TrimSpace(footerLinksJSON) == "" {
		return nil
	}

	var links []dto.FooterLink
	if err := jsons.Parse(footerLinksJSON, &links); err != nil {
		return errors.New("invalid footer links data format")
	}
	for idx, item := range links {
		if !hasLocalizedText(item.Text) {
			return fmt.Errorf("footer link text is required at item %d", idx+1)
		}
	}
	return nil
}

func validateLinkPageConfig(linkPageConfigJSON string) error {
	if strings.TrimSpace(linkPageConfigJSON) == "" {
		return nil
	}
	var cfg dto.LinkPageConfig
	if err := jsons.Parse(linkPageConfigJSON, &cfg); err != nil {
		return errors.New("invalid link page config data format")
	}
	return nil
}

func validateSignatureMinLevel(signatureMinLevelJSON string) error {
	if strings.TrimSpace(signatureMinLevelJSON) == "" {
		return nil
	}
	var level int
	if err := jsons.Parse(signatureMinLevelJSON, &level); err != nil {
		// 兼容直接传数字字符串或 JSON 数字
		if _, err2 := fmt.Sscanf(signatureMinLevelJSON, "%d", &level); err2 != nil {
			return errors.New("invalid signature min level data format")
		}
	}
	if level < 0 || level > 100 {
		return errors.New("signature min level must be between 0 and 100")
	}
	return nil
}

func hasLocalizedText(text dto.LocalizedText) bool {
	for _, value := range text {
		if strings.TrimSpace(value) != "" {
			return true
		}
	}
	return false
}

func validateActionLinks(navs []dto.ActionLink, depth int) error {
	if depth > 2 {
		return errors.New("site navigation supports at most two levels")
	}
	for idx, nav := range navs {
		if strings.TrimSpace(nav.Title) == "" {
			return fmt.Errorf("navigation title is required at item %d", idx+1)
		}
		if depth == 1 {
			if len(nav.Children) == 0 && strings.TrimSpace(nav.Url) == "" {
				return fmt.Errorf("primary navigation URL is required at item %d", idx+1)
			}
			if len(nav.Children) > 0 {
				if err := validateActionLinks(nav.Children, depth+1); err != nil {
					return err
				}
			}
			continue
		}
		if strings.TrimSpace(nav.Url) == "" {
			return fmt.Errorf("secondary navigation URL is required at item %d", idx+1)
		}
		if len(nav.Children) > 0 {
			return errors.New("site navigation supports at most two levels")
		}
	}
	return nil
}

func validateScriptInjections(scriptInjectionsJSON string) error {
	if strings.TrimSpace(scriptInjectionsJSON) == "" {
		return nil
	}

	var injections []dto.ScriptInjection
	if err := jsons.Parse(scriptInjectionsJSON, &injections); err != nil {
		return errors.New("invalid script injections data format")
	}

	if len(injections) > maxScriptInjectionCount {
		return fmt.Errorf("too many script injections, max %d", maxScriptInjectionCount)
	}

	for idx, injection := range injections {
		scriptName := strings.TrimSpace(injection.ScriptName)
		if scriptName == "" {
			return fmt.Errorf("script injection name is required at item %d", idx+1)
		}
		if len([]rune(scriptName)) > maxScriptInjectionNameLen {
			return fmt.Errorf("script injection name is too long at item %d", idx+1)
		}
		injectionType := strings.TrimSpace(injection.Type)
		switch injectionType {
		case "external":
			if strings.TrimSpace(injection.Src) == "" {
				return fmt.Errorf("script injection src is required at item %d", idx+1)
			}
		case "inline":
			if strings.TrimSpace(injection.Code) == "" {
				return fmt.Errorf("script injection code is required at item %d", idx+1)
			}
			if len(injection.Code) > maxScriptInjectionCodeLen {
				return fmt.Errorf("script injection code is too long at item %d", idx+1)
			}
		default:
			return fmt.Errorf("script injection type must be external or inline at item %d", idx+1)
		}
	}
	return nil
}

// GetJevConfig 获取 Jev / OpenRouter 智能内容风控配置
// 优先读取数据库 t_sys_config 中的 jevConfig；若未配置，则回退读取配置文件 bbs-go.yaml
func (s *sysConfigService) GetJevConfig() dto.JevConfig {
	var cfg dto.JevConfig
	str := cache.SysConfigCache.GetStr(constants.SysConfigJevConfig)
	if strs.IsNotBlank(str) {
		if err := jsons.Parse(str, &cfg); err != nil {
			slog.Warn("解析数据库 Jev 配置错误", slog.Any("err", err))
		}
	} else if config.Instance != nil {
		// 回退使用 yaml 静态配置
		yamlCfg := config.Instance.Jev
		cfg = dto.JevConfig{
			Enabled:                  yamlCfg.Enabled,
			ApiKey:                   yamlCfg.ApiKey,
			Endpoint:                 yamlCfg.Endpoint,
			Model:                    yamlCfg.Model,
			TimeoutMs:                yamlCfg.TimeoutMs,
			AutoRejectScoreThreshold: yamlCfg.AutoRejectScoreThreshold,
			AutoRejectSpamThreshold:  yamlCfg.AutoRejectSpamThreshold,
			AutoReviewScoreThreshold: yamlCfg.AutoReviewScoreThreshold,
			AutoReviewSpamThreshold:  yamlCfg.AutoReviewSpamThreshold,
		}
	}

	// 默认兜底与自动识别 Provider
	if strs.IsBlank(cfg.Endpoint) {
		cfg.Endpoint = "https://openrouter.ai/api/alpha/decisions"
	}
	if strs.IsBlank(cfg.Model) {
		cfg.Model = "~typesafe/jev-latest"
	}
	if strs.IsBlank(cfg.Provider) {
		if strings.Contains(cfg.Endpoint, "openrouter") {
			cfg.Provider = "openrouter"
		} else {
			cfg.Provider = "typesafe"
		}
	}
	if cfg.TimeoutMs <= 0 {
		cfg.TimeoutMs = 3000
	}
	if cfg.AutoRejectScoreThreshold <= 0 {
		cfg.AutoRejectScoreThreshold = 1.5
	}
	if cfg.AutoRejectSpamThreshold <= 0 {
		cfg.AutoRejectSpamThreshold = 0.85
	}
	if cfg.AutoReviewScoreThreshold <= 0 {
		cfg.AutoReviewScoreThreshold = 0.8
	}
	if cfg.AutoReviewSpamThreshold <= 0 {
		cfg.AutoReviewSpamThreshold = 0.45
	}

	return cfg
}

// parseJevRuleConfig 解析 Jev 规则配置 JSON 并执行防御性合并与默认兜底
func parseJevRuleConfig(str string, defaultCfg dto.JevRuleConfig) dto.JevRuleConfig {
	if strs.IsBlank(str) {
		return defaultCfg
	}
	cfg := defaultCfg
	if err := jsons.Parse(str, &cfg); err != nil {
		slog.Warn("解析数据库 Jev 规则引擎配置失败，使用默认预设", slog.Any("err", err))
		return defaultCfg
	}
	if cfg.MaxContentLength <= 0 {
		cfg.MaxContentLength = 500
	}
	if cfg.ReviewTimeoutMinutes <= 0 {
		cfg.ReviewTimeoutMinutes = 120
	}
	if strs.IsBlank(cfg.ReviewTimeoutAction) {
		cfg.ReviewTimeoutAction = "pass"
	}
	// 避免反序列化零值陷阱：如果数据库旧版本 JSON 中未定义 autoCreateReport，默认开启工单融合
	if !gjson.Get(str, "autoCreateReport").Exists() {
		cfg.AutoCreateReport = true
	}
	return cfg
}

// GetJevRuleConfig 获取 Jev 细粒度规则引擎编排配置
// 优先从数据库 t_sys_config 读取；若未配置或反序列化失败，则回退到 DefaultJevRuleConfig()
func (s *sysConfigService) GetJevRuleConfig() dto.JevRuleConfig {
	defaultCfg := dto.DefaultJevRuleConfig()
	if sqls.DB() == nil {
		return defaultCfg
	}
	str := cache.SysConfigCache.GetStr(constants.SysConfigJevRuleConfig)
	return parseJevRuleConfig(str, defaultCfg)
}

// SetJevRuleConfig 保存 Jev 细粒度规则引擎编排配置
func (s *sysConfigService) SetJevRuleConfig(cfg dto.JevRuleConfig) error {
	if cfg.MaxContentLength <= 0 {
		cfg.MaxContentLength = 500
	}
	for _, n := range cfg.NoulQuestions {
		if strs.IsBlank(n.Key) {
			return errors.New("Noul 问询的 key 不能为空")
		}
	}
	for _, sc := range cfg.ScoreQuestions {
		if strs.IsBlank(sc.Key) {
			return errors.New("Score 问询的 key 不能为空")
		}
		if len(sc.Criteria) == 0 {
			return errors.New("Score 问询的阶梯标准 criteria 不能为空")
		}
	}
	for _, c := range cfg.ChoiceQuestions {
		if strs.IsBlank(c.Key) {
			return errors.New("Choice 问询的 key 不能为空")
		}
		if len(c.Criteria) == 0 {
			return errors.New("Choice 问询的分类标准 criteria 不能为空")
		}
	}

	val, err := jsons.ToStr(cfg)
	if err != nil {
		return err
	}
	return sqls.DB().Transaction(func(tx *gorm.DB) error {
		return s.setSingle(tx, constants.SysConfigJevRuleConfig, val, "Jev 规则引擎编排配置", "Jev 内容风控模型 State/Noul/Score/Choice 细粒度判定与处置规则")
	})
}

