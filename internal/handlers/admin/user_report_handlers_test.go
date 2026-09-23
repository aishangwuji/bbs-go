package admin

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	"bbs-go/internal/models"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

// TestResolveReportAuditUsers 验证审核人展示信息解析：
// 1. 按 auditUserId 命中用户并回填昵称/登录名；
// 2. 重复审核人只查询一次（映射仅保留一条）；
// 3. auditUserId <= 0（待处理工单）不参与解析。
func TestResolveReportAuditUsers(t *testing.T) {
	db := setupUserReportTestDB(t)
	mustCreateUser(t, db, &models.User{
		Model:    models.Model{Id: 7},
		Nickname: "审核员",
		Username: sql.NullString{String: "auditor7", Valid: true},
	})

	reports := []models.UserReport{
		{Model: models.Model{Id: 1}, AuditUserId: 7},
		{Model: models.Model{Id: 2}, AuditUserId: 7},
		{Model: models.Model{Id: 3}, AuditUserId: 0},
	}

	got := resolveReportAuditUsers(reports)
	if len(got) != 1 {
		t.Fatalf("expected exactly one resolved audit user, got %#v", got)
	}
	info, ok := got[7]
	if !ok {
		t.Fatalf("expected audit user 7 to be resolved, got %#v", got)
	}
	if info.nickname != "审核员" || info.username != "auditor7" {
		t.Fatalf("unexpected audit user info: %#v", info)
	}
}

// setupUserReportTestDB 使用内存 SQLite 搭建最小依赖，
// 避免复用 search 索引（其在 Windows 下会因 bolt 文件锁导致 TempDir 清理失败）。
func setupUserReportTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:user_report_test_%d?mode=memory&cache=shared&_fk=1", time.Now().UnixNano())
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
	if err := db.AutoMigrate(&models.User{}); err != nil {
		t.Fatalf("auto migrate users: %v", err)
	}
	return db
}
