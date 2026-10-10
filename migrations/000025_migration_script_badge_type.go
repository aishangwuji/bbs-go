package migrations

import (
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

// migrate_badge_type 为勋章引入「分级」维度（铜/银/金）并回填初始 8 枚勋章的分级：
//   - badge_type 列由 AutoMigrate 依据 models.Badge 自动添加（默认 0=未分级）；
//   - 本迁移只做一次性数据回填，按稳定标识 name 匹配，且仅当当前仍为「未分级」时才写入，
//     因而可重复执行且不会覆盖管理员后续在后台手动调整过的分级；
//   - 分级是纯视觉权重，不改变发放逻辑（发放仍由 grantType/ruleField 决定）。
func migrate_badge_type() error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := ctx.Tx.AutoMigrate(&models.Badge{}); err != nil {
			return err
		}

		now := dates.NowTimestamp()
		presets := map[string]int{
			string(constants.BadgeNameNewcomer):     constants.BadgeTypeBronze,
			string(constants.BadgeNameFirstPost):    constants.BadgeTypeBronze,
			string(constants.BadgeNameFirstComment): constants.BadgeTypeBronze,
			string(constants.BadgeNameAuthor):       constants.BadgeTypeSilver,
			string(constants.BadgeNameHelper):       constants.BadgeTypeSilver,
			string(constants.BadgeNameStreak7):      constants.BadgeTypeSilver,
			string(constants.BadgeNameStreak30):     constants.BadgeTypeGold,
			string(constants.BadgeNameVeteran):      constants.BadgeTypeGold,
		}
		for name, badgeType := range presets {
			if err := ctx.Tx.Model(&models.Badge{}).
				Where("name = ? AND badge_type = ?", name, constants.BadgeTypeNone).
				Updates(map[string]interface{}{
					"badge_type":  badgeType,
					"update_time": now,
				}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
