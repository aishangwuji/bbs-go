package admin

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSysConfigTestJevValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// 1. 未填写 API Key 时应当报错拦截
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	body := []byte(`{"apiKey": ""}`)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/admin/sys-config/test_jev", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	SysConfigTestJev(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 wrapper, got: %d", recorder.Code)
	}

	var resp struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Success {
		t.Fatalf("expected error when apiKey is empty")
	}

	// 2. 模拟 Jev 服务端成功响应测试
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"questions":{"ping":{"noul":0.1}}}`))
	}))
	defer mockServer.Close()

	recMock := httptest.NewRecorder()
	ctxMock, _ := gin.CreateTestContext(recMock)
	mockPayload, _ := json.Marshal(SysConfigTestJevReq{
		Endpoint:  mockServer.URL,
		ApiKey:    "test-mock-key",
		Model:     "test-model",
		TimeoutMs: 2000,
	})
	ctxMock.Request = httptest.NewRequest(http.MethodPost, "/api/admin/sys-config/test_jev", bytes.NewReader(mockPayload))
	ctxMock.Request.Header.Set("Content-Type", "application/json")

	SysConfigTestJev(ctxMock)

	if recMock.Code != http.StatusOK {
		t.Fatalf("expected 200, got: %d", recMock.Code)
	}

	var mockResp struct {
		Success bool `json:"success"`
		Data    struct {
			Message   string `json:"message"`
			LatencyMs int64  `json:"latencyMs"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recMock.Body.Bytes(), &mockResp); err != nil {
		t.Fatalf("unmarshal mock response: %v", err)
	}
	if !mockResp.Success {
		t.Fatalf("expected success with mock server, got: %s", recMock.Body.String())
	}
}
