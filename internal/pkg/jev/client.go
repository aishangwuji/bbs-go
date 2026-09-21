package jev

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client Jev System One HTTP 客户端
type Client struct {
	endpoint   string
	apiKey     string
	httpClient *http.Client
}

// NewClient 创建 Jev 客户端实例
func NewClient(endpoint, apiKey string, timeout time.Duration) *Client {
	if endpoint == "" {
		endpoint = "https://api.typesafe.ai/v1/systemone"
	}
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	return &Client{
		endpoint: endpoint,
		apiKey:   apiKey,
		httpClient: &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

// Evaluate 调用 Jev System One 接口对 State 进行一次性并行多问题评估 (Speculative Fan-out)
func (c *Client) Evaluate(ctx context.Context, req *SystemOneRequest) (*SystemOneResponse, error) {
	if c.apiKey == "" {
		return nil, errors.New("jev: api key is required")
	}
	if req == nil {
		return nil, errors.New("jev: request cannot be nil")
	}
	if len(req.Questions) == 0 {
		return nil, errors.New("jev: questions cannot be empty")
	}
	if req.Model == "" {
		req.Model = "jev-latest"
	}

	bodyBytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("jev: marshal request failed: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("jev: create http request failed: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("jev: http post failed: %w", err)
	}
	defer httpResp.Body.Close()

	respBytes, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("jev: read response body failed: %w", err)
	}

	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jev: api returned non-200 status: %d, body: %s", httpResp.StatusCode, strings.TrimSpace(string(respBytes)))
	}

	var res SystemOneResponse
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return nil, fmt.Errorf("jev: decode response json failed: %w", err)
	}

	return &res, nil
}

// ParseNoul 从通用响应中提取并解析指定 Key 的 Noul 结果
func ParseNoul(resp *SystemOneResponse, key string) (*NoulAnswer, error) {
	raw, ok := resp.Answers[key]
	if !ok {
		return nil, fmt.Errorf("jev: question '%s' not found in response", key)
	}
	var ans NoulAnswer
	if err := json.Unmarshal(raw, &ans); err != nil {
		return nil, fmt.Errorf("jev: unmarshal noul answer failed for '%s': %w", key, err)
	}
	return &ans, nil
}

// ParseScore 从通用响应中提取并解析指定 Key 的 Score 结果
func ParseScore(resp *SystemOneResponse, key string) (*ScoreAnswer, error) {
	raw, ok := resp.Answers[key]
	if !ok {
		return nil, fmt.Errorf("jev: question '%s' not found in response", key)
	}
	var ans ScoreAnswer
	if err := json.Unmarshal(raw, &ans); err != nil {
		return nil, fmt.Errorf("jev: unmarshal score answer failed for '%s': %w", key, err)
	}
	return &ans, nil
}

// ParseChoice 从通用响应中提取并解析指定 Key 的 Choice 结果
func ParseChoice(resp *SystemOneResponse, key string) (*ChoiceAnswer, error) {
	raw, ok := resp.Answers[key]
	if !ok {
		return nil, fmt.Errorf("jev: question '%s' not found in response", key)
	}
	var ans ChoiceAnswer
	if err := json.Unmarshal(raw, &ans); err != nil {
		return nil, fmt.Errorf("jev: unmarshal choice answer failed for '%s': %w", key, err)
	}
	return &ans, nil
}
