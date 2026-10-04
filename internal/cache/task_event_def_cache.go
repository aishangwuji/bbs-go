package cache

import (
	"time"

	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"

	"github.com/goburrow/cache"
	"github.com/mlogclub/simple/sqls"
)

const taskEventDefCacheKey = "all_task_event_defs"

// taskEventDefCacheService keeps TaskEventDef in memory for quick reads.
type taskEventDefCacheService struct {
	cache cache.LoadingCache
}

var TaskEventDefCacheService = newTaskEventDefCacheService()

func newTaskEventDefCacheService() *taskEventDefCacheService {
	return &taskEventDefCacheService{
		cache: cache.NewLoadingCache(
			func(key cache.Key) (value cache.Value, e error) {
				value = repositories.TaskEventDefRepository.Find(sqls.DB(), sqls.NewCnd().
					Eq("status", constants.StatusOk).
					Asc("sort_no"))
				return
			},
			cache.WithMaximumSize(1),
			cache.WithExpireAfterAccess(30*time.Minute),
		),
	}
}

// GetAll returns a defensive copy of cached TaskEventDef list.
func (s *taskEventDefCacheService) GetAll() []models.TaskEventDef {
	val, err := s.cache.Get(taskEventDefCacheKey)
	if err != nil || val == nil {
		return nil
	}
	list := val.([]models.TaskEventDef)
	cp := make([]models.TaskEventDef, len(list))
	copy(cp, list)
	return cp
}

// GetByCode returns enabled TaskEventDef by code, nil if not found/disabled.
func (s *taskEventDefCacheService) GetByCode(code string) *models.TaskEventDef {
	if code == "" {
		return nil
	}
	for _, def := range s.GetAll() {
		if def.Code == code {
			cp := def
			return &cp
		}
	}
	return nil
}

// Reload refreshes the cache immediately.
// Business Rule: 定义表增删改后必须 Reload，否则超管配置半小时不生效。
func (s *taskEventDefCacheService) Reload() {
	s.cache.Refresh(taskEventDefCacheKey)
}
