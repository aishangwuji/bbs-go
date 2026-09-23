package admin

import (
	"bbs-go/internal/models/dto"
	"bbs-go/internal/pkg/common"
	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/pkg/params"
	"bbs-go/internal/repositories"
	"bbs-go/internal/services"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/common/jsons"
	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/sqls"
	"github.com/mlogclub/simple/web"
	"github.com/spf13/cast"
)

// JevRuleGet 获取 Jev 细粒度规则引擎配置
func JevRuleGet(ctx *gin.Context) {
	cfg := services.SysConfigService.GetJevRuleConfig()
	ginx.WriteJSON(ctx, cfg)
}

// JevRuleSaveReq 保存规则配置请求结构
type JevRuleSaveReq struct {
	dto.JevRuleConfig
	Remark string `json:"remark"` // 变更备注说明
}

// JevRuleSave 保存 Jev 细粒度规则引擎配置
func JevRuleSave(ctx *gin.Context) {
	var req JevRuleSaveReq
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	var operatorId int64
	var operatorName string
	if user := common.GetCurrentUser(ctx); user != nil {
		operatorId = user.Id
		operatorName = user.Nickname
		if strs.IsBlank(operatorName) {
			operatorName = user.Username.String
		}
	}

	if err := services.SysConfigService.SetJevRuleConfig(req.JevRuleConfig, operatorId, operatorName, req.Remark); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	ginx.WriteJSON(ctx, nil)
}

// JevRuleHistoryList 获取 Jev 规则配置历史版本分页列表
func JevRuleHistoryList(ctx *gin.Context) {
	page := params.FormValueIntDefault(ctx, "page", 1)
	limit := params.FormValueIntDefault(ctx, "limit", 20)

	cnd := sqls.NewCnd().
		Page(page, limit).
		Desc("id")

	list, paging := repositories.JevRuleHistoryRepository.FindPageByCnd(sqls.DB(), cnd)
	ginx.WriteJSON(ctx, &web.PageResult{Results: list, Page: paging})
}

// JevRuleHistoryDetail 获取单个历史版本的具体配置
func JevRuleHistoryDetail(ctx *gin.Context) {
	id := params.FormValueInt64Default(ctx, "id", 0)
	if id <= 0 {
		id = cast.ToInt64(ctx.Param("id"))
	}
	history := repositories.JevRuleHistoryRepository.Get(sqls.DB(), id)
	if history == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("未找到对应的历史版本记录"))
		return
	}
	ginx.WriteJSON(ctx, history)
}

// JevRuleHistoryRollbackReq 回滚历史版本请求参数
type JevRuleHistoryRollbackReq struct {
	HistoryId int64  `json:"historyId"` // 目标回滚历史版本编号
	Remark    string `json:"remark"`    // 可选回滚备注说明
}

// JevRuleHistoryRollback 将指定历史版本回滚为当前生效规则（单向追加审计链）
func JevRuleHistoryRollback(ctx *gin.Context) {
	var req JevRuleHistoryRollbackReq
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	if req.HistoryId <= 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("请指定要回滚的历史版本编号"))
		return
	}

	history := repositories.JevRuleHistoryRepository.Get(sqls.DB(), req.HistoryId)
	if history == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("未找到指定的历史版本记录"))
		return
	}

	var cfg dto.JevRuleConfig
	if err := jsons.Parse(history.ConfigContent, &cfg); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("解析该历史版本配置失败: "+err.Error()))
		return
	}

	var operatorId int64
	var operatorName string
	if user := common.GetCurrentUser(ctx); user != nil {
		operatorId = user.Id
		operatorName = user.Nickname
		if strs.IsBlank(operatorName) {
			operatorName = user.Username.String
		}
	}

	rollbackRemark := "回滚至版本: " + history.Version
	if strs.IsNotBlank(req.Remark) {
		rollbackRemark += " (" + strings.TrimSpace(req.Remark) + ")"
	}

	if err := services.SysConfigService.SetJevRuleConfig(cfg, operatorId, operatorName, rollbackRemark); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	ginx.WriteJSON(ctx, nil)
}

// JevRuleSimulateReq 规则仿真沙盒请求参数
type JevRuleSimulateReq struct {
	Title   string             `json:"title"`
	Content string             `json:"content"`
	RuleCfg *dto.JevRuleConfig `json:"ruleCfg,omitempty"` // 可选自定义规则，支持未保存时即时预览
}

// JevRuleSimulateResponse 规则仿真沙盒响应结果
type JevRuleSimulateResponse struct {
	Decision    *services.ModerationDecision `json:"decision"`
	RawResponse string                       `json:"rawResponse"`
}

// JevRuleSimulate 在线仿真沙盒测试接口
func JevRuleSimulate(ctx *gin.Context) {
	var req JevRuleSimulateReq
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	if strings.TrimSpace(req.Content) == "" {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("仿真评测内容不能为空"))
		return
	}

	decision, _, err := services.ModerationService.Simulate(ctx.Request.Context(), req.Title, req.Content, req.RuleCfg)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("仿真评测失败: "+err.Error()))
		return
	}

	ginx.WriteJSON(ctx, &JevRuleSimulateResponse{
		Decision:    decision,
		RawResponse: decision.RawResponse,
	})
}
