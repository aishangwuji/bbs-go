package admin

import (
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/pkg/common"
	"bbs-go/internal/pkg/errs"
	"bbs-go/internal/pkg/idcodec"
	"bbs-go/internal/repositories"
	"bbs-go/internal/services"
	"fmt"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"

	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/web"
)

func UserReportDetail(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}

	t := services.UserReportService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Not found, id="+strconv.FormatInt(id, 10)))
		return
	}
	ginx.WriteJSON(ctx, buildUserReportDetail(t))

}

func UserReportList(ctx *gin.Context) {
	cnd := params.NewPagedSqlCnd(ctx,
		params.QueryFilter{
			ParamName: "dataType",
			Op:        params.Eq,
		},
		params.QueryFilter{
			ParamName: "dataId",
			Op:        params.Eq,
		},
		params.QueryFilter{
			ParamName: "auditStatus",
			Op:        params.Eq,
		},
	)

	source := ctx.DefaultPostForm("source", ctx.Query("source"))
	if source == "jev" {
		cnd.Eq("user_id", 0)
	} else if source == "user" {
		cnd.Gt("user_id", 0)
	}

	list, paging := services.UserReportService.FindPageByCnd(cnd.Desc("id"))
	ginx.WriteJSON(ctx, &web.PageResult{Results: list, Page: paging})
}

func UserReportCreate(ctx *gin.Context) {
	t := &models.UserReport{}
	err := ginx.Bind(ctx, t)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	err = services.UserReportService.Create(t)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	ginx.WriteJSON(ctx, t)

}

func UserReportAudit(ctx *gin.Context) {
	id, _ := params.GetInt64(ctx, "id")
	if id <= 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("id is required"))
		return
	}

	auditStatus, _ := params.GetInt64(ctx, "auditStatus")
	if auditStatus != 1 && auditStatus != 2 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("auditStatus must be 1 or 2"))
		return
	}

	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}

	t := services.UserReportService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("entity not found"))
		return
	}

	t.AuditStatus = auditStatus
	t.AuditTime = dates.NowTimestamp()
	t.AuditUserId = user.Id
	if err := services.UserReportService.Update(t); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	// 联动级联处理底层业务实体状态
	if auditStatus == 2 {
		// 合规放行通过：若原实体处于待审状态，解冻恢复正常
		switch t.DataType {
		case "topic":
			_ = services.TopicService.Audit(t.DataId)
		case "article":
			_ = services.ArticleService.UpdateColumn(t.DataId, "status", constants.StatusOk)
		case "comment":
			_ = services.CommentService.Audit(t.DataId)
		}
	} else if auditStatus == 1 {
		// 违规下架驳回：将原实体软删除，并累加原作者的累计违规次数
		var targetUserId int64
		switch t.DataType {
		case "topic":
			if topic := services.TopicService.Get(t.DataId); topic != nil {
				targetUserId = topic.UserId
			}
			_ = repositories.TopicRepository.UpdateColumn(sqls.DB(), t.DataId, "status", constants.StatusDeleted)
		case "article":
			if article := services.ArticleService.Get(t.DataId); article != nil {
				targetUserId = article.UserId
			}
			_ = repositories.ArticleRepository.UpdateColumn(sqls.DB(), t.DataId, "status", constants.StatusDeleted)
		case "comment":
			if comment := services.CommentService.Get(t.DataId); comment != nil {
				targetUserId = comment.UserId
			}
			_ = services.CommentService.Delete(t.DataId)
		case "user":
			targetUserId = t.DataId
		}
		if targetUserId > 0 {
			services.UserService.IncrViolationCount(targetUserId, fmt.Sprintf("审核工单 #%d 确认违规下架 (%s #%d)", t.Id, t.DataType, t.DataId))
		}
	}

	ginx.WriteJSON(ctx, t)
}

func buildUserReportDetail(report *models.UserReport) map[string]interface{} {
	detail := web.NewRspBuilder(report).Build()
	detail["target"] = buildUserReportTarget(report)
	return detail
}

func buildUserReportTarget(report *models.UserReport) map[string]interface{} {
	if report == nil {
		return nil
	}

	target := map[string]interface{}{
		"type": report.DataType,
		"id":   report.DataId,
	}

	switch report.DataType {
	case "topic":
		if topic := services.TopicService.Get(report.DataId); topic != nil {
			target["title"] = topic.Title
			target["content"] = topic.Content
			target["contentType"] = topic.ContentType
			target["userId"] = topic.UserId
			target["status"] = topic.Status
			target["url"] = "/topic/" + idcodec.Encode(topic.Id)
			return target
		}
	case "article":
		if article := services.ArticleService.Get(report.DataId); article != nil {
			target["title"] = article.Title
			target["summary"] = article.Summary
			target["content"] = article.Content
			target["contentType"] = article.ContentType
			target["userId"] = article.UserId
			target["status"] = article.Status
			target["url"] = "/article/" + strconv.FormatInt(article.Id, 10)
			return target
		}
	case "comment":
		if comment := services.CommentService.Get(report.DataId); comment != nil {
			target["content"] = comment.Content
			target["contentType"] = comment.ContentType
			target["userId"] = comment.UserId
			target["entityType"] = comment.EntityType
			target["entityId"] = comment.EntityId
			target["quoteId"] = comment.QuoteId
			target["status"] = comment.Status
			if comment.EntityType == constants.EntityTopic {
				target["title"] = "针对话题 #" + strconv.FormatInt(comment.EntityId, 10) + " 的评论"
				target["url"] = "/topic/" + idcodec.Encode(comment.EntityId)
			} else if comment.EntityType == constants.EntityArticle {
				target["title"] = "针对文章 #" + strconv.FormatInt(comment.EntityId, 10) + " 的评论"
				target["url"] = "/article/" + strconv.FormatInt(comment.EntityId, 10)
			} else {
				target["title"] = "评论 #" + strconv.FormatInt(comment.Id, 10)
			}
			return target
		}
	case "user":
		if user := services.UserService.Get(report.DataId); user != nil {
			target["title"] = user.Nickname
			target["username"] = user.Username.String
			target["nickname"] = user.Nickname
			target["description"] = user.Description
			target["avatar"] = user.Avatar
			target["status"] = user.Status
			target["url"] = "/user/" + idcodec.Encode(user.Id)
			return target
		}
	}

	target["missing"] = true
	return target
}

func UserReportUpdate(ctx *gin.Context) {
	id, err := params.FormValueInt64(ctx, "id")
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	t := services.UserReportService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("entity not found"))
		return
	}

	err = ginx.Bind(ctx, t)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	err = services.UserReportService.Update(t)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	ginx.WriteJSON(ctx, t)

}
