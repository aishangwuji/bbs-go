package admin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/permissions"
	"bbs-go/internal/pkg/common"
	"bbs-go/internal/pkg/config"
	"bbs-go/internal/repositories"
	"bbs-go/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

func setupAgentTokenHandlerTest(t *testing.T) *gorm.DB {
	t.Helper()

	prev := config.Instance
	t.Cleanup(func() { config.Instance = prev })
	config.Instance = &config.Config{Language: config.DefaultLanguage}

	permissions.SetAgentCapabilities([]permissions.AgentCapabilityExt{
		{
			AgentCapability: permissions.AgentCapability{Method: "POST", Path: "/api/admin/topic/list"},
			PermissionCodes: []string{permissions.PermissionTopicView.Code},
			NameZh:          "查看话题",
			NameEn:          "View Topics",
		},
		{
			AgentCapability: permissions.AgentCapability{Method: "POST", Path: "/api/admin/user/reset_password"},
			PermissionCodes: []string{permissions.PermissionUserResetPassword.Code},
			NameZh:          "重置用户密码",
			NameEn:          "Reset User Password",
		},
	})
	t.Cleanup(func() { permissions.SetAgentCapabilities(nil) })

	dsn := fmt.Sprintf("file:agent_token_handler_%d?mode=memory&cache=shared&_fk=1", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "t_",
			SingularTable: true,
		},
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	sqls.SetDB(db)

	if err := db.AutoMigrate(&models.User{}, &models.AgentToken{}, &models.AgentTokenApi{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	return db
}

func mustCreateAdmin(t *testing.T, db *gorm.DB, id int64, nickname, roles string) *models.User {
	t.Helper()
	now := time.Now().UnixMilli()
	user := &models.User{
		Model:      models.Model{Id: id},
		Nickname:   nickname,
		Roles:      roles,
		Status:     constants.StatusOk,
		CreateTime: now,
		UpdateTime: now,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}
	return user
}

func mustCreateAgentTokenForHandler(t *testing.T, id int64, creatorUserId int64) *models.AgentToken {
	t.Helper()
	now := time.Now().UnixMilli()
	token := &models.AgentToken{
		Model:         models.Model{Id: id},
		TokenHash:     services.AgentTokenService.HashToken("handler-test-token"),
		Name:          "t",
		CreatorUserId: creatorUserId,
		Status:        constants.StatusOk,
		CreateTime:    now,
		UpdateTime:    now,
	}
	if err := repositories.AgentTokenRepository.Create(sqls.DB(), token); err != nil {
		t.Fatalf("create agent token: %v", err)
	}
	return token
}

type grantResult struct {
	Success   bool   `json:"success"`
	ErrorCode int    `json:"errorCode"`
	Message   string `json:"message"`
}

func postAgentTokenGrant(t *testing.T, body string, currentUser *models.User) grantResult {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/agent-token/grant", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req

	// 模拟 AdminMiddleware 注入的当前用户
	common.SetCurrentUser(ctx, currentUser)

	AgentTokenGrant(ctx)

	var result grantResult
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response %q: %v", w.Body.String(), err)
	}
	return result
}

func TestAgentTokenList_PagesWithoutPanic(t *testing.T) {
	db := setupAgentTokenHandlerTest(t)
	owner := mustCreateAdmin(t, db, 1, "owner", constants.RoleOwner)
	mustCreateAgentTokenForHandler(t, 1, owner.Id)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/admin/agent-token/list?page=1&limit=10", nil)
	common.SetCurrentUser(ctx, owner)

	AgentTokenList(ctx)

	var result struct {
		Success bool `json:"success"`
		Data    struct {
			Results []map[string]interface{} `json:"results"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response %q: %v", w.Body.String(), err)
	}
	if !result.Success {
		t.Fatalf("expected success, got %s", w.Body.String())
	}
	if len(result.Data.Results) != 1 {
		t.Fatalf("expected 1 token in list, got %d", len(result.Data.Results))
	}
}

func TestAgentTokenGrant_OwnerCanGrantRegisteredCapability(t *testing.T) {
	db := setupAgentTokenHandlerTest(t)
	owner := mustCreateAdmin(t, db, 1, "owner", constants.RoleOwner)
	mustCreateAgentTokenForHandler(t, 1, owner.Id)

	result := postAgentTokenGrant(t, `{"id":1,"apis":[{"method":"POST","path":"/api/admin/topic/list"}]}`, owner)
	if !result.Success {
		t.Fatalf("expected grant success, got %s (code=%d)", result.Message, result.ErrorCode)
	}
	if !services.AgentTokenService.HasCapability(1, "POST", "/api/admin/topic/list") {
		t.Fatalf("expected capability to be persisted in whitelist")
	}
}

func TestAgentTokenGrant_RejectsUnregisteredCapability(t *testing.T) {
	db := setupAgentTokenHandlerTest(t)
	owner := mustCreateAdmin(t, db, 1, "owner", constants.RoleOwner)
	mustCreateAgentTokenForHandler(t, 1, owner.Id)

	result := postAgentTokenGrant(t, `{"id":1,"apis":[{"method":"POST","path":"/api/admin/fake/endpoint"}]}`, owner)
	if result.Success {
		t.Fatalf("expected unknown capability to be rejected")
	}
	if !strings.Contains(result.Message, "unknown capability") {
		t.Fatalf("expected unknown capability message, got %s", result.Message)
	}
}

func TestAgentTokenGrant_RejectsCapabilityOutsideAdminsScope(t *testing.T) {
	db := setupAgentTokenHandlerTest(t)
	// 普通管理员（无 owner、无任何权限）：不得越权把能力授给 Agent
	admin := mustCreateAdmin(t, db, 2, "editor", "")
	mustCreateAgentTokenForHandler(t, 1, admin.Id)

	result := postAgentTokenGrant(t, `{"id":1,"apis":[{"method":"POST","path":"/api/admin/user/reset_password"}]}`, admin)
	if result.Success {
		t.Fatalf("expected out-of-scope grant to be rejected")
	}
	if result.ErrorCode != 2 {
		t.Fatalf("expected errorCode 2 (no permission), got %d", result.ErrorCode)
	}
	if services.AgentTokenService.HasCapability(1, "POST", "/api/admin/user/reset_password") {
		t.Fatalf("expected capability NOT to be persisted")
	}
}

func TestAgentTokenCapabilities_FiltersByAdminsScope(t *testing.T) {
	db := setupAgentTokenHandlerTest(t)
	owner := mustCreateAdmin(t, db, 1, "owner", constants.RoleOwner)
	mustCreateAgentTokenForHandler(t, 1, owner.Id)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/admin/agent-token/capabilities?tokenId=1", nil)
	common.SetCurrentUser(ctx, owner)

	AgentTokenCapabilities(ctx)

	var result struct {
		Success bool                          `json:"success"`
		Data    []map[string]interface{}      `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response %q: %v", w.Body.String(), err)
	}
	if !result.Success {
		t.Fatalf("expected success, got %s", w.Body.String())
	}
	if len(result.Data) != 2 {
		t.Fatalf("expected owner to see all 2 capabilities, got %d", len(result.Data))
	}
}
