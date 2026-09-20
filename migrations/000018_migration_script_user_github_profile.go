package migrations

import (
	"bbs-go/internal/models"
	"github.com/mlogclub/simple/sqls"
)

// migrate_user_github_profile 创建用户 GitHub 开发者开源画像与贡献证明表
// 表名：t_user_github_profile
// 字段强制提供自闭环中文注释、软删除（deleted_at）与审计字段（create_time、update_time）
func migrate_user_github_profile() error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		return ctx.Tx.AutoMigrate(&models.UserGithubProfile{})
	})
}
