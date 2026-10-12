package render

import (
	"bbs-go/internal/cache"
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/models/resp"
	"bbs-go/internal/pkg/locales"
	"bbs-go/internal/repositories"
	"bbs-go/internal/services"
	"strconv"

	"github.com/mlogclub/simple/sqls"
)

func BuildTaskGroups() []resp.TaskGroupInfo {
	groups := []resp.TaskGroupInfo{
		{Key: constants.TaskGroupDaily},
		{Key: constants.TaskGroupNewbie},
		{Key: constants.TaskGroupAchievement},
	}

	for i := range groups {
		key := groups[i].Key
		groups[i].Name = locales.Get("task.group." + string(key))
		if groups[i].Name == "" {
			groups[i].Name = string(key)
		}
	}

	return groups
}

func BuildTask(cfg *models.TaskConfig, user *models.User, now int64, taskRewards ...[]models.TaskReward) resp.TaskResponse {
	var progress *resp.TaskProgressResponse

	if user != nil {
		periodKey := 0
		if constants.TaskPeriod(cfg.Period) != constants.TaskPeriodLifetime {
			if pkStr := services.TaskEngineService.GetPeriodKey(constants.TaskPeriod(cfg.Period), now); pkStr != "" {
				if v, err := strconv.Atoi(pkStr); err == nil {
					periodKey = v
				}
			}
		}

		ute := repositories.UserTaskEventRepository.Take(sqls.DB(), "user_id = ? AND period_key = ? AND task_id = ?", user.Id, periodKey, cfg.Id)
		progress = &resp.TaskProgressResponse{
			PeriodKey:      periodKey,
			EventProgress:  0,
			EventTarget:    cfg.EventCount,
			FinishedCount:  0,
			MaxFinishCount: cfg.MaxFinishCount,
		}
		if ute != nil {
			progress.EventProgress = ute.EventCount
			progress.FinishedCount = ute.TaskFinishCount
		}
	}

	var itemRewards []models.TaskReward
	if len(taskRewards) > 0 {
		itemRewards = taskRewards[0]
	} else {
		itemRewards = services.TaskRewardService.FindEnabledByTaskId(cfg.Id)
	}

	rewardsList := make([]resp.TaskRewardResponse, 0, len(itemRewards))
	if len(itemRewards) > 0 {
		for _, r := range itemRewards {
			tr := resp.TaskRewardResponse{
				Id:         r.Id,
				RewardCode: r.RewardCode,
				Amount:     r.Amount,
				BadgeId:    r.BadgeId,
			}
			if def := cache.RewardTypeDefCacheService.GetByCode(r.RewardCode); def != nil {
				tr.NameZh = def.NameZh
				tr.NameEn = def.NameEn
			}
			if r.RewardCode == "badge" && r.BadgeId > 0 {
				if b := cache.BadgeCache.GetByID(r.BadgeId); b != nil {
					tr.Badge = &resp.BadgeResponse{
						Id:          b.Id,
						Name:        b.Name,
						Title:       b.Title,
						Description: b.Description,
						Icon:        b.Icon,
						SortNo:      b.SortNo,
						Status:      b.Status,
						BadgeType:   b.BadgeType,
					}
				}
			}
			rewardsList = append(rewardsList, tr)
		}
	} else {
		// 历史存量兜底：若尚未为该任务配置多奖励明细，从旧三列合成回填，对齐新旧消费方
		if cfg.Score > 0 {
			rewardsList = append(rewardsList, resp.TaskRewardResponse{
				RewardCode: "score",
				NameZh:     "积分",
				NameEn:     "Score",
				Amount:     cfg.Score,
			})
		}
		if cfg.Exp > 0 {
			rewardsList = append(rewardsList, resp.TaskRewardResponse{
				RewardCode: "exp",
				NameZh:     "经验",
				NameEn:     "Exp",
				Amount:     cfg.Exp,
			})
		}
		if cfg.BadgeId > 0 {
			tr := resp.TaskRewardResponse{
				RewardCode: "badge",
				NameZh:     "勋章",
				NameEn:     "Badge",
				BadgeId:    cfg.BadgeId,
			}
			if b := cache.BadgeCache.GetByID(cfg.BadgeId); b != nil {
				tr.Badge = &resp.BadgeResponse{
					Id:          b.Id,
					Name:        b.Name,
					Title:       b.Title,
					Description: b.Description,
					Icon:        b.Icon,
					SortNo:      b.SortNo,
					Status:      b.Status,
					BadgeType:   b.BadgeType,
				}
			}
			rewardsList = append(rewardsList, tr)
		}
	}

	return resp.TaskResponse{
		Id:             cfg.Id,
		GroupName:      cfg.GroupName,
		Title:          cfg.Title,
		Description:    cfg.Description,
		EventType:      cfg.EventType,
		Period:         constants.TaskPeriod(cfg.Period),
		EventCount:     cfg.EventCount,
		MaxFinishCount: cfg.MaxFinishCount,
		Score:          cfg.Score,
		Exp:            cfg.Exp,
		BadgeId:        cfg.BadgeId,
		BtnName:        cfg.BtnName,
		ActionUrl:      cfg.ActionUrl,
		SortNo:         cfg.SortNo,
		StartTime:      cfg.StartTime,
		EndTime:        cfg.EndTime,
		Status:         cfg.Status,
		Rewards:        rewardsList,
		UserProgress:   progress,
	}
}

// BuildTasks 批量渲染任务列表，单次 IN 查询批量聚合并发奖明细，解决 N+1 数据库查询
func BuildTasks(taskConfigs []models.TaskConfig, user *models.User, now int64) []resp.TaskResponse {
	if len(taskConfigs) == 0 {
		return []resp.TaskResponse{}
	}
	taskIds := make([]int64, len(taskConfigs))
	for i, cfg := range taskConfigs {
		taskIds[i] = cfg.Id
	}
	rewardsMap := services.TaskRewardService.FindEnabledMapByTaskIds(taskIds)

	res := make([]resp.TaskResponse, 0, len(taskConfigs))
	for i := range taskConfigs {
		cfg := &taskConfigs[i]
		if cfg.StartTime > 0 && now < cfg.StartTime {
			continue
		}
		if cfg.EndTime > 0 && now > cfg.EndTime {
			continue
		}
		res = append(res, BuildTask(cfg, user, now, rewardsMap[cfg.Id]))
	}
	return res
}
