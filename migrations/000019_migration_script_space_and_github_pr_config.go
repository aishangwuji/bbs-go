package migrations

import (
	"bbs-go/internal/models"
	"github.com/mlogclub/simple/sqls"
)

// migrate_space_and_github_pr_config 添加用户个人空间模块可见性配置与 GitHub 合并 PR 自选字段
// 表变更：
// 1. t_user: 新增 space_modules_config 字段
// 2. t_user_github_profile: 新增 merged_prs 与 selected_pr_url 字段
// 字段强制提供自闭环中文注释
func migrate_space_and_github_pr_config() error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := ctx.Tx.AutoMigrate(&models.User{}); err != nil {
			return err
		}
		return ctx.Tx.AutoMigrate(&models.UserGithubProfile{})
	})
}
