package cache

import (
	"time"

	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"

	"github.com/goburrow/cache"
	"github.com/mlogclub/simple/sqls"
)

const rewardTypeDefCacheKey = "all_reward_type_defs"

// rewardTypeDefCacheService keeps RewardTypeDef in memory for quick reads.
type rewardTypeDefCacheService struct {
	cache cache.LoadingCache
}

var RewardTypeDefCacheService = newRewardTypeDefCacheService()

func newRewardTypeDefCacheService() *rewardTypeDefCacheService {
	return &rewardTypeDefCacheService{
		cache: cache.NewLoadingCache(
			func(key cache.Key) (value cache.Value, e error) {
				value = repositories.RewardTypeDefRepository.Find(sqls.DB(), sqls.NewCnd().
					Eq("status", constants.StatusOk).
					Asc("sort_no"))
				return
			},
			cache.WithMaximumSize(1),
			cache.WithExpireAfterAccess(30*time.Minute),
		),
	}
}

// GetAll returns a defensive copy of cached RewardTypeDef list.
func (s *rewardTypeDefCacheService) GetAll() []models.RewardTypeDef {
	val, err := s.cache.Get(rewardTypeDefCacheKey)
	if err != nil || val == nil {
		return nil
	}
	list := val.([]models.RewardTypeDef)
	cp := make([]models.RewardTypeDef, len(list))
	copy(cp, list)
	return cp
}

// GetByCode returns RewardTypeDef by code, nil if not found.
func (s *rewardTypeDefCacheService) GetByCode(code string) *models.RewardTypeDef {
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
func (s *rewardTypeDefCacheService) Reload() {
	s.cache.Refresh(rewardTypeDefCacheKey)
}
