package services

import (
	"log/slog"

	"bbs-go/internal/cache"
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"

	"github.com/mlogclub/simple/sqls"
)

// 评论计数对账自愈（L2）。
//
// Business Rule: t_topic/t_comment(父级)/t_user 的 comment_count 必须等于
// status=StatusOk 的可见评论数。L0 状态机保证增量正确，本文件收敛存量脏数据
// （Jev 拦截漏扣、历史 Delete 未扣话题、Audit 重复加等）。
//
// 设计取舍（生产级工程导向）：
//   - 不在启动时全表重算（大数据量会卡死启动，见 systemmap 4.1 决策），改为
//     每日低峰分批扫描 + 脏行才写，干净行零写入。
//   - 按 id 游标 ASC 分批，避免 OFFSET 深翻页；每批 200，单次 cron 上限可配。
//   - 只修计数，不碰 last_comment_*（排序语义变更需产品另行确认，见清单技术债）。

// RecalcTopicCommentCount 重算单个话题的可见评论数，脏行才写。
// 返回 realCount（可见数）与 fixed（是否修复过）。
func (s *commentService) RecalcTopicCommentCount(topicId int64) (realCount int64, fixed bool, err error) {
	topic := TopicService.Get(topicId)
	if topic == nil {
		return 0, false, nil
	}
	realCount = repositories.CommentRepository.Count(sqls.DB(), sqls.NewCnd().
		Eq("entity_type", constants.EntityTopic).
		Eq("entity_id", topicId).
		Eq("status", constants.StatusOk))
	if realCount == topic.CommentCount {
		return realCount, false, nil
	}
	// 直接按真实值覆盖（对账场景下 CAS 无意义：源头就是漂移，以 COUNT(*) 为准）。
	if err := repositories.TopicRepository.UpdateColumn(sqls.DB(), topicId, "comment_count", realCount); err != nil {
		return realCount, false, err
	}
	slog.Info("[CommentReconcile] 修复话题评论计数",
		slog.Int64("topicId", topicId), slog.Int64("before", topic.CommentCount), slog.Int64("after", realCount))
	return realCount, true, nil
}

// RecalcReplyCommentCount 重算单个父评论的可见回复数，脏行才写。
func (s *commentService) RecalcReplyCommentCount(commentId int64) (realCount int64, fixed bool, err error) {
	parent := s.Get(commentId)
	if parent == nil {
		return 0, false, nil
	}
	realCount = repositories.CommentRepository.Count(sqls.DB(), sqls.NewCnd().
		Eq("entity_type", constants.EntityComment).
		Eq("entity_id", commentId).
		Eq("status", constants.StatusOk))
	if realCount == parent.CommentCount {
		return realCount, false, nil
	}
	if err := repositories.CommentRepository.UpdateColumn(sqls.DB(), commentId, "comment_count", realCount); err != nil {
		return realCount, false, err
	}
	slog.Info("[CommentReconcile] 修复父评论回复计数",
		slog.Int64("commentId", commentId), slog.Int64("before", parent.CommentCount), slog.Int64("after", realCount))
	return realCount, true, nil
}

// RecalcUserCommentCount 重算单个用户的可见跟帖数，脏行才写。
func (s *commentService) RecalcUserCommentCount(userId int64) (realCount int64, fixed bool, err error) {
	user := UserService.Get(userId)
	if user == nil {
		return 0, false, nil
	}
	realCount = repositories.CommentRepository.Count(sqls.DB(), sqls.NewCnd().
		Eq("user_id", userId).
		Eq("status", constants.StatusOk))
	if int(realCount) == user.CommentCount {
		return realCount, false, nil
	}
	if err := repositories.UserRepository.UpdateColumn(sqls.DB(), userId, "comment_count", realCount); err != nil {
		return realCount, false, err
	}
	cache.UserCache.Invalidate(userId)
	slog.Info("[CommentReconcile] 修复用户跟帖计数",
		slog.Int64("userId", userId), slog.Int("before", user.CommentCount), slog.Int64("after", realCount))
	return realCount, true, nil
}

// ReconcileTopicCommentCounts 分批对账话题计数，返回 (检查数, 修复数)。
// limit 为本次最多检查的话题数（0 表示默认 500）。
func (s *commentService) ReconcileTopicCommentCounts(limit int) (checked, fixed int, err error) {
	if limit <= 0 {
		limit = 500
	}
	var cursor int64
	batchSize := 200
	for checked < limit {
		n := batchSize
		if checked+n > limit {
			n = limit - checked
		}
		topics := repositories.TopicRepository.Find(sqls.DB(), sqls.NewCnd().
			Gt("id", cursor).Asc("id").Limit(n))
		if len(topics) == 0 {
			break
		}
		for _, topic := range topics {
			cursor = topic.Id
			checked++
			if _, f, e := s.RecalcTopicCommentCount(topic.Id); e != nil {
				return checked, fixed, e
			} else if f {
				fixed++
			}
		}
		if len(topics) < n {
			break
		}
	}
	slog.Info("[CommentReconcile] 话题对账完成", slog.Int("checked", checked), slog.Int("fixed", fixed))
	return checked, fixed, nil
}

// ReconcileUserCommentCounts 分批对账用户跟帖计数，返回 (检查数, 修复数)。
func (s *commentService) ReconcileUserCommentCounts(limit int) (checked, fixed int, err error) {
	if limit <= 0 {
		limit = 500
	}
	var cursor int64
	batchSize := 200
	for checked < limit {
		n := batchSize
		if checked+n > limit {
			n = limit - checked
		}
		var users []models.User
		users = repositories.UserRepository.Find(sqls.DB(), sqls.NewCnd().
			Gt("id", cursor).Asc("id").Limit(n))
		if len(users) == 0 {
			break
		}
		for _, user := range users {
			cursor = user.Id
			checked++
			if _, f, e := s.RecalcUserCommentCount(user.Id); e != nil {
				return checked, fixed, e
			} else if f {
				fixed++
			}
		}
		if len(users) < n {
			break
		}
	}
	slog.Info("[CommentReconcile] 用户对账完成", slog.Int("checked", checked), slog.Int("fixed", fixed))
	return checked, fixed, nil
}

// ReconcileReplyCommentCounts 分批对账父评论回复计数，返回 (检查数, 修复数)。
// 仅扫描 comment_count > 0 的评论（干净的 0 行无需 COUNT 查询）。
func (s *commentService) ReconcileReplyCommentCounts(limit int) (checked, fixed int, err error) {
	if limit <= 0 {
		limit = 500
	}
	var cursor int64
	batchSize := 200
	for checked < limit {
		n := batchSize
		if checked+n > limit {
			n = limit - checked
		}
		comments := repositories.CommentRepository.Find(sqls.DB(), sqls.NewCnd().
			Gt("id", cursor).Where("comment_count > 0").Asc("id").Limit(n))
		if len(comments) == 0 {
			break
		}
		for _, comment := range comments {
			cursor = comment.Id
			checked++
			if _, f, e := s.RecalcReplyCommentCount(comment.Id); e != nil {
				return checked, fixed, e
			} else if f {
				fixed++
			}
		}
		if len(comments) < n {
			break
		}
	}
	slog.Info("[CommentReconcile] 父评论对账完成", slog.Int("checked", checked), slog.Int("fixed", fixed))
	return checked, fixed, nil
}
