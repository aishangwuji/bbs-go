package services

import (
	"bbs-go/internal/models/constants"
	"testing"
)

func TestParseModulesConfig_BackfillsQaFromTopicForLegacyConfig(t *testing.T) {
	cfg := parseModulesConfig(`{"tweet":true,"topic":true,"article":false}`)

	if !cfg.QA {
		t.Fatalf("expected legacy config without qa to keep QA enabled when topic is enabled")
	}
}

func TestParseModulesConfig_RespectsExplicitQaSwitch(t *testing.T) {
	cfg := parseModulesConfig(`{"tweet":true,"topic":true,"qa":false,"article":true}`)

	if cfg.QA {
		t.Fatalf("expected explicit qa=false to disable QA independently from topic")
	}
}

func TestNormalizeTopicListStyle_DefaultsToStandardStyle(t *testing.T) {
	if got := normalizeTopicListStyle(""); got != constants.TopicListStyleDefault {
		t.Fatalf("expected empty topic list style to default to %q, got %q", constants.TopicListStyleDefault, got)
	}
}

func TestNormalizeTopicListStyle_AcceptsCompactStyle(t *testing.T) {
	if got := normalizeTopicListStyle(constants.TopicListStyleCompact); got != constants.TopicListStyleCompact {
		t.Fatalf("expected compact topic list style, got %q", got)
	}
}

func TestNormalizeTopicListStyle_RejectsUnknownStyle(t *testing.T) {
	if got := normalizeTopicListStyle("dense"); got != constants.TopicListStyleDefault {
		t.Fatalf("expected unknown topic list style to default to %q, got %q", constants.TopicListStyleDefault, got)
	}
}

func TestDefaultJevRuleConfig_HasQuestionsAndThresholds(t *testing.T) {
	cfg := SysConfigService.GetJevRuleConfig()
	if cfg.MaxContentLength <= 0 {
		t.Fatalf("expected positive MaxContentLength, got %d", cfg.MaxContentLength)
	}
	if len(cfg.NoulQuestions) == 0 {
		t.Fatalf("expected non-empty NoulQuestions")
	}
	if len(cfg.ScoreQuestions) == 0 {
		t.Fatalf("expected non-empty ScoreQuestions")
	}
	if len(cfg.ChoiceQuestions) == 0 {
		t.Fatalf("expected non-empty ChoiceQuestions")
	}

	questions := ModerationService.buildQuestions(cfg)
	if _, ok := questions["is_spam"]; !ok {
		t.Fatalf("expected is_spam question to be built")
	}
	if _, ok := questions["toxicity"]; !ok {
		t.Fatalf("expected toxicity question to be built")
	}
	if _, ok := questions["violation_category"]; !ok {
		t.Fatalf("expected violation_category question to be built")
	}
}
