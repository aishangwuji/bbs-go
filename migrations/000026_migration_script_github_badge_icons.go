package migrations

import (
	"bbs-go/internal/models"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

// migrate_github_badge_icons 为 GitHub 系列自动勋章补齐本地 SVG 图标（统一走 /res 内链）：
//   - 这些勋章由 user_github_profile_service.ensureBadge 按条件动态创建，早期 icon 为空或指向外链 CDN；
//   - 本迁移按稳定标识 name 将其 icon 统一改为本地资源，避免外链失效与空图标；
//   - 幂等：仅当 icon 与目标不一致时更新，可重复执行；未创建的勋章（如 star_owner）无行则自动跳过，
//     后续由 ensureBadge 以本地路径新建。
func migrate_github_badge_icons() error {
	presets := map[string]string{
		"github_developer":   "/res/images/badges/badge_github_developer.svg",
		"github_star_owner":  "/res/images/badges/badge_github_star_owner.svg",
		"github_contributor": "/res/images/badges/badge_github_contributor.svg",
	}
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		now := dates.NowTimestamp()
		for name, icon := range presets {
			if err := ctx.Tx.Model(&models.Badge{}).
				Where("name = ? AND (icon IS NULL OR icon <> ?)", name, icon).
				Updates(map[string]interface{}{
					"icon":        icon,
					"update_time": now,
				}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
