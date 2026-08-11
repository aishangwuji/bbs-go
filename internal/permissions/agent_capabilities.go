package permissions

import "strings"

// AgentCapability 描述一个可授权给 Agent 的管理端接口能力。
// Path 使用 gin 路由模板（如 /api/admin/topic/:id），与前端真实调用路径一一对应。
type AgentCapability struct {
	Method string // HTTP 方法
	Path   string // 管理端路径模板
}

// AgentCapabilityExt 是供管理端 UI / Agent 发现接口使用的扩展描述（由注册表补充）。
type AgentCapabilityExt struct {
	AgentCapability
	PermissionCodes []string // 关联的管理端权限码
	NameZh          string   // 展示名（中文）
	NameEn          string   // 展示名（英文）
}

// agentCapabilities 由 server 在启动时根据已注册的管理端路由构建。
// 单一数据源：路由注册表（gin 路由表）+ adminPermissionRules，不在别处维护副本。
var agentCapabilities []AgentCapabilityExt

// SetAgentCapabilities 由 server 启动时调用，注入全部可暴露给 Agent 的能力。
func SetAgentCapabilities(caps []AgentCapabilityExt) {
	agentCapabilities = caps
}

// GetAgentCapabilities 返回全部可暴露能力（注册顺序）。
func GetAgentCapabilities() []AgentCapabilityExt {
	return agentCapabilities
}

// GetAgentCapability 按方法+路径查找能力；未注册返回 nil。
func GetAgentCapability(method, path string) *AgentCapabilityExt {
	for i := range agentCapabilities {
		c := &agentCapabilities[i]
		if strings.EqualFold(c.Method, method) && c.Path == path {
			return c
		}
	}
	return nil
}

// BuildAgentCapabilities 从 gin 路由表 + 权限注册表派生能力集。
// 仅暴露 /api/admin/**，且硬性排除 Agent 令牌管理（防自提权）与其他系统级管理组。
func BuildAgentCapabilities(routes []RouteEntry) []AgentCapabilityExt {
	excludedPrefixes := []string{
		"/api/admin/agent-token", // 令牌分发/授权接口，绝不对 Agent 开放（防自提权）
	}
	caps := make([]AgentCapabilityExt, 0, len(routes))
	for _, route := range routes {
		if !strings.HasPrefix(route.Path, "/api/admin/") {
			continue
		}
		excluded := false
		for _, prefix := range excludedPrefixes {
			if strings.HasPrefix(route.Path, prefix) {
				excluded = true
				break
			}
		}
		if excluded {
			continue
		}
		codes, ok := GetAdminPermissionCodes(route.Method, route.Path)
		if !ok {
			continue
		}
		caps = append(caps, AgentCapabilityExt{
			AgentCapability: AgentCapability{
				Method: strings.ToUpper(route.Method),
				Path:   route.Path,
			},
			PermissionCodes: codes,
			NameZh:          permissionNames(codes, false),
			NameEn:          permissionNames(codes, true),
		})
	}
	return caps
}

func permissionNames(codes []string, en bool) string {
	var names []string
	for _, code := range codes {
		if def, ok := FindByCode(code); ok {
			if en {
				names = append(names, def.NameEn)
			} else {
				names = append(names, def.NameZh)
			}
		}
	}
	return strings.Join(names, ", ")
}

// RouteEntry 描述一条路由，由 server 层从 gin.RouteInfo 填充，避免 permissions 依赖 gin。
type RouteEntry struct {
	Method string
	Path   string
}
