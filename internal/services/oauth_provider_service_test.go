package services

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	"bbs-go/internal/cache"
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/common/passwd"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

func setupOAuthTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:oauth_test_%d?mode=memory&cache=shared&_fk=1", time.Now().UnixNano())
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
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})

	sqls.SetDB(db)

	if err := db.AutoMigrate(
		&models.User{},
		&models.OAuthClient{},
		&models.OAuthToken{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	return db
}

func TestOAuthProviderService_ValidateRedirectUri(t *testing.T) {
	client := &models.OAuthClient{
		ClientId:     "hnw_test_client",
		RedirectUris: "https://tools.originagent.cn/callback,https://originagent.cn/callback",
	}

	// 1. 合法白名单地址
	if err := OAuthProviderService.ValidateRedirectUri(client, "https://tools.originagent.cn/callback"); err != nil {
		t.Fatalf("expected valid redirect uri, got error: %v", err)
	}

	// 2. 带空格的合法地址
	if err := OAuthProviderService.ValidateRedirectUri(client, " https://originagent.cn/callback "); err != nil {
		t.Fatalf("expected valid trimmed redirect uri, got error: %v", err)
	}

	// 3. 非法地址（钓鱼域名）
	if err := OAuthProviderService.ValidateRedirectUri(client, "https://tools.originagent.cn.evil.com/callback"); err == nil {
		t.Fatalf("expected error for open redirect phishing URL, got nil")
	}

	// 4. 空地址
	if err := OAuthProviderService.ValidateRedirectUri(client, ""); err == nil {
		t.Fatalf("expected error for empty redirect uri, got nil")
	}
}

func TestOAuthProviderService_Flow(t *testing.T) {
	db := setupOAuthTestDB(t)

	// 1. 创建测试用户
	testUser := &models.User{
		Username:      sql.NullString{String: "aswj_captain", Valid: true},
		Nickname:      "北向船长",
		Email:         sql.NullString{String: "captain@originagent.cn", Valid: true},
		EmailVerified: true,
		Avatar:        "https://originagent.cn/avatar.png",
		Status:        constants.StatusOk,
		CreateTime:    dates.NowTimestamp(),
	}
	if err := repositories.UserRepository.Create(db, testUser); err != nil {
		t.Fatalf("create test user: %v", err)
	}
	cache.UserCache.Invalidate(testUser.Id)

	// 2. 创建 OAuth 客户端（Secret 用 passwd 哈希存储）
	rawSecret := "sec_test_123456"
	hashedSecret := passwd.EncodePassword(rawSecret)
	client := &models.OAuthClient{
		ClientId:     "hnw_app_test",
		ClientSecret: hashedSecret,
		Name:         "北向行者测试端",
		RedirectUris: "https://tools.originagent.cn/api/user/auth/bbsgo/callback",
		Status:       0,
		CreateTime:   dates.NowTimestamp(),
	}
	if err := repositories.OAuthClientRepository.Create(db, client); err != nil {
		t.Fatalf("create oauth client: %v", err)
	}

	// 3. 生成授权码 Code
	redirectUri := "https://tools.originagent.cn/api/user/auth/bbsgo/callback"
	code, err := OAuthProviderService.CreateAuthorizationCode(client.ClientId, testUser.Id, redirectUri, "profile")
	if err != nil {
		t.Fatalf("create auth code failed: %v", err)
	}
	if len(code) == 0 {
		t.Fatalf("expected non-empty code")
	}

	// 4. 首次兑换 Token（应成功）
	tokenResp, err := OAuthProviderService.ExchangeToken(client.ClientId, rawSecret, code, redirectUri)
	if err != nil {
		t.Fatalf("exchange token failed: %v", err)
	}
	if tokenResp.AccessToken == "" || tokenResp.TokenType != "Bearer" {
		t.Fatalf("unexpected token response: %+v", tokenResp)
	}

	// 5. 二次兑换相同 Code（必须失败，防重放攻击）
	_, err = OAuthProviderService.ExchangeToken(client.ClientId, rawSecret, code, redirectUri)
	if err == nil {
		t.Fatalf("expected error on code replay, but succeeded")
	}

	// 6. 使用 AccessToken 获取用户信息
	userInfo, err := OAuthProviderService.GetUserInfoByAccessToken(tokenResp.AccessToken)
	if err != nil {
		t.Fatalf("get user info failed: %v", err)
	}
	if userInfo.Id != testUser.Id || userInfo.Username != "aswj_captain" || userInfo.Email != "captain@originagent.cn" {
		t.Fatalf("mismatched user info: %+v", userInfo)
	}

	// 7. 使用伪造 Token 请求用户信息（应失败）
	_, err = OAuthProviderService.GetUserInfoByAccessToken("fake_access_token_123")
	if err == nil {
		t.Fatalf("expected error for fake token, got nil")
	}
}
