package middleware

import (
	"bbs-go/internal/models"
	"bbs-go/internal/pkg/common"
	"bbs-go/internal/pkg/errs"
	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/common/strs"
)

const (
	currentAgentTokenKey = "__current_agent_token"
	// AgentTokenHeader 网关使用的令牌请求头。令牌明文只出现在请求头中，日志与库中均为哈希。
	AgentTokenHeader = "X-agent-token"
)

func SetCurrentAgentToken(ctx *gin.Context, token *models.AgentToken) {
	ctx.Set(currentAgentTokenKey, token)
}

func GetCurrentAgentToken(ctx *gin.Context) *models.AgentToken {
	if v, exists := ctx.Get(currentAgentTokenKey); exists {
		if t, ok := v.(*models.AgentToken); ok {
			return t
		}
	}
	return nil
}

// AgentTokenMiddleware 校验 X-agent-token：
//  1. 令牌存在且有效（状态正常、未过期）
//  2. 创建人账户仍存在（否则拒绝，避免“创建人已删除但令牌仍可用”的僵尸授权）
//  3. 将创建人置为当前用户，供底层管理 handler 的操作日志/operator 使用
func AgentTokenMiddleware(ctx *gin.Context) {
	token := ctx.GetHeader(AgentTokenHeader)
	if strs.IsBlank(token) {
		ginx.WriteJSON(ctx, errs.NotLogin())
		ctx.Abort()
		return
	}

	agentToken := services.AgentTokenService.GetByTokenHash(services.AgentTokenService.HashToken(token))
	if !services.AgentTokenService.IsValid(agentToken) {
		ginx.WriteJSON(ctx, errs.NotLogin())
		ctx.Abort()
		return
	}

	creator := services.UserService.Get(agentToken.CreatorUserId)
	if creator == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		ctx.Abort()
		return
	}

	SetCurrentAgentToken(ctx, agentToken)
	common.SetCurrentUser(ctx, creator)
	services.AgentTokenService.TouchLastUsed(agentToken.Id)
	ctx.Next()
}
