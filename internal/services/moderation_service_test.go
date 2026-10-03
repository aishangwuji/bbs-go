package services

import (
	"encoding/json"
	"strings"
	"testing"

	"bbs-go/internal/models/dto"
	"bbs-go/internal/pkg/jev"
)

// TestBuildDecisionFromResponseProducesSnapshot 验证规则求值会产出：
// 1. 正确的最终裁决（reject/review/pass）；
// 2. 每个启用维度的全维度快照（含 verdict）；
// 3. 命中原因可序列化落库，空场景返回空串。
func TestBuildDecisionFromResponseProducesSnapshot(t *testing.T) {
	ruleCfg := dto.DefaultJevRuleConfig()

	t.Run("reject when all dimensions exceed reject threshold", func(t *testing.T) {
		resp := &jev.SystemOneResponse{
			Answers: map[string]json.RawMessage{
				"is_spam":            json.RawMessage(`{"type":"noul","noul":0.9}`),
				"toxicity":           json.RawMessage(`{"type":"score","score":1.6,"confidence":0.88}`),
				"violation_category": json.RawMessage(`{"type":"choice","choice":"illegal_info","confidence":0.92}`),
			},
		}

		decision := buildDecisionFromResponse(resp, ruleCfg)

		if decision.FinalAction != "reject" {
			t.Fatalf("expected reject, got %s", decision.FinalAction)
		}
		if decision.IsSpamProb != 0.9 {
			t.Fatalf("expected isSpamProb 0.9, got %v", decision.IsSpamProb)
		}
		if decision.ToxicityScore != 1.6 {
			t.Fatalf("expected toxicity 1.6, got %v", decision.ToxicityScore)
		}
		if len(decision.Dimensions) != 3 {
			t.Fatalf("expected 3 dimensions, got %d", len(decision.Dimensions))
		}
		for _, d := range decision.Dimensions {
			if d.Verdict == "" {
				t.Fatalf("dimension %s missing verdict", d.Key)
			}
		}

		reasons := marshalHitReasons(decision)
		if !strings.Contains(reasons, "下架阈值") {
			t.Fatalf("expected reject reason in hit reasons, got %s", reasons)
		}
		dimensions := marshalDimensionResults(decision.Dimensions)
		if !strings.Contains(dimensions, "violation_category") {
			t.Fatalf("expected choice dimension snapshot, got %s", dimensions)
		}
	})

	t.Run("review when only review threshold is exceeded", func(t *testing.T) {
		resp := &jev.SystemOneResponse{
			Answers: map[string]json.RawMessage{
				"is_spam": json.RawMessage(`{"type":"noul","noul":0.5}`),
			},
		}

		decision := buildDecisionFromResponse(resp, ruleCfg)

		if decision.FinalAction != "review" {
			t.Fatalf("expected review, got %s", decision.FinalAction)
		}
		if len(decision.RejectReasons) != 0 {
			t.Fatalf("expected no reject reasons, got %v", decision.RejectReasons)
		}
		if len(decision.ReviewReasons) != 1 {
			t.Fatalf("expected 1 review reason, got %v", decision.ReviewReasons)
		}
	})

	t.Run("empty snapshot serializes to empty string", func(t *testing.T) {
		if got := marshalHitReasons(&ModerationDecision{}); got != "" {
			t.Fatalf("expected empty hit reasons, got %s", got)
		}
		if got := marshalDimensionResults(nil); got != "" {
			t.Fatalf("expected empty dimension results, got %s", got)
		}
	})
}
