package migrations

import (
	"bbs-go/internal/models"
	"github.com/mlogclub/simple/sqls"
)

// migrate_moderation_record 创建智能内容风控留痕表 t_moderation_record
// 记录 Jev System One 判定分值、置信度、处置建议与最终审核状态
// 强制提供自闭环中文注释
func migrate_moderation_record() error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		return ctx.Tx.AutoMigrate(&models.ModerationRecord{})
	})
}
