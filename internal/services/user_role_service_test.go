package services

import (
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"
	"testing"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

func setupUserRoleServiceTestDB(t *testing.T) {
	t.Helper()
	db := setupTestDB(t)
	if err := db.AutoMigrate(&models.Role{}, &models.UserRole{}); err != nil {
		t.Fatalf("auto migrate user role models: %v", err)
	}
}

func TestUserRoleService_IsRoleInUse(t *testing.T) {
	setupUserRoleServiceTestDB(t)
	now := dates.NowTimestamp()
	user := mustCreateUser(t, now)
	role := mustCreateRole(t, "role-in-use", constants.StatusOk)
	mustAssignRole(t, user, role)

	if !UserRoleService.IsRoleInUse(role.Id) {
		t.Fatalf("expected assigned role to be in use")
	}

	unusedRole := mustCreateRole(t, "role-unused", constants.StatusOk)
	if UserRoleService.IsRoleInUse(unusedRole.Id) {
		t.Fatalf("expected unassigned role to be unused")
	}
}

func TestUserRoleService_IsRoleInUseIgnoresInvalidRoleId(t *testing.T) {
	setupUserRoleServiceTestDB(t)
	if err := repositories.UserRoleRepository.Create(sqls.DB(), &models.UserRole{
		UserId:     1,
		RoleId:     1,
		CreateTime: dates.NowTimestamp(),
	}); err != nil {
		t.Fatalf("create user role: %v", err)
	}

	if UserRoleService.IsRoleInUse(0) {
		t.Fatalf("expected invalid role id to be unused")
	}
}

func TestUserService_IncrAndDecrViolationCount(t *testing.T) {
	setupUserRoleServiceTestDB(t)
	now := dates.NowTimestamp()
	user := mustCreateUser(t, now)

	// 初始违规次数为 0
	u := UserService.Get(user.Id)
	if u.ViolationCount != 0 {
		t.Fatalf("expected initial violationCount 0, got %d", u.ViolationCount)
	}

	// 触发违规 +1
	UserService.IncrViolationCount(user.Id, "Jev 智能风控拦截测试")
	u = UserService.Get(user.Id)
	if u.ViolationCount != 1 {
		t.Fatalf("expected violationCount 1, got %d", u.ViolationCount)
	}

	// 再次触发违规 +1
	UserService.IncrViolationCount(user.Id, "人工举报工单违规确认")
	u = UserService.Get(user.Id)
	if u.ViolationCount != 2 {
		t.Fatalf("expected violationCount 2, got %d", u.ViolationCount)
	}

	// 误审纠偏 -1
	UserService.DecrViolationCount(user.Id)
	u = UserService.Get(user.Id)
	if u.ViolationCount != 1 {
		t.Fatalf("expected violationCount 1 after decr, got %d", u.ViolationCount)
	}

	// 再次纠偏 -1
	UserService.DecrViolationCount(user.Id)
	u = UserService.Get(user.Id)
	if u.ViolationCount != 0 {
		t.Fatalf("expected violationCount 0 after decr, got %d", u.ViolationCount)
	}

	// 降到 0 之后继续 decr 不得出现负数（CASE WHEN ... >= 0 保护）
	UserService.DecrViolationCount(user.Id)
	u = UserService.Get(user.Id)
	if u.ViolationCount < 0 {
		t.Fatalf("expected violationCount not negative, got %d", u.ViolationCount)
	}
}
