package services

import (
	"bbs-go/internal/cache"
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/pkg/event"
	"bbs-go/internal/pkg/params"
	"bbs-go/internal/repositories"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var BadgeService = newBadgeService()

func newBadgeService() *badgeService {
	return &badgeService{}
}

type badgeService struct {
}

func (s *badgeService) Get(id int64) *models.Badge {
	return repositories.BadgeRepository.Get(sqls.DB(), id)
}

func (s *badgeService) Take(where ...interface{}) *models.Badge {
	return repositories.BadgeRepository.Take(sqls.DB(), where...)
}

func (s *badgeService) Find(cnd *sqls.Cnd) []models.Badge {
	return repositories.BadgeRepository.Find(sqls.DB(), cnd)
}

func (s *badgeService) FindOne(cnd *sqls.Cnd) *models.Badge {
	return repositories.BadgeRepository.FindOne(sqls.DB(), cnd)
}

func (s *badgeService) FindPageByParams(params *params.QueryParams) (list []models.Badge, paging *sqls.Paging) {
	return repositories.BadgeRepository.FindPageByParams(sqls.DB(), params)
}

func (s *badgeService) FindPageByCnd(cnd *sqls.Cnd) (list []models.Badge, paging *sqls.Paging) {
	return repositories.BadgeRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *badgeService) Count(cnd *sqls.Cnd) int64 {
	return repositories.BadgeRepository.Count(sqls.DB(), cnd)
}

func (s *badgeService) Create(t *models.Badge) error {
	if err := repositories.BadgeRepository.Create(sqls.DB(), t); err != nil {
		return err
	}
	cache.BadgeCache.Reload()
	return nil
}

func (s *badgeService) Update(t *models.Badge) error {
	if err := repositories.BadgeRepository.Update(sqls.DB(), t); err != nil {
		return err
	}
	cache.BadgeCache.Reload()
	return nil
}

func (s *badgeService) Updates(id int64, columns map[string]interface{}) error {
	if err := repositories.BadgeRepository.Updates(sqls.DB(), id, columns); err != nil {
		return err
	}
	cache.BadgeCache.Reload()
	return nil
}

func (s *badgeService) GetNextSortNo() int {
	if max := s.FindOne(sqls.NewCnd().Eq("status", constants.StatusOk).Desc("sort_no")); max != nil {
		return max.SortNo + 1
	}
	return 0
}

func (s *badgeService) UpdateSort(ids []int64) error {
	if err := sqls.DB().Transaction(func(tx *gorm.DB) error {
		for i, id := range ids {
			if err := repositories.BadgeRepository.UpdateColumn(tx, id, "sort_no", i); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return err
	}
	cache.BadgeCache.Reload()
	return nil
}

// ScanAndAwardUserBadges 根据当前用户状态扫描并自动解锁满足条件的勋章
func (s *badgeService) ScanAndAwardUserBadges(userId int64) (awarded []models.Badge, err error) {
	if userId <= 0 {
		return nil, nil
	}

	user := UserService.Get(userId)
	if user == nil || user.Status != constants.StatusOk {
		return nil, nil
	}

	// 从缓存中获取所有启用的 auto 勋章
	autoBadges := make([]models.Badge, 0)
	for _, badge := range cache.BadgeCache.GetAll() {
		if badge.Status == constants.StatusOk && badge.GrantType == constants.BadgeGrantTypeAuto && badge.RuleField != "" && badge.RuleValue > 0 {
			autoBadges = append(autoBadges, badge)
		}
	}
	if len(autoBadges) == 0 {
		return nil, nil
	}

	// 获取用户已拥有勋章 ID 集合
	ownedBadges := cache.UserBadgeCache.GetByUser(userId)
	ownedBadgeMap := make(map[int64]bool, len(ownedBadges))
	for _, ub := range ownedBadges {
		ownedBadgeMap[ub.BadgeId] = true
	}

	var (
		checkIn        *models.CheckIn
		checkInFetched bool
		now            = dates.NowTimestamp()
		regDays        = int((now - user.CreateTime) / (86400 * 1000))
	)

	for _, badge := range autoBadges {
		if ownedBadgeMap[badge.Id] {
			continue
		}

		userVal := 0
		switch badge.RuleField {
		case constants.BadgeRuleTopicCount:
			userVal = user.TopicCount
		case constants.BadgeRuleCommentCount:
			userVal = user.CommentCount
		case constants.BadgeRuleLevel:
			userVal = user.Level
		case constants.BadgeRuleExp:
			userVal = user.Exp
		case constants.BadgeRuleScore:
			userVal = user.Score
		case constants.BadgeRuleFansCount:
			userVal = user.FansCount
		case constants.BadgeRuleRegDays:
			userVal = regDays
		case constants.BadgeRuleConsecutiveDays:
			if !checkInFetched {
				checkIn = CheckInService.GetByUserId(userId)
				checkInFetched = true
			}
			if checkIn != nil {
				userVal = checkIn.ConsecutiveDays
			}
		default:
			continue
		}

		if userVal >= badge.RuleValue {
			targetBadgeId := badge.Id
			ruleField := badge.RuleField
			err := sqls.DB().Transaction(func(tx *gorm.DB) error {
				txCtx := &sqls.TxContext{Tx: tx}
				return UserBadgeService.Give(txCtx, userId, targetBadgeId, "rule", ruleField)
			})
			if err == nil {
				awarded = append(awarded, badge)
				ownedBadgeMap[targetBadgeId] = true
				event.Send(event.BadgeGrantEvent{
					UserId:     userId,
					BadgeId:    targetBadgeId,
					UpdateTime: now,
				})
			}
		}
	}

	return awarded, nil
}
