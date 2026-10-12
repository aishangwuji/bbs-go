package render

import (
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"testing"
)

func TestBuildTask_FallbackLegacyRewards(t *testing.T) {
	cfg := &models.TaskConfig{
		Model:          models.Model{Id: 1},
		GroupName:      constants.TaskGroupDaily,
		Title:          "每日签到",
		EventType:      "check_in",
		Period:         int(constants.TaskPeriodDaily),
		EventCount:     1,
		MaxFinishCount: 1,
		Score:          10,
		Exp:            20,
		BadgeId:        0,
		Status:         constants.StatusOk,
	}

	// 传入空切片模拟无明细表配置，触发旧三列平滑合成
	res := BuildTask(cfg, nil, 0, []models.TaskReward{})
	if len(res.Rewards) != 2 {
		t.Fatalf("expected 2 synthesized rewards, got %d", len(res.Rewards))
	}

	if res.Rewards[0].RewardCode != "score" || res.Rewards[0].Amount != 10 {
		t.Errorf("expected score reward 10, got %+v", res.Rewards[0])
	}
	if res.Rewards[1].RewardCode != "exp" || res.Rewards[1].Amount != 20 {
		t.Errorf("expected exp reward 20, got %+v", res.Rewards[1])
	}
}

func TestBuildTask_MultiRewards(t *testing.T) {
	cfg := &models.TaskConfig{
		Model:          models.Model{Id: 2},
		GroupName:      constants.TaskGroupAchievement,
		Title:          "成就达成",
		EventType:      "post_topic",
		Period:         int(constants.TaskPeriodLifetime),
		EventCount:     10,
		MaxFinishCount: 1,
		Status:         constants.StatusOk,
	}

	rewards := []models.TaskReward{
		{Model: models.Model{Id: 1}, TaskId: 2, RewardCode: "score", Amount: 200, Status: 0},
		{Model: models.Model{Id: 2}, TaskId: 2, RewardCode: "exp", Amount: 150, Status: 0},
		{Model: models.Model{Id: 3}, TaskId: 2, RewardCode: "badge", BadgeId: 8, Status: 0},
	}

	res := BuildTask(cfg, nil, 0, rewards)
	if len(res.Rewards) != 3 {
		t.Fatalf("expected 3 rewards, got %d", len(res.Rewards))
	}
	if res.Rewards[0].RewardCode != "score" || res.Rewards[0].Amount != 200 {
		t.Errorf("reward[0] mismatch: %+v", res.Rewards[0])
	}
	if res.Rewards[1].RewardCode != "exp" || res.Rewards[1].Amount != 150 {
		t.Errorf("reward[1] mismatch: %+v", res.Rewards[1])
	}
	if res.Rewards[2].RewardCode != "badge" || res.Rewards[2].BadgeId != 8 {
		t.Errorf("reward[2] mismatch: %+v", res.Rewards[2])
	}
}
