package server

import (
	"strings"

	"bbs-go/internal/middleware"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/permissions"
	"bbs-go/internal/pkg/errs"
	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/services"

	"github.com/gin-gonic/gin"
)

// registerAgentRoutes 在 router 构建时调用：
//  1. 从已注册的管理端路由表快照派生「Agent 能力集」（单一数据源：gin 路由表 + adminPermissionRules）
//  2. 为每个能力自动注册 /api/agent/** 路由 —— 新接口部署后自动出现在能力集中，且默认不在任何令牌白名单内
//  3. 注册 /api/agent/me 自描述接口（无需授权，仅返回令牌自身信息与已获授权的能力）
func registerAgentRoutes(app *gin.Engine, apiGroup *gin.RouterGroup) {
	adminHandlerMap := map[string]gin.HandlerFunc{}
	adminRoutes := make([]permissions.RouteEntry, 0)
	for _, route := range app.Routes() {
		if !strings.HasPrefix(route.Path, "/api/admin/") {
			continue
		}
		adminRoutes = append(adminRoutes, permissions.RouteEntry{Method: route.Method, Path: route.Path})
		adminHandlerMap[strings.ToUpper(route.Method)+" "+route.Path] = route.HandlerFunc
	}

	caps := permissions.BuildAgentCapabilities(adminRoutes)
	permissions.SetAgentCapabilities(caps)

	agentGroup := apiGroup.Group("/agent", middleware.AgentTokenMiddleware)
	agentGroup.GET("/me", agentMeHandler)

	// agentGroup 已含 /agent 前缀，故此处只用相对路径
	for _, cap := range caps {
		agentPath := strings.TrimPrefix(cap.Path, "/api/admin")
		if agentPath == "/me" {
			continue
		}
		handler := adminHandlerMap[cap.Method+" "+cap.Path]
		if handler == nil {
			continue
		}
		agentGroup.Handle(cap.Method, agentPath, agentCapabilityHandler(cap.Method, cap.Path, handler))
	}
}

// agentCapabilityHandler 白名单网关：令牌必须先被授予该能力（method+path），否则 403。
func agentCapabilityHandler(method, path string, handler gin.HandlerFunc) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		agentToken := middleware.GetCurrentAgentToken(ctx)
		if agentToken == nil {
			ginx.WriteJSON(ctx, errs.NotLogin())
			ctx.Abort()
			return
		}
		if !services.AgentTokenService.HasCapability(agentToken.Id, method, path) {
			ginx.WriteJSON(ctx, errs.NoPermission())
			ctx.Abort()
			return
		}
		// 审计：仅对变更型调用（非 GET）记录操作日志，避免读接口刷屏
		if method != "GET" {
			services.OperateLogService.AddOperateLog(
				agentToken.CreatorUserId, constants.OpTypeUpdate, constants.EntityAgent,
				agentToken.Id, "[agent:"+agentToken.Name+"] "+method+" "+path, ctx.Request)
		}
		handler(ctx)
	}
}

type agentGrantedApiVO struct {
	Method string `json:"method"`
	Path   string `json:"path"`
	Name   string `json:"name"`
}

// agentMeHandler 返回令牌自身信息与已授权能力清单（Agent 发现能力的唯一入口）。
func agentMeHandler(ctx *gin.Context) {
	agentToken := middleware.GetCurrentAgentToken(ctx)
	if agentToken == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	apis := services.AgentTokenService.GetGrantedApis(agentToken.Id)
	granted := make([]agentGrantedApiVO, 0, len(apis))
	for _, api := range apis {
		vo := agentGrantedApiVO{Method: api.Method, Path: api.Path}
		if cap := permissions.GetAgentCapability(api.Method, api.Path); cap != nil {
			vo.Name = cap.NameZh
		}
		granted = append(granted, vo)
	}
	ginx.WriteJSON(ctx, gin.H{
		"token": gin.H{
			"id":         agentToken.Id,
			"name":       agentToken.Name,
			"remark":     agentToken.Remark,
			"status":     agentToken.Status,
			"expiredAt":  agentToken.ExpiredAt,
			"createTime": agentToken.CreateTime,
		},
		"capabilities": granted,
	})
}
