package admin

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
	"bbs-go/internal/pkg/idcodec"
	"bbs-go/internal/pkg/search"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

func TestUserListFiltersForbiddenUsers(t *testing.T) {
	db := setupAdminUserTestDB(t)
	now := time.Now().UnixMilli()
	mustCreateUser(t, db, &models.User{
		Model:            models.Model{Id: 1},
		Nickname:         "normal",
		ForbiddenEndTime: 0,
	})
	mustCreateUser(t, db, &models.User{
		Model:            models.Model{Id: 2},
		Nickname:         "forbidden",
		ForbiddenEndTime: now + 3600_000,
	})
	mustCreateUser(t, db, &models.User{
		Model:            models.Model{Id: 3},
		Nickname:         "forever",
		ForbiddenEndTime: -1,
	})
	mustCreateUser(t, db, &models.User{
		Model:            models.Model{Id: 4},
		Nickname:         "expired",
		ForbiddenEndTime: now - 3600_000,
	})

	users := postUserList(t, "forbidden=true")

	gotIDs := make([]int64, 0, len(users))
	for _, user := range users {
		gotIDs = append(gotIDs, int64(user["id"].(float64)))
		if forbidden, ok := user["forbidden"].(bool); !ok || !forbidden {
			t.Fatalf("expected only forbidden users, got %#v", user)
		}
	}
	wantIDs := []int64{3, 2}
	if len(gotIDs) != len(wantIDs) {
		t.Fatalf("expected ids %v, got %v", wantIDs, gotIDs)
	}
	for i := range wantIDs {
		if gotIDs[i] != wantIDs[i] {
			t.Fatalf("expected ids %v, got %v", wantIDs, gotIDs)
		}
	}
}

func TestUserListFiltersNonForbiddenUsers(t *testing.T) {
	db := setupAdminUserTestDB(t)
	now := time.Now().UnixMilli()
	mustCreateUser(t, db, &models.User{
		Model:            models.Model{Id: 1},
		Nickname:         "normal",
		ForbiddenEndTime: 0,
	})
	mustCreateUser(t, db, &models.User{
		Model:            models.Model{Id: 2},
		Nickname:         "forbidden",
		ForbiddenEndTime: now + 3600_000,
	})
	mustCreateUser(t, db, &models.User{
		Model:            models.Model{Id: 3},
		Nickname:         "forever",
		ForbiddenEndTime: -1,
	})
	mustCreateUser(t, db, &models.User{
		Model:            models.Model{Id: 4},
		Nickname:         "expired",
		ForbiddenEndTime: now - 3600_000,
	})

	users := postUserList(t, "forbidden=false")

	gotIDs := make([]int64, 0, len(users))
	for _, user := range users {
		gotIDs = append(gotIDs, int64(user["id"].(float64)))
		if forbidden, ok := user["forbidden"].(bool); !ok || forbidden {
			t.Fatalf("expected only non-forbidden users, got %#v", user)
		}
	}
	wantIDs := []int64{4, 1}
	if len(gotIDs) != len(wantIDs) {
		t.Fatalf("expected ids %v, got %v", wantIDs, gotIDs)
	}
	for i := range wantIDs {
		if gotIDs[i] != wantIDs[i] {
			t.Fatalf("expected ids %v, got %v", wantIDs, gotIDs)
		}
	}
}

