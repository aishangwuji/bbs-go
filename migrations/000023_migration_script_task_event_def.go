package migrations

import (
	"bbs-go/internal/models"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

// migrate_task_event_def 建任务事件定义表并预置 10 种事件：
// 冗余说明：发射点仍在 Go 代码 event.Send 处，本表只管“收到事件后怎么办”的定义与开关，
// 新增全新行为仍需发版注册发射点（见 TaskEventDef.Producer 字段）。
// 历史 TaskConfig.eventType 自由字符串自此收敛为外键语义，非法编码在创建时拒绝。
// 强制提供自闭环中文注释。
func migrate_task_event_def() error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := ctx.Tx.AutoMigrate(&models.TaskEventDef{}); err != nil {
			return err
		}
		seeds := []models.TaskEventDef{
			{Code: "user.login", NameZh: "每日登录", NameEn: "Daily login", Producer: "misc_render.Login", Status: 0, SortNo: 10},
			{Code: "checkin", NameZh: "签到", NameEn: "Check-in", Producer: "CheckInService.CheckIn", Status: 0, SortNo: 20},
			{Code: "topic.create", NameZh: "发帖", NameEn: "Create topic", Producer: "TopicService.Publish", Status: 0, SortNo: 30},
			{Code: "qa.question.publish", NameZh: "发布问题", NameEn: "Publish question", Producer: "TopicService.Publish(QA)", Status: 0, SortNo: 40},
			{Code: "qa.answer.accept", NameZh: "回答被采纳", NameEn: "Answer accepted", Producer: "TopicService.AcceptAnswer", Status: 0, SortNo: 50},
			{Code: "comment.create", NameZh: "评论", NameEn: "Create comment", Producer: "CommentService.Create", Status: 0, SortNo: 60},
			{Code: "follow.create", NameZh: "关注用户", NameEn: "Follow user", Producer: "FollowService.Follow", Status: 0, SortNo: 70},
			{Code: "favorite.create", NameZh: "收藏", NameEn: "Favorite", Producer: "FavoriteService.Add", Status: 0, SortNo: 80},
			{Code: "like.create", NameZh: "点赞", NameEn: "Like", Producer: "LikeService.Like", Status: 0, SortNo: 90},
			{Code: "level.10", NameZh: "达到等级 10", NameEn: "Reach level 10", Producer: "UserService.addExpTx(LevelUpEvent)", Status: 0, SortNo: 100},
		}
		now := dates.NowTimestamp()
		for i := range seeds {
			exists := &models.TaskEventDef{}
			if err := ctx.Tx.Where("code = ?", seeds[i].Code).First(exists).Error; err == nil && exists.Id > 0 {
				continue
			}
			seeds[i].CreateTime = now
			seeds[i].UpdateTime = now
			if err := ctx.Tx.Create(&seeds[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
