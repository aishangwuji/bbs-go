package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/pkg/config"
	"bbs-go/internal/repositories"
	"bbs-go/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

func setupAgentGatewayTest(t *testing.T) *gorm.DB {
	t.Helper()

	prev := config.Instance
	t.Cleanup(func() {
		config.Instance = prev
	})

	config.Instance = &config.Config{
		Language:  config.DefaultLanguage,
		Installed: true,
		Search:    config.SearchConfig{IndexPath: filepath.Join(t.TempDir(), "index")},
	}

	dsn := fmt.Sprintf("file:agent_gateway_%d?mode=memory&cache=shared&_fk=1", time.Now().UnixNano())
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

	if err := db.AutoMigrate(
		&models.User{},
		&models.AgentToken{},
		&models.AgentTokenApi{},
		&models.OperateLog{},
		&models.Topic{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	return db
}

func mustCreateGatewayUser(t *testing.T) *models.User {
	t.Helper()
	now := dates.NowTimestamp()
	user := &models.User{
		Nickname:   "owner",
		Status:     constants.StatusOk,
		CreateTime: now,
		UpdateTime: now,
	}
	if err := repositories.UserRepository.Create(sqls.DB(), user); err != nil {
		t.Fatalf("create user: %v", err)
	}
	return user
}

func mustCreateGatewayToken(t *testing.T, plainToken string, creatorUserId int64) *models.AgentToken {
	t.Helper()
	now := dates.NowTimestamp()
	token := &models.AgentToken{
		TokenHash:     services.AgentTokenService.HashToken(plainToken),
		Name:          "test-agent",
		CreatorUserId: creatorUserId,
		Status:        constants.StatusOk,
		CreateTime:    now,
		UpdateTime:    now,
	}
	if err := services.AgentTokenService.Create(token); err != nil {
		t.Fatalf("create agent token: %v", err)
	}
	return token
}

type envelope struct {
	Success   bool            `json:"success"`
	ErrorCode int             `json:"errorCode"`
	Message   string          `json:"message"`
	Data      json.RawMessage `json:"data"`
}

func doAgentRequest(t *testing.T, app http.Handler, method, path, token string) (int, envelope) {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if token != "" {
		req.Header.Set("X-agent-token", token)
	}
	rec := httptest.NewRecorder()
	app.ServeHTTP(rec, req)
	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode envelope: %v (body=%s)", err, rec.Body.String())
	}
	return rec.Code, env
}

func TestAgentRoutesRegisteredFromAdminRoutesExcludingManagement(t *testing.T) {
	app := newRouter()
	routes := map[string]struct{}{}
	for _, r := range app.Routes() {
		routes[r.Method+" "+r.Path] = struct{}{}
	}
	for _, want := range []string{
		"GET /api/agent/me",
		"POST /api/agent/topic/list",
		"GET /api/agent/topic/:id",
		"GET /api/agent/badge/:id",
	} {
		if _, ok := routes[want]; !ok {
			t.Fatalf("agent route %q not registered", want)
		}
	}
	for _, notWant := range []string{
		"GET /api/agent/agent-token/capabilities",
		"POST /api/agent/agent-token/create",
		"POST /api/agent/agent-token/grant",
	} {
		if _, ok := routes[notWant]; ok {
			t.Fatalf("agent token management route %q must NOT be exposed", notWant)
		}
	}
}

func TestAgentMeRequiresToken(t *testing.T) {
	setupAgentGatewayTest(t)
	app := newRouter()

	_, env := doAgentRequest(t, app, http.MethodGet, "/api/agent/me", "")
	if env.Success {
		t.Fatalf("expected rejection without token")
	}
	if env.ErrorCode != 1 {
		t.Fatalf("expected errorCode 1 (not login), got %d", env.ErrorCode)
	}
}

func TestAgentMeRejectsUnknownToken(t *testing.T) {
	setupAgentGatewayTest(t)
	app := newRouter()

	_, env := doAgentRequest(t, app, http.MethodGet, "/api/agent/me", "deadbeef-deadbeef-deadbeef")
	if env.Success {
		t.Fatalf("expected rejection for unknown token")
	}
}

func TestAgentMeReturnsGrantedCapabilities(t *testing.T) {
	setupAgentGatewayTest(t)
	user := mustCreateGatewayUser(t)
	token := mustCreateGatewayToken(t, "plain-secret-1234567890abcdef", user.Id)
	if err := services.AgentTokenService.GrantApis(token.Id, []models.AgentTokenApi{
		{Method: "POST", Path: "/api/admin/topic/list"},
		{Method: "GET", Path: "/api/admin/topic/:id"},
	}); err != nil {
		t.Fatalf("grant: %v", err)
	}
	app := newRouter()

	_, env := doAgentRequest(t, app, http.MethodGet, "/api/agent/me", "plain-secret-1234567890abcdef")
	if !env.Success {
		t.Fatalf("expected success, got %s", env.Message)
	}
	var data struct {
		Token        struct{ Name string `json:"name"` } `json:"token"`
		Capabilities []struct {
			Method string `json:"method"`
			Path   string `json:"path"`
			Name   string `json:"name"`
		} `json:"capabilities"`
	}
	if err := json.Unmarshal(env.Data, &data); err != nil {
		t.Fatalf("decode data: %v", err)
	}
	if data.Token.Name != "test-agent" {
		t.Fatalf("unexpected token name: %s", data.Token.Name)
	}
	if len(data.Capabilities) != 2 {
		t.Fatalf("expected 2 granted capabilities, got %d", len(data.Capabilities))
	}
	if data.Capabilities[0].Name == "" {
		t.Fatalf("expected capability display name to be resolved")
	}
}

func TestAgentCapabilityDeniedWithoutGrant(t *testing.T) {
	setupAgentGatewayTest(t)
	user := mustCreateGatewayUser(t)
	mustCreateGatewayToken(t, "plain-secret-1234567890abcdef", user.Id)
	app := newRouter()

	_, env := doAgentRequest(t, app, http.MethodPost, "/api/agent/topic/list", "plain-secret-1234567890abcdef")
	if env.Success {
		t.Fatalf("expected denial for un-granted capability")
	}
	if env.ErrorCode != 2 {
		t.Fatalf("expected errorCode 2 (no permission), got %d", env.ErrorCode)
	}
}

func TestAgentCapabilityAllowedWithGrant(t *testing.T) {
	setupAgentGatewayTest(t)
	user := mustCreateGatewayUser(t)
	token := mustCreateGatewayToken(t, "plain-secret-1234567890abcdef", user.Id)
	if err := services.AgentTokenService.GrantApis(token.Id, []models.AgentTokenApi{
		{Method: "POST", Path: "/api/admin/topic/list"},
	}); err != nil {
		t.Fatalf("grant: %v", err)
	}
	app := newRouter()

	_, env := doAgentRequest(t, app, http.MethodPost, "/api/agent/topic/list", "plain-secret-1234567890abcdef")
	if !env.Success {
		t.Fatalf("expected granted call to reach handler, got message=%s", env.Message)
	}
	if !strings.Contains(string(env.Data), "results") {
		t.Fatalf("expected page result payload, got %s", string(env.Data))
	}
}

func TestAgentTokenRevokedRejectsAllCalls(t *testing.T) {
	setupAgentGatewayTest(t)
	user := mustCreateGatewayUser(t)
	token := mustCreateGatewayToken(t, "plain-secret-1234567890abcdef", user.Id)
	if err := services.AgentTokenService.GrantApis(token.Id, []models.AgentTokenApi{
		{Method: "POST", Path: "/api/admin/topic/list"},
	}); err != nil {
		t.Fatalf("grant: %v", err)
	}
	if err := repositories.AgentTokenRepository.UpdateColumn(sqls.DB(), token.Id, "status", constants.StatusDeleted); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	app := newRouter()

	_, env := doAgentRequest(t, app, http.MethodPost, "/api/agent/topic/list", "plain-secret-1234567890abcdef")
	if env.Success {
		t.Fatalf("expected revoked token to be rejected")
	}
	if env.ErrorCode != 1 {
		t.Fatalf("expected errorCode 1, got %d", env.ErrorCode)
	}
}
