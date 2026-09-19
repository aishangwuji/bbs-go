package services

import (
	"bbs-go/internal/cache"
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

func setupBadgeTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:badge_test_%d?mode=memory&cache=shared&_fk=1", time.Now().UnixNano())
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
		&models.Badge{},
		&models.UserBadge{},
		&models.CheckIn{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	return db
}

func TestBadgeRuleScanAndAward(t *testing.T) {
	db := setupBadgeTestDB(t)

	// 1. 创建勋章配置（在数据库中并刷新缓存）
	badgeTopic := &models.Badge{
		Model:      models.Model{Id: 101},
		Name:       "topic_master",
		Title:      "发帖达人",
		Status:     constants.StatusOk,
		GrantType:  constants.BadgeGrantTypeAuto,
		RuleField:  constants.BadgeRuleTopicCount,
		RuleValue:  10,
		CreateTime: time.Now().UnixMilli(),
		UpdateTime: time.Now().UnixMilli(),
	}
	badgeManual := &models.Badge{
		Model:      models.Model{Id: 102},
		Name:       "manual_honor",
		Title:      "管理员特赐勋章",
		Status:     constants.StatusOk,
		GrantType:  constants.BadgeGrantTypeManual,
		CreateTime: time.Now().UnixMilli(),
		UpdateTime: time.Now().UnixMilli(),
	}
	db.Create(badgeTopic)
	db.Create(badgeManual)

	// 刷新 Badge 缓存
	cache.BadgeCache.Reload()

	// 2. 创建测试用户
	user := &models.User{
		Model:      models.Model{Id: 1001},
		Username:   sql.NullString{String: "test_user", Valid: true},
		TopicCount: 5,
		Status:     constants.StatusOk,
		CreateTime: time.Now().UnixMilli(),
	}
	db.Create(user)

	// 3. 用户发帖未达标（5 < 10），求值不应获得
	awarded, err := BadgeService.ScanAndAwardUserBadges(user.Id)
	if err != nil {
		t.Fatalf("ScanAndAwardUserBadges error: %v", err)
	}
	if len(awarded) != 0 {
		t.Fatalf("expected 0 badges, got %d", len(awarded))
	}

	// 4. 用户发帖达标（更新到 12 帖），求值应获得发帖达人勋章
	db.Model(&models.User{}).Where("id = ?", user.Id).Update("topic_count", 12)
	cache.UserCache.Invalidate(user.Id)

	awarded, err = BadgeService.ScanAndAwardUserBadges(user.Id)
	if err != nil {
		t.Fatalf("ScanAndAwardUserBadges error: %v", err)
	}
	if len(awarded) != 1 || awarded[0].Id != 101 {
		t.Fatalf("expected 1 badge with id 101, got %v", awarded)
	}

	// 验证 UserBadge 表记录
	ub := repositories.UserBadgeRepository.Take(db, "user_id = ? AND badge_id = ?", user.Id, 101)
	if ub == nil {
		t.Fatalf("UserBadge record not found in db")
	}
	if ub.SourceType != "rule" || ub.SourceId != "topic_count" {
		t.Fatalf("unexpected source: type=%s, id=%s", ub.SourceType, ub.SourceId)
	}

	// 5. 再次求值（幂等性验证），不应重复获得
	awardedAgain, err := BadgeService.ScanAndAwardUserBadges(user.Id)
	if err != nil {
		t.Fatalf("ScanAndAwardUserBadges second call error: %v", err)
	}
	if len(awardedAgain) != 0 {
		t.Fatalf("expected 0 badges on re-scan, got %d", len(awardedAgain))
	}

	// 6. 管理员特赐勋章手动发放
	err = UserBadgeService.GiveNoTx(user.Id, 102, "manual", "测试特赐")
	if err != nil {
		t.Fatalf("manual Give error: %v", err)
	}
	ubManual := repositories.UserBadgeRepository.Take(db, "user_id = ? AND badge_id = ?", user.Id, 102)
	if ubManual == nil || ubManual.SourceType != "manual" {
		t.Fatalf("manual badge not found or invalid sourceType")
	}

	// 7. 管理员撤回勋章
	err = UserBadgeService.Delete(ubManual.Id)
	if err != nil {
		t.Fatalf("UserBadgeService.Delete error: %v", err)
	}
	ubDeleted := repositories.UserBadgeRepository.Take(db, "id = ?", ubManual.Id)
	if ubDeleted != nil {
		t.Fatalf("expected deleted badge to be nil")
	}
}
