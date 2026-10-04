package admin

import (
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/services"
	"strconv"

	"github.com/gin-gonic/gin"

	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/web"
)

func TaskEventDefDetail(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	t := services.TaskEventDefService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Not found, id="+strconv.FormatInt(id, 10)))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func TaskEventDefList(ctx *gin.Context) {
	list, paging := services.TaskEventDefService.FindPageByCnd(params.NewPagedSqlCnd(ctx,
		params.QueryFilter{
			ParamName: "id",
		},
		params.QueryFilter{
			ParamName: "code",
			Op:        params.Like,
		},
		params.QueryFilter{
			ParamName: "status",
			Op:        params.Eq,
		},
	).Asc("sort_no").Desc("id"))
	ginx.WriteJSON(ctx, &web.PageResult{Results: list, Page: paging})

}

func TaskEventDefCreate(ctx *gin.Context) {
	t := &models.TaskEventDef{}
	if err := ginx.Bind(ctx, t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	if t.Code == "" {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("code is required"))
		return
	}
	if services.TaskEventDefService.Take("code = ?", t.Code) != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("code already exists"))
		return
	}

	now := dates.NowTimestamp()
	t.SortNo = services.TaskEventDefService.GetNextSortNo()
	t.Status = constants.StatusOk
	t.CreateTime = now
	t.UpdateTime = now
	if err := services.TaskEventDefService.Create(t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func TaskEventDefUpdate(ctx *gin.Context) {
	id, _ := params.GetInt64(ctx, "id")
	t := services.TaskEventDefService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("entity not found"))
		return
	}

	if err := ginx.Bind(ctx, t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	t.UpdateTime = dates.NowTimestamp()
	if err := services.TaskEventDefService.Update(t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func TaskEventDefUpdateSort(ctx *gin.Context) {
	var ids []int64
	if err := ginx.BindJSON(ctx, &ids); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	if err := services.TaskEventDefService.UpdateSort(ids); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

func TaskEventDefRemove(ctx *gin.Context) {
	ids := params.GetInt64Arr(ctx, "ids")
	if len(ids) == 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("delete ids is empty"))
		return
	}
	now := dates.NowTimestamp()
	for _, id := range ids {
		services.TaskEventDefService.Updates(id, map[string]interface{}{
			"status":      constants.StatusDeleted,
			"update_time": now,
		})
	}
	ginx.WriteJSON(ctx, nil)

}
