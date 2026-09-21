package services

import (
	"bbs-go/internal/models/constants"
	"bbs-go/internal/models/dto"
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

func TestParseJevRuleConfig_LegacyJsonWithoutAutoCreateReport(t *testing.T) {
	legacyJSON := `{"maxContentLength":5000,"includeTitle":true,"noulQuestions":[],"scoreQuestions":[],"choiceQuestions":[]}`
	cfg := parseJevRuleConfig(legacyJSON, dto.DefaultJevRuleConfig())

	if !cfg.AutoCreateReport {
		t.Fatalf("expected legacy JSON without autoCreateReport to default to true, got false")
	}
	if cfg.ReviewTimeoutMinutes != 120 {
		t.Fatalf("expected ReviewTimeoutMinutes to default to 120, got %d", cfg.ReviewTimeoutMinutes)
	}
	if cfg.ReviewTimeoutAction != "pass" {
		t.Fatalf("expected ReviewTimeoutAction to default to 'pass', got %s", cfg.ReviewTimeoutAction)
	}
}

func TestParseJevRuleConfig_RespectsExplicitAutoCreateReportFalse(t *testing.T) {
	explicitJSON := `{"maxContentLength":5000,"autoCreateReport":false,"reviewTimeoutMinutes":60,"reviewTimeoutAction":"reject"}`
	cfg := parseJevRuleConfig(explicitJSON, dto.DefaultJevRuleConfig())

	if cfg.AutoCreateReport {
		t.Fatalf("expected explicit autoCreateReport:false to be respected, got true")
	}
	if cfg.ReviewTimeoutMinutes != 60 {
		t.Fatalf("expected ReviewTimeoutMinutes to be 60, got %d", cfg.ReviewTimeoutMinutes)
	}
	if cfg.ReviewTimeoutAction != "reject" {
		t.Fatalf("expected ReviewTimeoutAction to be 'reject', got %s", cfg.ReviewTimeoutAction)
	}
}

