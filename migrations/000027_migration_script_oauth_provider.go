package migrations

import (
	"bbs-go/internal/models"

	"github.com/mlogclub/simple/sqls"
)

// migrate_oauth_provider 创建 OAuth 2.0 统一身份认证中心相关的 t_oauth_client 与 t_oauth_token 表
// 支持北向行者等第一方及子系统作为 RP 客户端接入，强制自闭环中文注释
func migrate_oauth_provider() error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		return ctx.Tx.AutoMigrate(&models.OAuthClient{}, &models.OAuthToken{})
	})
}