func TestUserListFiltersByRole(t *testing.T) {
	db := setupAdminUserTestDB(t)
	mustCreateUser(t, db, &models.User{Model: models.Model{Id: 1}, Nickname: "alice"})
	mustCreateUser(t, db, &models.User{Model: models.Model{Id: 2}, Nickname: "bob"})
	mustCreateUser(t, db, &models.User{Model: models.Model{Id: 3}, Nickname: "carol"})
	mustCreateUser(t, db, &models.User{Model: models.Model{Id: 4}, Nickname: "dave"})
	mustCreateRole(t, db, &models.Role{Model: models.Model{Id: 10}, Name: "管理员", Code: "admin"})
	mustCreateRole(t, db, &models.Role{Model: models.Model{Id: 11}, Name: "版主", Code: "moderator"})
	mustCreateUserRole(t, db, 1, 10)
	mustCreateUserRole(t, db, 2, 10)
	mustCreateUserRole(t, db, 3, 11)
	// dave 无任何角色

	users := postUserList(t, "roleId=10")
	gotIDs := make([]int64, 0, len(users))
	for _, user := range users {
		gotIDs = append(gotIDs, int64(user["id"].(float64)))
	}
	wantIDs := []int64{2, 1}
	if len(gotIDs) != len(wantIDs) {
		t.Fatalf("expected ids %v, got %v", wantIDs, gotIDs)
	}
	for i := range wantIDs {
		if gotIDs[i] != wantIDs[i] {
			t.Fatalf("expected ids %v, got %v", wantIDs, gotIDs)
		}
	}

	// 不存在的角色：空结果而非全量（防止超管误以为“该角色无人”实则过滤失效）
	if users := postUserList(t, "roleId=999"); len(users) != 0 {
		t.Fatalf("expected empty results for unknown role, got %d", len(users))
	}

	// 非法 roleId：忽略条件返回全量（与 id/username 等其他过滤器的容错一致）
	if users := postUserList(t, "roleId=abc"); len(users) != 4 {
		t.Fatalf("expected all users for invalid roleId, got %d", len(users))
	}
}

func TestUserListFiltersByMinViolationCount(t *testing.T) {
	db := setupAdminUserTestDB(t)
	mustCreateUser(t, db, &models.User{Model: models.Model{Id: 1}, Nickname: "clean", ViolationCount: 0})
	mustCreateUser(t, db, &models.User{Model: models.Model{Id: 2}, Nickname: "once", ViolationCount: 1})
	mustCreateUser(t, db, &models.User{Model: models.Model{Id: 3}, Nickname: "risky", ViolationCount: 3})
	mustCreateUser(t, db, &models.User{Model: models.Model{Id: 4}, Nickname: "repeat", ViolationCount: 5})

	assertUserListIDs := func(body string, wantIDs []int64) {
		t.Helper()
		users := postUserList(t, body)
		gotIDs := make([]int64, 0, len(users))
		for _, user := range users {
			gotIDs = append(gotIDs, int64(user["id"].(float64)))
		}
		if len(gotIDs) != len(wantIDs) {
			t.Fatalf("body %q: expected ids %v, got %v", body, wantIDs, gotIDs)
		}
		for i := range wantIDs {
			if gotIDs[i] != wantIDs[i] {
				t.Fatalf("body %q: expected ids %v, got %v", body, wantIDs, gotIDs)
			}
		}
	}

	// >=1 命中 2/3/4（默认按 id 倒序）
	assertUserListIDs("minViolationCount=1", []int64{4, 3, 2})
	// >=3 命中 3/4
	assertUserListIDs("minViolationCount=3", []int64{4, 3})
	// >=6 无人命中
	assertUserListIDs("minViolationCount=6", []int64{})

	// 0/缺失/非法/负数：一律忽略条件返回全量（与其他筛选器的容错一致）
	assertUserListIDs("minViolationCount=0", []int64{4, 3, 2, 1})
	assertUserListIDs("", []int64{4, 3, 2, 1})
	assertUserListIDs("minViolationCount=abc", []int64{4, 3, 2, 1})
	assertUserListIDs("minViolationCount=-1", []int64{4, 3, 2, 1})
}

