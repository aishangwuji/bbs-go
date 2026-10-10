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

func RewardTypeDefDetail(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	t := services.RewardTypeDefService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Not found, id="+strconv.FormatInt(id, 10)))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func RewardTypeDefList(ctx *gin.Context) {
	list, paging := services.RewardTypeDefService.FindPageByCnd(params.NewPagedSqlCnd(ctx,
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

func RewardTypeDefCreate(ctx *gin.Context) {
	t := &models.RewardTypeDef{}
	if err := ginx.Bind(ctx, t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	if t.Code == "" {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("code is required"))
		return
	}
	if services.RewardTypeDefService.Take("code = ?", t.Code) != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("code already exists"))
		return
	}
	// Business Rule: executor 必须有对应的 Go Granter 注册，否则配了也发不出去。
	if services.GetRewardGranter(t.Executor) == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("executor not registered: "+t.Executor))
		return
	}

	now := dates.NowTimestamp()
	t.SortNo = services.RewardTypeDefService.GetNextSortNo()
	t.Status = constants.StatusOk
	if t.Enabled != 0 {
		t.Enabled = 1
	}
	t.CreateTime = now
	t.UpdateTime = now
	if err := services.RewardTypeDefService.Create(t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func RewardTypeDefUpdate(ctx *gin.Context) {
	id, _ := params.GetInt64(ctx, "id")
	t := services.RewardTypeDefService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("entity not found"))
		return
	}

	if err := ginx.Bind(ctx, t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	if services.GetRewardGranter(t.Executor) == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("executor not registered: "+t.Executor))
		return
	}

	t.UpdateTime = dates.NowTimestamp()
	if err := services.RewardTypeDefService.Update(t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func RewardTypeDefUpdateSort(ctx *gin.Context) {
	var ids []int64
	if err := ginx.BindJSON(ctx, &ids); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	if err := services.RewardTypeDefService.UpdateSort(ids); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

func RewardTypeDefRemove(ctx *gin.Context) {
	ids := params.GetInt64Arr(ctx, "ids")
	if len(ids) == 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("delete ids is empty"))
		return
	}
	now := dates.NowTimestamp()
	for _, id := range ids {
		services.RewardTypeDefService.Updates(id, map[string]interface{}{
			"status":      constants.StatusDeleted,
			"update_time": now,
		})
	}
	ginx.WriteJSON(ctx, nil)

}
