package api

import (
	"bbs-go/internal/handlers/render"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/pkg/common"
	"bbs-go/internal/services"

	"github.com/gin-gonic/gin"

	"bbs-go/internal/pkg/ginx"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

// 任务分组列表
func TaskTasks(ctx *gin.Context) {
	now := dates.NowTimestamp()

	groupName := ctx.Query("groupName")
	cnd := sqls.NewCnd().
		Eq("status", constants.StatusOk).
		Asc("sort_no").
		Asc("id")
	if groupName != "" {
		cnd.Eq("group_name", groupName)
	}

	taskConfigs := services.TaskConfigService.Find(cnd)
	user := common.GetCurrentUser(ctx)

	ginx.WriteJSON(ctx, render.BuildTasks(taskConfigs, user, now))
}

func TaskGroups(ctx *gin.Context) {
	ginx.WriteJSON(ctx, render.BuildTaskGroups())
}
