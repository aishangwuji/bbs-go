package migrations

import (
	"bbs-go/internal/models"
	"github.com/mlogclub/simple/sqls"
)

// migrate_moderation_decision_snapshot 为风控留痕表 t_moderation_record 补充决策快照字段：
//   - hit_reasons：命中原因 JSON 数组（触发下架/待审的规则原因）
//   - dimension_results：全维度评估快照 JSON 数组（当次配置的各维度 key/label/取值/判定）
//
// 目的：Jev 规则策略（维度可增删改）在「Jev规则配置」中动态调整，原先仅落库的
// is_spam/toxicity 两个固定 key 无法表达实际策略；快照随记录自包含，配置变更后仍可还原。
// 历史记录两字段留空，前端优雅降级。强制提供自闭环中文注释。
func migrate_moderation_decision_snapshot() error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		return ctx.Tx.AutoMigrate(&models.ModerationRecord{})
	})
}
