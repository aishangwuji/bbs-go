package admin

import (
	"bbs-go/internal/cache"
	"bbs-go/internal/models"
	"bbs-go/internal/services"
	"strconv"

	"github.com/gin-gonic/gin"

	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/web"
)

func UserBadgeDetail(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	t := services.UserBadgeService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Not found, id="+strconv.FormatInt(id, 10)))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func UserBadgeList(ctx *gin.Context) {
	list, paging := services.UserBadgeService.FindPageByCnd(params.NewPagedSqlCnd(ctx,
		params.QueryFilter{
			ParamName: "userId",
			Op:        params.Eq,
		},
		params.QueryFilter{
			ParamName: "badgeId",
			Op:        params.Eq,
		},
		params.QueryFilter{
			ParamName: "sourceType",
			Op:        params.Eq,
		},
	).Desc("id"))
	ginx.WriteJSON(ctx, &web.PageResult{Results: web.ConvertList(list, func(item models.UserBadge) map[string]any {
		b := web.NewRspBuilder(item)
		if badge := cache.BadgeCache.GetByID(item.BadgeId); badge != nil {
			b.Put("icon", badge.Icon)
		}
		return b.Build()
	}), Page: paging})

}

type GrantUserBadgeForm struct {
	UserId  int64  `json:"userId" form:"userId"`
	BadgeId int64  `json:"badgeId" form:"badgeId"`
	Reason  string `json:"reason" form:"reason"`
}

// UserBadgeGrant 管理员手动向指定用户特赐颁发勋章
func UserBadgeGrant(ctx *gin.Context) {
	var form GrantUserBadgeForm
	if err := ginx.Bind(ctx, &form); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	if form.UserId <= 0 || form.BadgeId <= 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("用户ID和勋章ID不能为空"))
		return
	}

	badge := cache.BadgeCache.GetByID(form.BadgeId)
	if badge == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("勋章不存在"))
		return
	}

	reason := form.Reason
	if reason == "" {
		reason = "管理员特赐授予"
	}

	err := services.UserBadgeService.GiveNoTx(form.UserId, form.BadgeId, "manual", reason)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	ginx.WriteJSON(ctx, nil)
}

// UserBadgeDelete 管理员撤回/删除用户的勋章
func UserBadgeDelete(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		if val, ok := params.GetInt64(ctx, "id"); ok {
			id = val
		}
	}
	if id <= 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("无效的勋章记录ID"))
		return
	}

	if err := services.UserBadgeService.Delete(id); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	ginx.WriteJSON(ctx, nil)
}

