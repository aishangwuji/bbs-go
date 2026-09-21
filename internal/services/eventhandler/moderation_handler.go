package eventhandler

import (
	"context"
	"log/slog"
	"reflect"
	"time"

	"bbs-go/internal/models/constants"
	"bbs-go/internal/pkg/event"
	"bbs-go/internal/repositories"
	"bbs-go/internal/services"

	"github.com/mlogclub/simple/sqls"
)

func init() {
	event.RegHandler(reflect.TypeOf(event.TopicCreateEvent{}), handleTopicCreateModerationEvent)
	event.RegHandler(reflect.TypeOf(event.TopicUpdateEvent{}), handleTopicUpdateModerationEvent)
	event.RegHandler(reflect.TypeOf(event.CommentCreateEvent{}), handleCommentModerationEvent)
	event.RegHandler(reflect.TypeOf(event.ArticleCreateEvent{}), handleArticleCreateModerationEvent)
	event.RegHandler(reflect.TypeOf(event.ArticleUpdateEvent{}), handleArticleUpdateModerationEvent)
}

// handleTopicCreateModerationEvent 话题创建后的异步智能内容风控
func handleTopicCreateModerationEvent(i interface{}) {
	e, ok := i.(event.TopicCreateEvent)
	if !ok {
		return
	}

	cfg := services.SysConfigService.GetJevConfig()
	if !cfg.Enabled || cfg.ApiKey == "" {
		return
	}

	topic := repositories.TopicRepository.Get(sqls.DB(), e.TopicId)
	if topic == nil || topic.Status != constants.StatusOk {
		// 话题不存在或已经被设为待审/删除，无需重复处理
		return
	}

	timeout := time.Duration(cfg.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if _, err := services.ModerationService.AuditTopic(ctx, topic); err != nil {
		slog.Warn("[ModerationHandler] 异步审核新发话题失败", slog.Int64("topicId", topic.Id), slog.Any("err", err))
	}
}

// handleTopicUpdateModerationEvent 话题修改后的异步智能内容风控（防止内容偷换违规）
func handleTopicUpdateModerationEvent(i interface{}) {
	e, ok := i.(event.TopicUpdateEvent)
	if !ok {
		return
	}

	cfg := services.SysConfigService.GetJevConfig()
	if !cfg.Enabled || cfg.ApiKey == "" {
		return
	}

	topic := repositories.TopicRepository.Get(sqls.DB(), e.TopicId)
	if topic == nil || topic.Status == constants.StatusDeleted {
		return
	}

	timeout := time.Duration(cfg.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if _, err := services.ModerationService.AuditTopic(ctx, topic); err != nil {
		slog.Warn("[ModerationHandler] 异步审核修改后话题失败", slog.Int64("topicId", topic.Id), slog.Any("err", err))
	}
}

// handleCommentModerationEvent 评论创建后的异步智能内容风控（支持一级与二级评论）
func handleCommentModerationEvent(i interface{}) {
	e, ok := i.(event.CommentCreateEvent)
	if !ok {
		return
	}

	cfg := services.SysConfigService.GetJevConfig()
	if !cfg.Enabled || cfg.ApiKey == "" {
		return
	}

	comment := repositories.CommentRepository.Get(sqls.DB(), e.CommentId)
	if comment == nil || comment.Status != constants.StatusOk {
		return
	}

	timeout := time.Duration(cfg.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if _, err := services.ModerationService.AuditComment(ctx, comment); err != nil {
		slog.Warn("[ModerationHandler] 异步审核评论失败", slog.Int64("commentId", comment.Id), slog.Any("err", err))
	}
}

// handleArticleCreateModerationEvent 文章发布后的异步智能内容风控
func handleArticleCreateModerationEvent(i interface{}) {
	e, ok := i.(event.ArticleCreateEvent)
	if !ok {
		return
	}

	cfg := services.SysConfigService.GetJevConfig()
	if !cfg.Enabled || cfg.ApiKey == "" {
		return
	}

	article := repositories.ArticleRepository.Get(sqls.DB(), e.ArticleId)
	if article == nil || article.Status != constants.StatusOk {
		return
	}

	timeout := time.Duration(cfg.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if _, err := services.ModerationService.AuditArticle(ctx, article); err != nil {
		slog.Warn("[ModerationHandler] 异步审核新发文章失败", slog.Int64("articleId", article.Id), slog.Any("err", err))
	}
}

// handleArticleUpdateModerationEvent 文章修改后的异步智能内容风控
func handleArticleUpdateModerationEvent(i interface{}) {
	e, ok := i.(event.ArticleUpdateEvent)
	if !ok {
		return
	}

	cfg := services.SysConfigService.GetJevConfig()
	if !cfg.Enabled || cfg.ApiKey == "" {
		return
	}

	article := repositories.ArticleRepository.Get(sqls.DB(), e.ArticleId)
	if article == nil || article.Status == constants.StatusDeleted {
		return
	}

	timeout := time.Duration(cfg.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if _, err := services.ModerationService.AuditArticle(ctx, article); err != nil {
		slog.Warn("[ModerationHandler] 异步审核修改后文章失败", slog.Int64("articleId", article.Id), slog.Any("err", err))
	}
}
