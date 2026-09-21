package eventhandler

import (
	"context"
	"log/slog"
	"reflect"
	"time"

	"bbs-go/internal/models/constants"
	"bbs-go/internal/pkg/config"
	"bbs-go/internal/pkg/event"
	"bbs-go/internal/repositories"
	"bbs-go/internal/services"

	"github.com/mlogclub/simple/sqls"
)

func init() {
	event.RegHandler(reflect.TypeOf(event.TopicCreateEvent{}), handleTopicModerationEvent)
	event.RegHandler(reflect.TypeOf(event.CommentCreateEvent{}), handleCommentModerationEvent)
}

// handleTopicModerationEvent 话题创建后的异步智能内容风控
func handleTopicModerationEvent(i interface{}) {
	e, ok := i.(event.TopicCreateEvent)
	if !ok {
		return
	}

	cfg := config.Instance
	if cfg == nil || !cfg.Jev.Enabled || cfg.Jev.ApiKey == "" {
		return
	}

	topic := repositories.TopicRepository.Get(sqls.DB(), e.TopicId)
	if topic == nil || topic.Status != constants.StatusOk {
		// 话题不存在或已经被设为待审/删除，无需重复处理
		return
	}

	timeout := time.Duration(cfg.Jev.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if _, err := services.ModerationService.AuditTopic(ctx, topic); err != nil {
		slog.Warn("[ModerationHandler] 异步审核话题失败", slog.Int64("topicId", topic.Id), slog.Any("err", err))
	}
}

// handleCommentModerationEvent 评论创建后的异步智能内容风控
func handleCommentModerationEvent(i interface{}) {
	e, ok := i.(event.CommentCreateEvent)
	if !ok {
		return
	}

	cfg := config.Instance
	if cfg == nil || !cfg.Jev.Enabled || cfg.Jev.ApiKey == "" {
		return
	}

	comment := repositories.CommentRepository.Get(sqls.DB(), e.CommentId)
	if comment == nil || comment.Status != constants.StatusOk {
		return
	}

	timeout := time.Duration(cfg.Jev.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if _, err := services.ModerationService.AuditComment(ctx, comment); err != nil {
		slog.Warn("[ModerationHandler] 异步审核评论失败", slog.Int64("commentId", comment.Id), slog.Any("err", err))
	}
}
