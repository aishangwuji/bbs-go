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

	c.Start()
}

func addCronFunc(c *cron.Cron, spec string, cmd func()) {
	if _, err := c.AddFunc(spec, cmd); err != nil {
		slog.Error("add cron func error", slog.Any("err", err))
	}
}
