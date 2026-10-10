package services

import (
	"bbs-go/internal/models"
	"bbs-go/internal/pkg/event"
	"errors"
	"sync"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

// RewardGranter 奖励执行插件接口：DB 只管“发什么、发多少、开不开启”，真正落库靠注册表。
// 新增奖励类型 = 实现本接口 + init 中 Register，无需改 TaskEngine 引擎代码。
// Go 特性：接口隐式实现，小写 struct 对外只暴露行为，符合 Idiomatic Go。
type RewardGranter interface {
	// Code 与 t_reward_type_def.code 一致，大小写敏感。
	Code() string
	// Grant 在同一事务内发放一条奖励明细，sourceId 为 UserTaskLog.Id（幂等关联）。
	Grant(ctx *sqls.TxContext, userId int64, reward models.TaskReward, sourceId string) error
}

var (
	grantersMu     sync.RWMutex
	rewardGranters = make(map[string]RewardGranter)
)

// RegisterRewardGranter 注册奖励执行器，重复注册直接覆盖（以后发先到为准）。
func RegisterRewardGranter(g RewardGranter) {
	if g == nil || g.Code() == "" {
		return
	}
	grantersMu.Lock()
	defer grantersMu.Unlock()
	rewardGranters[g.Code()] = g
}

// GetRewardGranter 按编码取执行器，未注册返回 nil（调用方跳过并发警告）。
func GetRewardGranter(code string) RewardGranter {
	grantersMu.RLock()
	defer grantersMu.RUnlock()
	return rewardGranters[code]
}

func init() {
	RegisterRewardGranter(&scoreGranter{})
	RegisterRewardGranter(&expGranter{})
	RegisterRewardGranter(&badgeGranter{})
}

type scoreGranter struct{}

func (g *scoreGranter) Code() string { return "score" }

func (g *scoreGranter) Grant(ctx *sqls.TxContext, userId int64, reward models.TaskReward, sourceId string) error {
	if reward.Amount == 0 {
		return errors.New("amount cannot be zero")
	}
	return UserService.addScore(ctx, userId, reward.Amount, "task", sourceId, "task reward")
}

type expGranter struct{}

func (g *expGranter) Code() string { return "exp" }

func (g *expGranter) Grant(ctx *sqls.TxContext, userId int64, reward models.TaskReward, sourceId string) error {
	if reward.Amount == 0 {
		return errors.New("amount cannot be zero")
	}
	return UserService.addExpTx(ctx, userId, reward.Amount, "task", sourceId, "task reward")
}

type badgeGranter struct{}

func (g *badgeGranter) Code() string { return "badge" }

func (g *badgeGranter) Grant(ctx *sqls.TxContext, userId int64, reward models.TaskReward, sourceId string) error {
	if reward.BadgeId <= 0 {
		return errors.New("badgeId is required")
	}
	if err := UserBadgeService.Give(ctx, userId, reward.BadgeId, "task", sourceId); err != nil {
		return err
	}
	badgeUserId := userId
	badgeId := reward.BadgeId
	ctx.RegisterCallback(func() {
		event.Send(event.BadgeGrantEvent{
			UserId:     badgeUserId,
			BadgeId:    badgeId,
			UpdateTime: dates.NowTimestamp(),
		})
	})
	return nil
}
