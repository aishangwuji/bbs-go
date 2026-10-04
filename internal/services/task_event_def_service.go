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

var TaskEventDefService = newTaskEventDefService()

func newTaskEventDefService() *taskEventDefService {
	return &taskEventDefService{}
}

type taskEventDefService struct {
}

func (s *taskEventDefService) Get(id int64) *models.TaskEventDef {
	return repositories.TaskEventDefRepository.Get(sqls.DB(), id)
}

func (s *taskEventDefService) Take(where ...interface{}) *models.TaskEventDef {
	return repositories.TaskEventDefRepository.Take(sqls.DB(), where...)
}

func (s *taskEventDefService) Find(cnd *sqls.Cnd) []models.TaskEventDef {
	return repositories.TaskEventDefRepository.Find(sqls.DB(), cnd)
}

func (s *taskEventDefService) FindOne(cnd *sqls.Cnd) *models.TaskEventDef {
	return repositories.TaskEventDefRepository.FindOne(sqls.DB(), cnd)
}

func (s *taskEventDefService) FindPageByParams(params *params.QueryParams) (list []models.TaskEventDef, paging *sqls.Paging) {
	return repositories.TaskEventDefRepository.FindPageByParams(sqls.DB(), params)
}

func (s *taskEventDefService) FindPageByCnd(cnd *sqls.Cnd) (list []models.TaskEventDef, paging *sqls.Paging) {
	return repositories.TaskEventDefRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *taskEventDefService) Count(cnd *sqls.Cnd) int64 {
	return repositories.TaskEventDefRepository.Count(sqls.DB(), cnd)
}

// IsEnabled 事件编码是否启用（供 TaskConfig 创建时做边界校验）
// Business Rule: 未定义或 status != StatusOk 的编码一律拒绝，防止配出永远触发不了的孤儿任务。
// Reason: 直接查库不走缓存，管理后台写操作低频，正确性优先，避免测试/多库场景下全局缓存串库。
func (s *taskEventDefService) IsEnabled(code string) bool {
	if code == "" {
		return false
	}
	def := repositories.TaskEventDefRepository.Take(sqls.DB(), "code = ?", code)
	return def != nil && def.Status == constants.StatusOk
}

func (s *taskEventDefService) Create(t *models.TaskEventDef) error {
	if err := repositories.TaskEventDefRepository.Create(sqls.DB(), t); err != nil {
		return err
	}

	cache.TaskEventDefCacheService.Reload()
	return nil
}

func (s *taskEventDefService) Update(t *models.TaskEventDef) error {
	if err := repositories.TaskEventDefRepository.Update(sqls.DB(), t); err != nil {
		return err
	}
	cache.TaskEventDefCacheService.Reload()
	return nil
}

func (s *taskEventDefService) Updates(id int64, columns map[string]interface{}) error {
	if err := repositories.TaskEventDefRepository.Updates(sqls.DB(), id, columns); err != nil {
		return err
	}
	cache.TaskEventDefCacheService.Reload()
	return nil
}

func (s *taskEventDefService) GetNextSortNo() int {
	if max := s.FindOne(sqls.NewCnd().Eq("status", constants.StatusOk).Desc("sort_no")); max != nil {
		return max.SortNo + 1
	}
	return 0
}

func (s *taskEventDefService) UpdateSort(ids []int64) error {
	if err := sqls.DB().Transaction(func(tx *gorm.DB) error {
		for i, id := range ids {
			if err := repositories.TaskEventDefRepository.UpdateColumn(tx, id, "sort_no", i); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return err
	}
	cache.TaskEventDefCacheService.Reload()
	return nil
}
