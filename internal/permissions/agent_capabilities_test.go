package permissions

import "testing"

func TestBuildAgentCapabilitiesIncludesPermissionMappedAdminRoutes(t *testing.T) {
	routes := []RouteEntry{
		{Method: "POST", Path: "/api/admin/topic/list"},
		{Method: "POST", Path: "/api/admin/topic/recommend"},
		{Method: "GET", Path: "/api/admin/topic/:id"},
	}
	caps := BuildAgentCapabilities(routes)
	if len(caps) != len(routes) {
		t.Fatalf("expected %d capabilities, got %d", len(routes), len(caps))
	}
	if caps[0].Method != "POST" || caps[0].Path != "/api/admin/topic/list" {
		t.Fatalf("unexpected capability: %#v", caps[0])
	}
	if len(caps[0].PermissionCodes) == 0 {
		t.Fatalf("expected permission codes to be resolved for topic list")
	}
}

func TestBuildAgentCapabilitiesExcludesAgentTokenManagement(t *testing.T) {
	routes := []RouteEntry{
		{Method: "POST", Path: "/api/admin/topic/list"},
		{Method: "GET", Path: "/api/admin/agent-token/capabilities"},
		{Method: "POST", Path: "/api/admin/agent-token/create"},
		{Method: "GET", Path: "/api/admin/agent-token/5/apis"},
	}
	caps := BuildAgentCapabilities(routes)
	if len(caps) != 1 {
		t.Fatalf("expected only the non-managed capability, got %d: %#v", len(caps), caps)
	}
}

func TestBuildAgentCapabilitiesSkipsUnmappedAndNonAdminRoutes(t *testing.T) {
	routes := []RouteEntry{
		{Method: "GET", Path: "/api/topic/recent"},   // 非管理端
		{Method: "GET", Path: "/api/admin/unknown/x"}, // 无权限映射
	}
	caps := BuildAgentCapabilities(routes)
	if len(caps) != 0 {
		t.Fatalf("expected 0 capabilities, got %d", len(caps))
	}
}

func TestGetAgentCapabilityAfterSet(t *testing.T) {
	routes := []RouteEntry{
		{Method: "GET", Path: "/api/admin/badge/:id"},
	}
	SetAgentCapabilities(BuildAgentCapabilities(routes))

	cap := GetAgentCapability("GET", "/api/admin/badge/:id")
	if cap == nil {
		t.Fatalf("expected capability to be found")
	}
	if cap.Method != "GET" || cap.Path != "/api/admin/badge/:id" {
		t.Fatalf("unexpected capability: %#v", cap)
	}
	if GetAgentCapability("POST", "/api/admin/badge/:id") != nil {
		t.Fatalf("method mismatch should not be found")
	}
	if GetAgentCapability("GET", "/api/admin/badge/1") != nil {
		t.Fatalf("exact template path match required")
	}
	SetAgentCapabilities(nil)
}
