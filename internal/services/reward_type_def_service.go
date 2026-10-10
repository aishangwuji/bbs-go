package services

import (
	"bbs-go/internal/cache"
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"

	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var RewardTypeDefService = newRewardTypeDefService()

func newRewardTypeDefService() *rewardTypeDefService {
	return &rewardTypeDefService{}
}

type rewardTypeDefService struct {
}

func (s *rewardTypeDefService) Get(id int64) *models.RewardTypeDef {
	return repositories.RewardTypeDefRepository.Get(sqls.DB(), id)
}

func (s *rewardTypeDefService) Take(where ...interface{}) *models.RewardTypeDef {
	return repositories.RewardTypeDefRepository.Take(sqls.DB(), where...)
}

func (s *rewardTypeDefService) Find(cnd *sqls.Cnd) []models.RewardTypeDef {
	return repositories.RewardTypeDefRepository.Find(sqls.DB(), cnd)
}

func (s *rewardTypeDefService) FindOne(cnd *sqls.Cnd) *models.RewardTypeDef {
	return repositories.RewardTypeDefRepository.FindOne(sqls.DB(), cnd)
}

func (s *rewardTypeDefService) FindPageByParams(params *params.QueryParams) (list []models.RewardTypeDef, paging *sqls.Paging) {
	return repositories.RewardTypeDefRepository.FindPageByParams(sqls.DB(), params)
}

func (s *rewardTypeDefService) FindPageByCnd(cnd *sqls.Cnd) (list []models.RewardTypeDef, paging *sqls.Paging) {
	return repositories.RewardTypeDefRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *rewardTypeDefService) Count(cnd *sqls.Cnd) int64 {
	return repositories.RewardTypeDefRepository.Count(sqls.DB(), cnd)
}

// IsEnabled 奖励编码是否可用（定义存在、启用、未删除）
// Reason: 发放路径每次调用，管理后台写操作低频，直接查库保证正确性。
func (s *rewardTypeDefService) IsEnabled(code string) bool {
	if code == "" {
		return false
	}
	def := repositories.RewardTypeDefRepository.Take(sqls.DB(), "code = ?", code)
	return def != nil && def.Status == constants.StatusOk && def.Enabled == 1
}

func (s *rewardTypeDefService) Create(t *models.RewardTypeDef) error {
	if err := repositories.RewardTypeDefRepository.Create(sqls.DB(), t); err != nil {
		return err
	}

	cache.RewardTypeDefCacheService.Reload()
	return nil
}

func (s *rewardTypeDefService) Update(t *models.RewardTypeDef) error {
	if err := repositories.RewardTypeDefRepository.Update(sqls.DB(), t); err != nil {
		return err
	}
	cache.RewardTypeDefCacheService.Reload()
	return nil
}

func (s *rewardTypeDefService) Updates(id int64, columns map[string]interface{}) error {
	if err := repositories.RewardTypeDefRepository.Updates(sqls.DB(), id, columns); err != nil {
		return err
	}
	cache.RewardTypeDefCacheService.Reload()
	return nil
}

func (s *rewardTypeDefService) GetNextSortNo() int {
	if max := s.FindOne(sqls.NewCnd().Eq("status", constants.StatusOk).Desc("sort_no")); max != nil {
		return max.SortNo + 1
	}
	return 0
}

func (s *rewardTypeDefService) UpdateSort(ids []int64) error {
	if err := sqls.DB().Transaction(func(tx *gorm.DB) error {
		for i, id := range ids {
			if err := repositories.RewardTypeDefRepository.UpdateColumn(tx, id, "sort_no", i); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return err
	}
	cache.RewardTypeDefCacheService.Reload()
	return nil
}
