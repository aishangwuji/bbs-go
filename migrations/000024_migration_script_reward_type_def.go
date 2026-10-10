package migrations

import (
	"bbs-go/internal/models"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

// migrate_reward_type_def 建奖励类型定义表与任务奖励明细表并预置 score/exp/badge：
// 冗余说明：DB 只管“发什么、发多少、开不开启”，真正落库逻辑在 Go RewardGranter 注册表，
// 加全新奖励类型需先发版注册 executor 再配行（见 RewardTypeDef.Executor 字段）。
// TaskConfig.Score/Exp/BadgeId 旧列本版保留双写兼容，历史任务无明细行时引擎回退旧列发放。
// 强制提供自闭环中文注释。
func migrate_reward_type_def() error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := ctx.Tx.AutoMigrate(&models.RewardTypeDef{}, &models.TaskReward{}); err != nil {
			return err
		}
		seeds := []models.RewardTypeDef{
			{Code: "score", NameZh: "积分", NameEn: "Score", Executor: "score", Enabled: 1, Status: 0, SortNo: 10},
			{Code: "exp", NameZh: "经验", NameEn: "Experience", Executor: "exp", Enabled: 1, Status: 0, SortNo: 20},
			{Code: "badge", NameZh: "勋章", NameEn: "Badge", Executor: "badge", Enabled: 1, Status: 0, SortNo: 30},
		}
		now := dates.NowTimestamp()
		for i := range seeds {
			exists := &models.RewardTypeDef{}
			if err := ctx.Tx.Where("code = ?", seeds[i].Code).First(exists).Error; err == nil && exists.Id > 0 {
				continue
			}
			seeds[i].CreateTime = now
			seeds[i].UpdateTime = now
			if err := ctx.Tx.Create(&seeds[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
