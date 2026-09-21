package jev

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestJevClient_Evaluate_Success(t *testing.T) {
	// 模拟官方规范 JSON 响应
	mockResponseJSON := `{
  "model": "jev-1.13.0",
  "answers": {
    "is_spam": {
      "type": "noul",
      "noul": 0.96
    },
    "severity": {
      "type": "score",
      "score": 1.45,
      "confidence": 0.88,
      "legend": {
        "0": "Cosmetic",
        "1": "Degraded",
        "2": "Blocking"
      },
      "probabilities": {
        "0": 0.0,
        "1": 0.55,
        "2": 0.45
      }
    },
    "department": {
      "type": "choice",
      "choice": "security",
      "confidence": 0.92,
      "probabilities": {
        "security": 0.92,
        "billing": 0.08
      }
    }
  },
  "usage": {
    "input_tokens": 120,
    "output_tokens": 40
  }
}`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(mockResponseJSON))
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", 2*time.Second)

	req := &SystemOneRequest{
		Model: "jev-latest",
		State: "Test content for moderation",
		Questions: map[string]Question{
			"is_spam": {
				Type:         TypeNoul,
				Instructions: "Is this spam?",
			},
			"severity": {
				Type:         TypeScore,
				Instructions: "Rate severity",
				Criteria:     []string{"Cosmetic", "Degraded", "Blocking"},
			},
			"department": {
				Type:         TypeChoice,
				Instructions: "Assign department",
				Criteria: map[string]string{
					"security": "Security issues",
					"billing":  "Billing problems",
				},
			},
		},
	}

	resp, err := client.Evaluate(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Model != "jev-1.13.0" {
		t.Errorf("expected model jev-1.13.0, got %s", resp.Model)
	}

	// 1. 校验 Noul
	noulAns, err := ParseNoul(resp, "is_spam")
	if err != nil {
		t.Fatalf("parse noul failed: %v", err)
	}
	if noulAns.Noul != 0.96 {
		t.Errorf("expected noul 0.96, got %f", noulAns.Noul)
	}

	// 2. 校验 Score
	scoreAns, err := ParseScore(resp, "severity")
	if err != nil {
		t.Fatalf("parse score failed: %v", err)
	}
	if scoreAns.Score != 1.45 || scoreAns.Confidence != 0.88 {
		t.Errorf("expected score 1.45/conf 0.88, got %f/%f", scoreAns.Score, scoreAns.Confidence)
	}

	// 3. 校验 Choice
	choiceAns, err := ParseChoice(resp, "department")
	if err != nil {
		t.Fatalf("parse choice failed: %v", err)
	}
	if choiceAns.Choice != "security" || choiceAns.Confidence != 0.92 {
		t.Errorf("expected choice security/conf 0.92, got %s/%f", choiceAns.Choice, choiceAns.Confidence)
	}
}

func TestJevClient_ContextTimeout(t *testing.T) {
	// 模拟慢速服务器
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", 2*time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	req := &SystemOneRequest{
		Questions: map[string]Question{
			"q1": {Type: TypeNoul, Instructions: "test"},
		},
	}

	_, err := client.Evaluate(ctx, req)
	if err == nil {
		t.Fatal("expected timeout error, got nil")
	}
}
