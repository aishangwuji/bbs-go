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

func TaskRewardDetail(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	t := services.TaskRewardService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Not found, id="+strconv.FormatInt(id, 10)))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func TaskRewardList(ctx *gin.Context) {
	list, paging := services.TaskRewardService.FindPageByCnd(params.NewPagedSqlCnd(ctx,
		params.QueryFilter{
			ParamName: "taskId",
			Op:        params.Eq,
		},
		params.QueryFilter{
			ParamName: "rewardCode",
			Op:        params.Eq,
		},
		params.QueryFilter{
			ParamName: "status",
			Op:        params.Eq,
		},
	).Asc("sort_no").Desc("id"))
	ginx.WriteJSON(ctx, &web.PageResult{Results: list, Page: paging})

}

func TaskRewardCreate(ctx *gin.Context) {
	t := &models.TaskReward{}
	if err := ginx.Bind(ctx, t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	now := dates.NowTimestamp()
	t.SortNo = services.TaskRewardService.GetNextSortNo(t.TaskId)
	t.Status = constants.StatusOk
	t.CreateTime = now
	t.UpdateTime = now
	// Business Rule: 任务归属、奖励类型启用、数值语义由 Service.validate 统一校验。
	if err := services.TaskRewardService.Create(t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func TaskRewardUpdate(ctx *gin.Context) {
	id, _ := params.GetInt64(ctx, "id")
	t := services.TaskRewardService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("entity not found"))
		return
	}

	if err := ginx.Bind(ctx, t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	if err := services.TaskRewardService.Update(t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func TaskRewardUpdateSort(ctx *gin.Context) {
	var ids []int64
	if err := ginx.BindJSON(ctx, &ids); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	if err := services.TaskRewardService.UpdateSort(ids); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

func TaskRewardRemove(ctx *gin.Context) {
	ids := params.GetInt64Arr(ctx, "ids")
	if len(ids) == 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("delete ids is empty"))
		return
	}
	now := dates.NowTimestamp()
	for _, id := range ids {
		services.TaskRewardService.Updates(id, map[string]interface{}{
			"status":      constants.StatusDeleted,
			"update_time": now,
		})
	}
	ginx.WriteJSON(ctx, nil)

}
