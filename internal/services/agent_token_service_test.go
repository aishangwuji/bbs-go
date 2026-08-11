package services

import (
	"testing"

	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

func setupAgentTokenTestDB(t *testing.T) {
	t.Helper()
	db := setupTestDB(t)
	if err := db.AutoMigrate(
		&models.AgentToken{},
		&models.AgentTokenApi{},
	); err != nil {
		t.Fatalf("auto migrate agent token: %v", err)
	}
}

func mustCreateAgentToken(t *testing.T, name string, creatorUserId int64) *models.AgentToken {
	t.Helper()
	now := dates.NowTimestamp()
	token := &models.AgentToken{
		TokenHash:     AgentTokenService.HashToken("plain-token-" + name),
		Name:          name,
		CreatorUserId: creatorUserId,
		Status:        constants.StatusOk,
		CreateTime:    now,
		UpdateTime:    now,
	}
	if err := AgentTokenService.Create(token); err != nil {
		t.Fatalf("create agent token: %v", err)
	}
	return token
}

func TestHashToken_DeterministicAndInexorable(t *testing.T) {
	setupAgentTokenTestDB(t)
	h1 := AgentTokenService.HashToken("secret-abc")
	h2 := AgentTokenService.HashToken("secret-abc")
	if h1 != h2 {
		t.Fatalf("hash must be deterministic")
	}
	if len(h1) != 64 {
		t.Fatalf("expected sha256 hex length 64, got %d", len(h1))
	}
	if h1 == "secret-abc" {
		t.Fatalf("token must never be stored as plaintext")
	}
}

func TestGenerateToken_HighEntropy(t *testing.T) {
	setupAgentTokenTestDB(t)
	t1, err := AgentTokenService.GenerateToken()
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	t2, err := AgentTokenService.GenerateToken()
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	if t1 == t2 || len(t1) < 32 {
		t.Fatalf("expected unique high-entropy tokens")
	}
}

func TestAgentToken_LookupAndValidity(t *testing.T) {
	setupAgentTokenTestDB(t)
	user := mustCreateUser(t, dates.NowTimestamp())
	token := mustCreateAgentToken(t, "ops", user.Id)

	got := AgentTokenService.GetByTokenHash(AgentTokenService.HashToken("plain-token-ops"))
	if got == nil || got.Id != token.Id {
		t.Fatalf("expected token found by hash")
	}
	if !AgentTokenService.IsValid(got) {
		t.Fatalf("expected token to be valid")
	}

	// 吊销后无效
	if err := repositories.AgentTokenRepository.UpdateColumn(sqls.DB(), token.Id, "status", constants.StatusDeleted); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	if AgentTokenService.IsValid(AgentTokenService.Get(token.Id)) {
		t.Fatalf("expected revoked token to be invalid")
	}

	// 过期后无效
	if err := repositories.AgentTokenRepository.UpdateColumn(sqls.DB(), token.Id, "status", constants.StatusOk); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if err := repositories.AgentTokenRepository.UpdateColumn(sqls.DB(), token.Id, "expired_at", dates.NowTimestamp()-1); err != nil {
		t.Fatalf("expire: %v", err)
	}
	if AgentTokenService.IsValid(AgentTokenService.Get(token.Id)) {
		t.Fatalf("expected expired token to be invalid")
	}
}

func TestAgentToken_GrantApis_ReplacesWhitelist(t *testing.T) {
	setupAgentTokenTestDB(t)
	user := mustCreateUser(t, dates.NowTimestamp())
	token := mustCreateAgentToken(t, "ops", user.Id)

	err := AgentTokenService.GrantApis(token.Id, []models.AgentTokenApi{
		{Method: "POST", Path: "/api/admin/topic/list"},
		{Method: "GET", Path: "/api/admin/topic/:id"},
	})
	if err != nil {
		t.Fatalf("grant apis: %v", err)
	}
	if !AgentTokenService.HasCapability(token.Id, "POST", "/api/admin/topic/list") {
		t.Fatalf("expected granted capability to pass")
	}
	if AgentTokenService.HasCapability(token.Id, "POST", "/api/admin/topic/delete") {
		t.Fatalf("expected un-granted capability to be denied")
	}

	// 整体覆盖：新授权替换旧授权（白名单收敛）
	if err := AgentTokenService.GrantApis(token.Id, []models.AgentTokenApi{
		{Method: "POST", Path: "/api/admin/topic/delete"},
	}); err != nil {
		t.Fatalf("re-grant apis: %v", err)
	}
	if AgentTokenService.HasCapability(token.Id, "POST", "/api/admin/topic/list") {
		t.Fatalf("expected old grant to be removed after replacement")
	}
	if !AgentTokenService.HasCapability(token.Id, "POST", "/api/admin/topic/delete") {
		t.Fatalf("expected new grant to take effect")
	}
}

func TestAgentToken_Delete_CleansWhitelist(t *testing.T) {
	setupAgentTokenTestDB(t)
	user := mustCreateUser(t, dates.NowTimestamp())
	token := mustCreateAgentToken(t, "ops", user.Id)
	if err := AgentTokenService.GrantApis(token.Id, []models.AgentTokenApi{
		{Method: "POST", Path: "/api/admin/topic/list"},
	}); err != nil {
		t.Fatalf("grant apis: %v", err)
	}

	AgentTokenService.Delete(token.Id)
	if AgentTokenService.Get(token.Id) != nil {
		t.Fatalf("expected token deleted")
	}
	if len(AgentTokenService.GetGrantedApis(token.Id)) != 0 {
		t.Fatalf("expected whitelist cleaned after delete")
	}
}
