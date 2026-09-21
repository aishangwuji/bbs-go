package admin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"bbs-go/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"github.com/mlogclub/simple/web"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

func setupModerationRecordTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "t_",
			SingularTable: true,
		},
	})
	if err != nil {
		t.Fatalf("open sqlite memory db: %v", err)
	}

	if err := db.AutoMigrate(&models.ModerationRecord{}); err != nil {
		t.Fatalf("migrate ModerationRecord table: %v", err)
	}

	sqls.SetDB(db)
	return db
}

func TestModerationRecordListAndDetail(t *testing.T) {
	db := setupModerationRecordTestDB(t)

	now := time.Now().UnixMilli()
	record1 := &models.ModerationRecord{
		Model:              models.Model{Id: 101},
		EntityType:         "topic",
		EntityId:           2001,
		UserId:             888,
		ContentSnapshot:    "Title: 测试发帖\nContent: 包含广告推广",
		IsSpamProb:         0.92,
		ToxicityScore:      0.15,
		ToxicityConfidence: 0.95,
		SuggestedAction:    "reject",
		FinalAction:        "reject",
		RawResponse:        `{"is_spam":true}`,
		CreateTime:         now,
		UpdateTime:         now,
	}
	if err := db.Create(record1).Error; err != nil {
		t.Fatalf("create test record: %v", err)
	}

	// 1. 测试 List 接口
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/admin/moderation-record/list?entityType=topic", nil)

	ModerationRecordList(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var listResult struct {
		Success bool           `json:"success"`
		Data    web.PageResult `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &listResult); err != nil {
		t.Fatalf("unmarshal list response: %v", err)
	}
	if !listResult.Success {
		t.Fatalf("expected success response, got: %s", recorder.Body.String())
	}

	// 2. 测试 Detail 接口
	recDetail := httptest.NewRecorder()
	ctxDetail, _ := gin.CreateTestContext(recDetail)
	ctxDetail.Params = gin.Params{{Key: "id", Value: "101"}}
	ctxDetail.Request = httptest.NewRequest(http.MethodGet, "/api/admin/moderation-record/101", nil)

	ModerationRecordDetail(ctxDetail)

	if recDetail.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recDetail.Code)
	}

	var detailResult struct {
		Success bool                   `json:"success"`
		Data    models.ModerationRecord `json:"data"`
	}
	if err := json.Unmarshal(recDetail.Body.Bytes(), &detailResult); err != nil {
		t.Fatalf("unmarshal detail response: %v", err)
	}
	if !detailResult.Success || detailResult.Data.Id != 101 {
		t.Fatalf("expected record id 101, got: %+v", detailResult.Data)
	}
}
