package admin

import (
	"context"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/pkg/jev"
	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/sqls"
	"github.com/mlogclub/simple/web"

	"bbs-go/internal/cache"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/models/dto"
	"bbs-go/internal/services"
)

func SysConfigDetail(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	t := services.SysConfigService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Not found, id="+strconv.FormatInt(id, 10)))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func SysConfigList(ctx *gin.Context) {
	list, paging := services.SysConfigService.FindPageByParams(params.NewQueryParams(ctx).PageByReq().Desc("id"))
	ginx.WriteJSON(ctx, &web.PageResult{Results: list, Page: paging})

}

func SysConfigConfigs(ctx *gin.Context) {

	resp := &dto.SysConfigAdminResponse{
		SiteTitle:                  cache.SysConfigCache.GetStr(constants.SysConfigSiteTitle),
		SiteDescription:            cache.SysConfigCache.GetStr(constants.SysConfigSiteDescription),
		BaseURL:                    services.SysConfigService.GetBaseURL(),
		SiteKeywords:               cache.SysConfigCache.GetStrArr(constants.SysConfigSiteKeywords),
		SiteLogo:                   cache.SysConfigCache.GetStr(constants.SysConfigSiteLogo),
		SiteNavs:                   services.SysConfigService.GetSiteNavs(),
		SiteNotification:           cache.SysConfigCache.GetStr(constants.SysConfigSiteNotification),
		AboutPageConfig:            services.SysConfigService.GetAboutPageConfig(),
		FooterLinks:                services.SysConfigService.GetFooterLinks(),
		LinkPageConfig:             services.SysConfigService.GetLinkPageConfig(),
		SignatureMinLevel:          services.SysConfigService.GetSignatureMinLevel(),
		RecommendTags:              cache.SysConfigCache.GetStrArr(constants.SysConfigRecommendTags),
		UrlRedirect:                services.SysConfigService.IsUrlRedirect(),
		DefaultCategoryId:          services.SysConfigService.GetDefaultCategoryId(),
		TopicListStyle:             services.SysConfigService.GetTopicListStyle(),
		ArticlePending:             services.SysConfigService.IsArticlePending(),
		TopicCaptcha:               services.SysConfigService.IsTopicCaptcha(),
		TopicPending:               services.SysConfigService.IsTopicPending(),
		UserObserveSeconds:         cache.SysConfigCache.GetInt(constants.SysConfigUserObserveSeconds),
		TokenExpireDays:            services.SysConfigService.GetTokenExpireDays(),
		CreateTopicEmailVerified:   services.SysConfigService.IsCreateTopicEmailVerified(),
		CreateArticleEmailVerified: services.SysConfigService.IsCreateArticleEmailVerified(),
		CreateCommentEmailVerified: services.SysConfigService.IsCreateCommentEmailVerified(),
		EnableHideContent:          services.SysConfigService.IsEnableHideContent(),
		EnableQaBounty:             services.SysConfigService.IsEnableQaBounty(),
		QaBountyMin:                services.SysConfigService.GetQaBountyMin(),
		QaBountyMax:                services.SysConfigService.GetQaBountyMax(),
		QaBountyRequired:           services.SysConfigService.IsQaBountyRequired(),
		Modules:                    services.SysConfigService.GetModules(),
		EmailWhitelist:             services.SysConfigService.GetEmailWhitelist(),
		EmailNoticeIntervalSeconds: services.SysConfigService.GetEmailNoticeIntervalSeconds(),
		NotificationTypes:          services.SysConfigService.GetNotificationTypes(),
		LoginConfig:                services.SysConfigService.GetLoginConfig(),
		SmtpConfig:                 services.SysConfigService.GetSmtpConfig(),
		UploadConfig:               services.SysConfigService.GetUploadConfig(),
		AttachmentConfig:           services.SysConfigService.GetAttachmentConfig(),
		ScriptInjections:           services.SysConfigService.GetScriptInjections(),
		JevConfig:                  services.SysConfigService.GetJevConfig(),
	}
	if strs.IsBlank(resp.SiteLogo) {
		resp.SiteLogo = "/res/images/logo.png"
	}
	ginx.WriteJSON(ctx, resp)

}

func SysConfigSave(ctx *gin.Context) {
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	if err := services.SysConfigService.SetAll(string(body)); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

// SysConfigTestJevReq 接口连通性测试请求载荷
type SysConfigTestJevReq struct {
	Provider  string `json:"provider"`
	Endpoint  string `json:"endpoint"`
	ApiKey    string `json:"apiKey"`
	Model     string `json:"model"`
	TimeoutMs int    `json:"timeoutMs"`
}

// SysConfigTestJev 测试 Jev / OpenRouter 智能内容风控接口连通性
func SysConfigTestJev(ctx *gin.Context) {
	var req SysConfigTestJevReq
	_ = ginx.Bind(ctx, &req)

	var savedCfg dto.JevConfig
	if sqls.DB() != nil {
		savedCfg = services.SysConfigService.GetJevConfig()
	}

	endpoint := strings.TrimSpace(req.Endpoint)
	if endpoint == "" {
		endpoint = savedCfg.Endpoint
	}
	if endpoint == "" {
		endpoint = "https://openrouter.ai/api/alpha/decisions"
	}

	apiKey := strings.TrimSpace(req.ApiKey)
	if apiKey == "" {
		apiKey = savedCfg.ApiKey
	}
	if apiKey == "" {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("请先填写 API Key 再进行连通性测试"))
		return
	}

	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = savedCfg.Model
	}
	if model == "" {
		model = "~typesafe/jev-latest"
	}

	timeoutMs := req.TimeoutMs
	if timeoutMs <= 0 {
		timeoutMs = savedCfg.TimeoutMs
	}
	if timeoutMs <= 0 {
		timeoutMs = 5000
	}

	timeout := time.Duration(timeoutMs) * time.Millisecond
	client := jev.NewClient(endpoint, apiKey, timeout)
	if client == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("无法创建 Jev 客户端实例"))
		return
	}

	reqPayload := &jev.SystemOneRequest{
		Model: model,
		State: map[string]string{
			"text": "Antigravity connectivity ping test",
		},
		Questions: map[string]jev.Question{
			"ping": {
				Type:         jev.TypeNoul,
				Instructions: "Is this text in English language?",
			},
		},
	}

	start := time.Now()
	testCtx, cancel := context.WithTimeout(ctx.Request.Context(), timeout)
	defer cancel()

	resp, err := client.Evaluate(testCtx, reqPayload)
	latency := time.Since(start).Milliseconds()

	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(fmt.Sprintf("连通性测试失败: %v (耗时: %dms)", err, latency)))
		return
	}

	ginx.WriteJSON(ctx, gin.H{
		"message":   fmt.Sprintf("连通性测试成功！响应耗时: %dms", latency),
		"latencyMs": latency,
		"model":     model,
		"endpoint":  endpoint,
		"response":  resp,
	})
}