func TestUserResetPasswordDisablesUserTokens(t *testing.T) {
	db := setupAdminUserTestDB(t)
	mustCreateUser(t, db, &models.User{
		Model:    models.Model{Id: 1},
		Nickname: "target",
		Status:   constants.StatusOk,
		Password: "old-password",
	})
	mustCreateUser(t, db, &models.User{
		Model:    models.Model{Id: 2},
		Nickname: "other",
		Status:   constants.StatusOk,
		Password: "old-password",
	})

	now := time.Now().UnixMilli()
	mustCreateUserToken(t, db, &models.UserToken{
		Token:      "target-active-1",
		UserId:     1,
		ExpiredAt:  now + 3600_000,
		Status:     constants.StatusOk,
		CreateTime: now,
	})
	mustCreateUserToken(t, db, &models.UserToken{
		Token:      "target-active-2",
		UserId:     1,
		ExpiredAt:  now + 3600_000,
		Status:     constants.StatusOk,
		CreateTime: now,
	})
	mustCreateUserToken(t, db, &models.UserToken{
		Token:      "target-deleted",
		UserId:     1,
		ExpiredAt:  now + 3600_000,
		Status:     constants.StatusDeleted,
		CreateTime: now,
	})
	mustCreateUserToken(t, db, &models.UserToken{
		Token:      "other-active",
		UserId:     2,
		ExpiredAt:  now + 3600_000,
		Status:     constants.StatusOk,
		CreateTime: now,
	})

	postUserResetPassword(t, "userId=1")

	var targetActiveCount int64
	if err := db.Model(&models.UserToken{}).
		Where("user_id = ? AND status = ?", 1, constants.StatusOk).
		Count(&targetActiveCount).Error; err != nil {
		t.Fatalf("count target active tokens: %v", err)
	}
	if targetActiveCount != 0 {
		t.Fatalf("expected target user active tokens to be disabled, got %d", targetActiveCount)
	}

	var otherActiveCount int64
	if err := db.Model(&models.UserToken{}).
		Where("user_id = ? AND status = ?", 2, constants.StatusOk).
		Count(&otherActiveCount).Error; err != nil {
		t.Fatalf("count other active tokens: %v", err)
	}
	if otherActiveCount != 1 {
		t.Fatalf("expected other user active token to remain, got %d", otherActiveCount)
	}
}

func setupAdminUserTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	idcodec.Init(1)
	config.Instance = &config.Config{
		Search: config.SearchConfig{
			IndexPath: filepath.Join(t.TempDir(), "index"),
		},
	}
	search.Init()
	// 先于 TempDir 清理关闭索引句柄（LIFO），否则 Windows 下 bolt 文件被占用导致清理失败。
	t.Cleanup(func() {
		_ = search.Close()
	})

	dsn := fmt.Sprintf("file:admin_user_test_%d?mode=memory&cache=shared&_fk=1", time.Now().UnixNano())
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
	if err := db.AutoMigrate(&models.User{}, &models.UserToken{}, &models.Role{}, &models.UserRole{}); err != nil {
		t.Fatalf("auto migrate users: %v", err)
	}
	return db
}

func mustCreateUser(t *testing.T, db *gorm.DB, user *models.User) {
	t.Helper()

	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
}

func mustCreateUserToken(t *testing.T, db *gorm.DB, userToken *models.UserToken) {
	t.Helper()

	if err := db.Create(userToken).Error; err != nil {
		t.Fatalf("create user token: %v", err)
	}
}

func mustCreateRole(t *testing.T, db *gorm.DB, role *models.Role) {
	t.Helper()

	if err := db.Create(role).Error; err != nil {
		t.Fatalf("create role: %v", err)
	}
}

func mustCreateUserRole(t *testing.T, db *gorm.DB, userId, roleId int64) {
	t.Helper()

	if err := db.Create(&models.UserRole{UserId: userId, RoleId: roleId}).Error; err != nil {
		t.Fatalf("create user role: %v", err)
	}
}

func postUserResetPassword(t *testing.T, body string) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/user/reset_password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	ctx.Request = req

	UserResetPassword(ctx)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var result struct {
		Success bool `json:"success"`
		Data    struct {
			Password string `json:"password"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response %q: %v", w.Body.String(), err)
	}
	if !result.Success {
		t.Fatalf("expected success response, got %s", w.Body.String())
	}
	if result.Data.Password == "" {
		t.Fatalf("expected reset password in response, got %s", w.Body.String())
	}
}

func postUserList(t *testing.T, body string) []map[string]interface{} {
	t.Helper()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/user/list", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	ctx.Request = req

	UserList(ctx)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

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
		t.Fatalf("expected success response, got %s", w.Body.String())
	}
	return result.Data.Results
}
