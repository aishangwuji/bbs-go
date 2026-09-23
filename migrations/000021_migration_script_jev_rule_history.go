package migrations

import (
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"fmt"
	"time"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

// migrate_jev_rule_history 创建 Jev 规则引擎历史版本快照表 t_jev_rule_history
// 为风控规则提供企业级版本溯源、差异对比与一键安全回滚能力
// 强制提供自闭环中文注释
func migrate_jev_rule_history() error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := ctx.Tx.AutoMigrate(&models.JevRuleHistory{}); err != nil {
			return err
		}

		// 检查是否需要自动将当前已有规则生成初始基线快照
		var historyCount int64
		if err := ctx.Tx.Model(&models.JevRuleHistory{}).Count(&historyCount).Error; err != nil {
			return err
		}

		if historyCount == 0 {
			var sysCfg models.SysConfig
			err := ctx.Tx.Where("`key` = ?", constants.SysConfigJevRuleConfig).First(&sysCfg).Error
			if err == nil && strs.IsNotBlank(sysCfg.Value) {
				now := dates.NowTimestamp()
				initialHistory := &models.JevRuleHistory{
					Version:       fmt.Sprintf("v_%s%03d", time.Now().Format("20060102150405"), time.Now().Nanosecond()/1e6),
					ConfigContent: sysCfg.Value,
					Remark:        "系统初始历史版本基线",
					OperatorId:    0,
					OperatorName:  "system",
					IsActive:      true,
					CreateTime:    now,
				}
				if err := ctx.Tx.Create(initialHistory).Error; err != nil && err != gorm.ErrRecordNotFound {
					return err
				}
			}
		}

		return nil
	})
}
