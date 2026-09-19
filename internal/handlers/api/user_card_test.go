package api

import (
	"fmt"
	"testing"
	"time"

	"bbs-go/internal/cache"
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

// TestBuildUserCardBadgesOnlyOwnedAndWornFirst 验证用户卡勋章聚合的两条关键断言：
//  1. 只返回用户「已获得」的勋章，未获得的不进入卡片；
//  2. 佩戴的勋章排在未佩戴之前，即使其勋章配置的 sortNo 更大（佩戴优先于默认排序）。
func TestBuildUserCardBadgesOnlyOwnedAndWornFirst(t *testing.T) {
	db := setupAPIUserCardTestDB(t)

	// 勋章库：badge1 佩戴(sortNo=5)、badge2 未佩戴(sortNo=1)、badge3 未获得
	for _, badge := range []models.Badge{
		{Model: models.Model{Id: 1}, Name: "gold-topic", Title: "精彩的话题", SortNo: 5, Status: constants.StatusOk, CreateTime: time.Now().UnixMilli()},
		{Model: models.Model{Id: 2}, Name: "member", Title: "成员", SortNo: 1, Status: constants.StatusOk, CreateTime: time.Now().UnixMilli()},
		{Model: models.Model{Id: 3}, Name: "not-owned", Title: "未获得", SortNo: 2, Status: constants.StatusOk, CreateTime: time.Now().UnixMilli()},
	} {
		item := badge
		if err := db.Create(&item).Error; err != nil {
			t.Fatalf("create badge %d: %v", item.Id, err)
		}
	}

	userId := time.Now().UnixNano()
	for _, ub := range []models.UserBadge{
		{UserId: userId, BadgeId: 1, IsWorn: true, CreateTime: time.Now().UnixMilli()},
		{UserId: userId, BadgeId: 2, IsWorn: false, CreateTime: time.Now().UnixMilli()},
	} {
		item := ub
		if err := db.Create(&item).Error; err != nil {
			t.Fatalf("create user badge %d: %v", item.BadgeId, err)
		}
	}

	// 全局缓存可能残留其它用例导入的数据，显式刷新后再断言
	cache.BadgeCache.Reload()
	cache.UserBadgeCache.Invalidate(userId)

	got := buildUserCardBadges(userId)
	if len(got) != 2 {
		t.Fatalf("expected 2 owned badges, got %#v", got)
	}
	if got[0].Id != 1 || !got[0].Worn {
		t.Fatalf("expected worn badge(1) first, got %#v", got)
	}
	if got[1].Id != 2 || got[1].Worn {
		t.Fatalf("expected non-worn badge(2) second, got %#v", got)
	}
	for _, badge := range got {
		if !badge.Owned {
			t.Fatalf("badge %d should be marked owned", badge.Id)
		}
	}
}

// TestBuildUserCardBadgesReturnsEmptySlice 确保无勋章时返回空数组而非 nil，
// 避免前端拿到 null 时对 .length/.map 做额外防御判断。
func TestBuildUserCardBadgesReturnsEmptySlice(t *testing.T) {
	setupAPIUserCardTestDB(t)
	cache.BadgeCache.Reload()

	got := buildUserCardBadges(time.Now().UnixNano())
	if got == nil {
		t.Fatal("expected empty slice, got nil")
	}
	if len(got) != 0 {
		t.Fatalf("expected empty slice, got %#v", got)
	}
}

func setupAPIUserCardTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:api_user_card_test_%d?mode=memory&cache=shared&_fk=1", time.Now().UnixNano())
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
	if err := db.AutoMigrate(&models.Badge{}, &models.UserBadge{}); err != nil {
		t.Fatalf("auto migrate badge tables: %v", err)
	}
	return db
}
