package migrations

import (
	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"

	"bbs-go/internal/models"
)

// migrate_signature_config_defaults 个性签名最低等级门槛默认值
// 设计：签名功能需要“达到一定等级才可设置”，门槛由后台配置（signatureMinLevel）
//       默认 3 级，0 表示不限制。t_user.signature 列由 AutoMigrate 依据 models.User 自动添加。
func migrate_signature_config_defaults() error {
	const signatureMinLevelKey = "signatureMinLevel"

	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		existing := &models.SysConfig{}
		if err := ctx.Tx.Where("`key` = ?", signatureMinLevelKey).
			Take(existing).Error; err == nil {
			// 已存在则不覆盖管理员配置（幂等）
			return nil
		}

		return ctx.Tx.Create(&models.SysConfig{
			Key:         signatureMinLevelKey,
			Value:       "3",
			Name:        "Signature minimum level",
			Description: "Minimum user level required to set a signature (0 = no restriction)",
			CreateTime:  dates.NowTimestamp(),
			UpdateTime:  dates.NowTimestamp(),
		}).Error
	})
}
