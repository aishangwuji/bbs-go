package admin

import (
	"strconv"

	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/pkg/params"
	"bbs-go/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/web"
)

// ModerationRecordDetail 获取单条智能风控拦截记录详情
func ModerationRecordDetail(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	record := services.ModerationService.Get(id)
	if record == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("未找到风控记录, id="+strconv.FormatInt(id, 10)))
		return
	}
	ginx.WriteJSON(ctx, record)
}

// ModerationRecordList 分页检索智能风控拦截日志
func ModerationRecordList(ctx *gin.Context) {
	list, paging := services.ModerationService.FindPageByCnd(params.NewPagedSqlCnd(ctx,
		params.QueryFilter{
			ParamName: "entityType",
			Op:        params.Eq,
		},
		params.QueryFilter{
			ParamName: "suggestedAction",
			Op:        params.Eq,
		},
		params.QueryFilter{
			ParamName: "finalAction",
			Op:        params.Eq,
		},
		params.QueryFilter{
			ParamName: "userId",
			Op:        params.Eq,
		},
		params.QueryFilter{
			ParamName: "entityId",
			Op:        params.Eq,
		},
	).Desc("id"))

	ginx.WriteJSON(ctx, &web.PageResult{Results: list, Page: paging})
}
