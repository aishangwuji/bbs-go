package scheduler

import (
	"context"
	"log/slog"

	"bbs-go/internal/services"

	"github.com/robfig/cron/v3"
)

func Start() {
	c := cron.New()

	addCronFunc(c, "0 4 ? * *", func() {
		if err := services.SeoSitemapService.GenerateAndUpload(); err != nil {
			slog.Error("generate sitemap error", slog.Any("err", err))
		}
	})

	// 每 5 分钟巡检一次超时未审内容并执行自动兜底流转
	addCronFunc(c, "*/5 * * * *", func() {
		if err := services.ModerationService.HandleAuditTimeouts(context.Background()); err != nil {
			slog.Error("handle audit timeouts error", slog.Any("err", err))
		}
	})

	// 每日低峰对账评论计数（话题/父评论/用户三路，脏行才写，收敛 Jev 拦截与历史漂移）
	// Business Rule: 冗余 comment_count 必须等于 status=0 的可见数；增量由 CommentService.Transition 保证，此处只做自愈。
	addCronFunc(c, "30 3 * * *", func() {
		if _, _, err := services.CommentService.ReconcileTopicCommentCounts(500); err != nil {
			slog.Error("reconcile topic comment counts error", slog.Any("err", err))
		}
		if _, _, err := services.CommentService.ReconcileReplyCommentCounts(500); err != nil {
			slog.Error("reconcile reply comment counts error", slog.Any("err", err))
		}
		if _, _, err := services.CommentService.ReconcileUserCommentCounts(500); err != nil {
			slog.Error("reconcile user comment counts error", slog.Any("err", err))
		}
	})

	c.Start()
}

func addCronFunc(c *cron.Cron, spec string, cmd func()) {
	if _, err := c.AddFunc(spec, cmd); err != nil {
		slog.Error("add cron func error", slog.Any("err", err))
	}
}
