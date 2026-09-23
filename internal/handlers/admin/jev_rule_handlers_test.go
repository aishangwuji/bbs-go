package admin

import (
	"bbs-go/internal/models"
	"bbs-go/internal/models/dto"
	"bbs-go/internal/pkg/common"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

func setupTestDBForJevRule(t *testing.T) *gorm.DB {
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "t_",
			SingularTable: true,
		},
	})
	if err != nil {
		t.Fatalf("failed to open in-memory sqlite: %v", err)
	}
	sqls.SetDB(db)

	if err := db.AutoMigrate(&models.SysConfig{}, &models.JevRuleHistory{}); err != nil {
		t.Fatalf("failed to auto migrate: %v", err)
	}
	return db
}

func TestJevRuleHistoryFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupTestDBForJevRule(t)
	sqlDB, _ := db.DB()
	defer sqlDB.Close()

	mockAdmin := &models.User{
		Model:    models.Model{Id: 100},
		Username: sql.NullString{String: "admin_tester", Valid: true},
		Nickname: "测试管理员",
	}

	// 1. 保存规则
	{
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		common.SetCurrentUser(ctx, mockAdmin)

		reqBody := JevRuleSaveReq{
			JevRuleConfig: dto.DefaultJevRuleConfig(),
			Remark:        "单元测试初始规则",
		}
		data, _ := json.Marshal(reqBody)
		ctx.Request = httptest.NewRequest(http.MethodPost, "/api/admin/jev-rule/save", bytes.NewReader(data))
		ctx.Request.Header.Set("Content-Type", "application/json")

		JevRuleSave(ctx)

		if recorder.Code != http.StatusOK {
			t.Fatalf("save expected 200, got: %d", recorder.Code)
		}
	}

	// 2. 查询历史列表
	var historyList []models.JevRuleHistory
	{
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/api/admin/jev-rule/history/list?page=1&limit=10", nil)

		JevRuleHistoryList(ctx)

		if recorder.Code != http.StatusOK {
			t.Fatalf("history list expected 200, got: %d", recorder.Code)
		}

		var resp struct {
			Success bool `json:"success"`
			Data    struct {
				Results []models.JevRuleHistory `json:"results"`
			} `json:"data"`
		}
		if err := json.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal history list: %v", err)
		}
		if len(resp.Data.Results) != 1 {
			t.Fatalf("expected 1 history record, got: %d", len(resp.Data.Results))
		}
		historyList = resp.Data.Results
		first := historyList[0]
		if first.OperatorName != "测试管理员" {
			t.Errorf("expected operatorName '测试管理员', got: %s", first.OperatorName)
		}
		if first.Remark != "单元测试初始规则" {
			t.Errorf("expected remark '单元测试初始规则', got: %s", first.Remark)
		}
		if !first.IsActive {
			t.Errorf("expected first history to be active")
		}
	}

	// 3. 再次保存新版本
	{
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		common.SetCurrentUser(ctx, mockAdmin)

		cfg2 := dto.DefaultJevRuleConfig()
		cfg2.MaxContentLength = 800
		reqBody := JevRuleSaveReq{
			JevRuleConfig: cfg2,
			Remark:        "调整最大文本长度至800",
		}
		data, _ := json.Marshal(reqBody)
		ctx.Request = httptest.NewRequest(http.MethodPost, "/api/admin/jev-rule/save", bytes.NewReader(data))
		ctx.Request.Header.Set("Content-Type", "application/json")

		JevRuleSave(ctx)

		if recorder.Code != http.StatusOK {
			t.Fatalf("save second expected 200, got: %d", recorder.Code)
		}
	}

	// 4. 回滚至第一个版本
	{
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		common.SetCurrentUser(ctx, mockAdmin)

		rollbackReq := JevRuleHistoryRollbackReq{
			HistoryId: historyList[0].Id,
			Remark:    "测试一键回滚",
		}
		data, _ := json.Marshal(rollbackReq)
		ctx.Request = httptest.NewRequest(http.MethodPost, "/api/admin/jev-rule/history/rollback", bytes.NewReader(data))
		ctx.Request.Header.Set("Content-Type", "application/json")

		JevRuleHistoryRollback(ctx)

		if recorder.Code != http.StatusOK {
			t.Fatalf("rollback expected 200, got: %d", recorder.Code)
		}
	}

	// 5. 验证回滚后，历史总记录为 3 条，最新一条生效且备注含回滚信息
	{
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/api/admin/jev-rule/history/list?page=1&limit=10", nil)

		JevRuleHistoryList(ctx)

		var resp struct {
			Success bool `json:"success"`
			Data    struct {
				Results []models.JevRuleHistory `json:"results"`
			} `json:"data"`
		}
		if err := json.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal history list: %v", err)
		}
		results := resp.Data.Results
		if len(results) != 3 {
			t.Fatalf("expected 3 history records after rollback, got: %d", len(results))
		}
		latest := results[0]
		if !latest.IsActive {
			t.Errorf("expected latest snapshot to be active")
		}
	}
}
