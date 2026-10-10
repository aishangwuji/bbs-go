package services

import (
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"

	"bbs-go/internal/pkg/params"

	"errors"
	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var TaskRewardService = newTaskRewardService()

func newTaskRewardService() *taskRewardService {
	return &taskRewardService{}
}

type taskRewardService struct {
}

func (s *taskRewardService) Get(id int64) *models.TaskReward {
	return repositories.TaskRewardRepository.Get(sqls.DB(), id)
}

func (s *taskRewardService) Take(where ...interface{}) *models.TaskReward {
	return repositories.TaskRewardRepository.Take(sqls.DB(), where...)
}

func (s *taskRewardService) Find(cnd *sqls.Cnd) []models.TaskReward {
	return repositories.TaskRewardRepository.Find(sqls.DB(), cnd)
}

func (s *taskRewardService) FindOne(cnd *sqls.Cnd) *models.TaskReward {
	return repositories.TaskRewardRepository.FindOne(sqls.DB(), cnd)
}

// FindEnabledByTaskId 查询任务下启用的奖励明细（发放顺序）
func (s *taskRewardService) FindEnabledByTaskId(taskId int64) []models.TaskReward {
	return repositories.TaskRewardRepository.FindEnabledByTaskId(sqls.DB(), taskId)
}

func (s *taskRewardService) FindPageByParams(params *params.QueryParams) (list []models.TaskReward, paging *sqls.Paging) {
	return repositories.TaskRewardRepository.FindPageByParams(sqls.DB(), params)
}

func (s *taskRewardService) FindPageByCnd(cnd *sqls.Cnd) (list []models.TaskReward, paging *sqls.Paging) {
	return repositories.TaskRewardRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *taskRewardService) Count(cnd *sqls.Cnd) int64 {
	return repositories.TaskRewardRepository.Count(sqls.DB(), cnd)
}

func (s *taskRewardService) Create(t *models.TaskReward) error {
	if err := s.validate(t); err != nil {
		return err
	}
	return repositories.TaskRewardRepository.Create(sqls.DB(), t)
}

func (s *taskRewardService) Update(t *models.TaskReward) error {
	if err := s.validate(t); err != nil {
		return err
	}
	t.UpdateTime = dates.NowTimestamp()
	return repositories.TaskRewardRepository.Update(sqls.DB(), t)
}

func (s *taskRewardService) Updates(id int64, columns map[string]interface{}) error {
	return repositories.TaskRewardRepository.Updates(sqls.DB(), id, columns)
}

func (s *taskRewardService) GetNextSortNo(taskId int64) int {
	if max := s.FindOne(sqls.NewCnd().Eq("task_id", taskId).Eq("status", constants.StatusOk).Desc("sort_no")); max != nil {
		return max.SortNo + 1
	}
	return 0
}

func (s *taskRewardService) UpdateSort(ids []int64) error {
	return sqls.DB().Transaction(func(tx *gorm.DB) error {
		for i, id := range ids {
			if err := repositories.TaskRewardRepository.UpdateColumn(tx, id, "sort_no", i); err != nil {
				return err
			}
		}
		return nil
	})
}

// validate 奖励明细边界校验：任务存在、奖励类型启用、数值语义合法
// Business Rule: badge 明细必须带 badgeId 且 amount 置 0；score/exp 明细 amount 必须 >0。
func (s *taskRewardService) validate(t *models.TaskReward) error {
	if t.TaskId <= 0 {
		return errors.New("taskId is required")
	}
	if TaskConfigService.Get(t.TaskId) == nil {
		return errors.New("task not found")
	}
	if !RewardTypeDefService.IsEnabled(t.RewardCode) {
		return errors.New("rewardCode not defined or disabled: " + t.RewardCode)
	}
	switch t.RewardCode {
	case "badge":
		if t.BadgeId <= 0 {
			return errors.New("badgeId is required for badge reward")
		}
	case "score", "exp":
		if t.Amount <= 0 {
			return errors.New("amount must be positive for " + t.RewardCode)
		}
	}
	return nil
}
