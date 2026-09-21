package admin

import (
	"bbs-go/internal/models/dto"
	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/services"
	"strings"

	"github.com/gin-gonic/gin"
)

// JevRuleGet 获取 Jev 细粒度规则引擎配置
func JevRuleGet(ctx *gin.Context) {
	cfg := services.SysConfigService.GetJevRuleConfig()
	ginx.WriteJSON(ctx, cfg)
}

// JevRuleSave 保存 Jev 细粒度规则引擎配置
func JevRuleSave(ctx *gin.Context) {
	var req dto.JevRuleConfig
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	if err := services.SysConfigService.SetJevRuleConfig(req); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	ginx.WriteJSON(ctx, nil)
}

// JevRuleSimulateReq 规则仿真沙盒请求参数
type JevRuleSimulateReq struct {
	Title   string             `json:"title"`
	Content string             `json:"content"`
	RuleCfg *dto.JevRuleConfig `json:"ruleCfg,omitempty"` // 可选自定义规则，支持未保存时即时预览
}

// JevRuleSimulateResponse 规则仿真沙盒响应结果
type JevRuleSimulateResponse struct {
	Decision    *services.ModerationDecision `json:"decision"`
	RawResponse string                       `json:"rawResponse"`
}

// JevRuleSimulate 在线仿真沙盒测试接口
func JevRuleSimulate(ctx *gin.Context) {
	var req JevRuleSimulateReq
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	if strings.TrimSpace(req.Content) == "" {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("仿真评测内容不能为空"))
		return
	}

	decision, _, err := services.ModerationService.Simulate(ctx.Request.Context(), req.Title, req.Content, req.RuleCfg)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("仿真评测失败: "+err.Error()))
		return
	}

	ginx.WriteJSON(ctx, &JevRuleSimulateResponse{
		Decision:    decision,
		RawResponse: decision.RawResponse,
	})
}
