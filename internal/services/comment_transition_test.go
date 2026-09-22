package services

import (
	"testing"

	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

// 关键假设落地为测试：评论可见性仅由 StatusOk 决定，计数必须同增同减；
// 重试/并发重复流转必须幂等（第二次返回 applied=false 且计数不变）。

func mustCreateTopicCommentFixture(t *testing.T, userId, topicId int64, status int) *models.Comment {
	t.Helper()
	comment := &models.Comment{
		UserId:      userId,
		EntityType:  constants.EntityTopic,
		EntityId:    topicId,
		Content:     "fixture",
		ContentType: constants.ContentTypeText,
		Status:      status,
		CreateTime:  dates.NowTimestamp(),
	}
	if err := repositories.CommentRepository.Create(sqls.DB(), comment); err != nil {
		t.Fatalf("create comment: %v", err)
	}
	return comment
}

func mustSetTopicCommentCount(t *testing.T, topicId int64, count int64) {
	t.Helper()
	if err := repositories.TopicRepository.UpdateColumn(sqls.DB(), topicId, "comment_count", count); err != nil {
		t.Fatalf("set topic comment_count: %v", err)
	}
}

func getTopicCommentCount(t *testing.T, topicId int64) int64 {
	t.Helper()
	topic := TopicService.Get(topicId)
	if topic == nil {
		t.Fatalf("topic not found")
	}
	return topic.CommentCount
}

func getUserCommentCount(t *testing.T, userId int64) int {
	t.Helper()
	user := UserService.Get(userId)
	if user == nil {
		t.Fatalf("user not found")
	}
	return user.CommentCount
}

func TestCommentTransition_OkToReview_DecrementsTopicAndUser(t *testing.T) {
	setupTopicCountTestDB(t)
	user := mustCreateUser(t, dates.NowTimestamp())
	topic := mustCreateTopicWithStatus(t, user.Id, constants.StatusOk)
	comment := mustCreateTopicCommentFixture(t, user.Id, topic.Id, constants.StatusOk)
	mustSetTopicCommentCount(t, topic.Id, 1)
	mustSetUserCount(t, user.Id, "comment_count", 1)

	applied, err := CommentService.TransitionFrom(comment.Id, constants.StatusOk, constants.StatusReview)
	if err != nil {
		t.Fatalf("transition: %v", err)
	}
	if !applied {
		t.Fatalf("expected applied=true")
	}
	if got := CommentService.Get(comment.Id).Status; got != constants.StatusReview {
		t.Fatalf("expected status review, got %d", got)
	}
	if got := getTopicCommentCount(t, topic.Id); got != 0 {
		t.Fatalf("expected topic comment_count 0, got %d", got)
	}
	if got := getUserCommentCount(t, user.Id); got != 0 {
		t.Fatalf("expected user comment_count 0, got %d", got)
	}
}

func TestCommentTransition_Idempotent_NoDoubleDecrement(t *testing.T) {
	setupTopicCountTestDB(t)
	user := mustCreateUser(t, dates.NowTimestamp())
	topic := mustCreateTopicWithStatus(t, user.Id, constants.StatusOk)
	comment := mustCreateTopicCommentFixture(t, user.Id, topic.Id, constants.StatusOk)
	mustSetTopicCommentCount(t, topic.Id, 1)
	mustSetUserCount(t, user.Id, "comment_count", 1)

	if _, err := CommentService.TransitionFrom(comment.Id, constants.StatusOk, constants.StatusReview); err != nil {
		t.Fatalf("first transition: %v", err)
	}
	// 并发重试/超时任务重复触发：期望已流转，幂等返回 false 且计数不变（不扣成 -1）。
	applied, err := CommentService.TransitionFrom(comment.Id, constants.StatusOk, constants.StatusReview)
	if err != nil {
		t.Fatalf("retry transition: %v", err)
	}
	if applied {
		t.Fatalf("expected applied=false on retry")
	}
	if got := getTopicCommentCount(t, topic.Id); got != 0 {
		t.Fatalf("expected topic comment_count still 0, got %d", got)
	}
	if got := getUserCommentCount(t, user.Id); got != 0 {
		t.Fatalf("expected user comment_count still 0, got %d", got)
	}
}

func TestCommentTransition_ReviewToOk_RestoresCounts(t *testing.T) {
	setupTopicCountTestDB(t)
	user := mustCreateUser(t, dates.NowTimestamp())
	topic := mustCreateTopicWithStatus(t, user.Id, constants.StatusOk)
	comment := mustCreateTopicCommentFixture(t, user.Id, topic.Id, constants.StatusReview)
	mustSetTopicCommentCount(t, topic.Id, 0)
	mustSetUserCount(t, user.Id, "comment_count", 0)

	applied, err := CommentService.Transition(comment.Id, constants.StatusOk)
	if err != nil {
		t.Fatalf("transition: %v", err)
	}
	if !applied {
		t.Fatalf("expected applied=true")
	}
	if got := getTopicCommentCount(t, topic.Id); got != 1 {
		t.Fatalf("expected topic comment_count 1, got %d", got)
	}
	if got := getUserCommentCount(t, user.Id); got != 1 {
		t.Fatalf("expected user comment_count 1, got %d", got)
	}
	// 二次审核幂等：已是 Ok 不再加。
	applied, err = CommentService.Transition(comment.Id, constants.StatusOk)
	if err != nil {
		t.Fatalf("re-audit: %v", err)
	}
	if applied {
		t.Fatalf("expected applied=false on re-audit")
	}
	if got := getTopicCommentCount(t, topic.Id); got != 1 {
		t.Fatalf("expected topic comment_count still 1, got %d", got)
	}
}

func TestCommentTransition_ReviewToDeleted_NoCountChange(t *testing.T) {
	setupTopicCountTestDB(t)
	user := mustCreateUser(t, dates.NowTimestamp())
	topic := mustCreateTopicWithStatus(t, user.Id, constants.StatusOk)
	comment := mustCreateTopicCommentFixture(t, user.Id, topic.Id, constants.StatusOk)
	mustSetTopicCommentCount(t, topic.Id, 1)
	mustSetUserCount(t, user.Id, "comment_count", 1)

	// Ok -> Review 先 -1（模拟 Jev 转审）。
	if _, err := CommentService.TransitionFrom(comment.Id, constants.StatusOk, constants.StatusReview); err != nil {
		t.Fatalf("to review: %v", err)
	}
	// Review -> Deleted（超时下架/人工驳回）：可见性无变化，计数不动。
	applied, err := CommentService.TransitionFrom(comment.Id, constants.StatusReview, constants.StatusDeleted)
	if err != nil {
		t.Fatalf("to deleted: %v", err)
	}
	if !applied {
		t.Fatalf("expected applied=true")
	}
	if got := getTopicCommentCount(t, topic.Id); got != 0 {
		t.Fatalf("expected topic comment_count still 0, got %d", got)
	}
	if got := getUserCommentCount(t, user.Id); got != 0 {
		t.Fatalf("expected user comment_count still 0, got %d", got)
	}
}

func TestCommentDelete_DecrementsTopicCount(t *testing.T) {
	setupTopicCountTestDB(t)
	user := mustCreateUser(t, dates.NowTimestamp())
	topic := mustCreateTopicWithStatus(t, user.Id, constants.StatusOk)
	comment := mustCreateTopicCommentFixture(t, user.Id, topic.Id, constants.StatusOk)
	mustSetTopicCommentCount(t, topic.Id, 1)
	mustSetUserCount(t, user.Id, "comment_count", 1)

	if err := CommentService.Delete(comment.Id); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if got := getTopicCommentCount(t, topic.Id); got != 0 {
		t.Fatalf("expected topic comment_count 0 after delete, got %d", got)
	}
	if got := getUserCommentCount(t, user.Id); got != 0 {
		t.Fatalf("expected user comment_count 0 after delete, got %d", got)
	}
	// 二次删除幂等。
	if err := CommentService.Delete(comment.Id); err != nil {
		t.Fatalf("re-delete: %v", err)
	}
	if got := getTopicCommentCount(t, topic.Id); got != 0 {
		t.Fatalf("expected topic comment_count still 0, got %d", got)
	}
}

func TestRecalcTopicCommentCount_FixesDrift(t *testing.T) {
	setupTopicCountTestDB(t)
	user := mustCreateUser(t, dates.NowTimestamp())
	topic := mustCreateTopicWithStatus(t, user.Id, constants.StatusOk)
	// 存量脏数据：2 条可见 + 1 待审 + 1 已删，但冗余字段虚高为 5（Jev 拦截漏扣的历史形态）。
	mustCreateTopicCommentFixture(t, user.Id, topic.Id, constants.StatusOk)
	mustCreateTopicCommentFixture(t, user.Id, topic.Id, constants.StatusOk)
	mustCreateTopicCommentFixture(t, user.Id, topic.Id, constants.StatusReview)
	mustCreateTopicCommentFixture(t, user.Id, topic.Id, constants.StatusDeleted)
	mustSetTopicCommentCount(t, topic.Id, 5)

	real, fixed, err := CommentService.RecalcTopicCommentCount(topic.Id)
	if err != nil {
		t.Fatalf("recalc: %v", err)
	}
	if real != 2 || !fixed {
		t.Fatalf("expected real=2 fixed=true, got real=%d fixed=%v", real, fixed)
	}
	if got := getTopicCommentCount(t, topic.Id); got != 2 {
		t.Fatalf("expected topic comment_count 2 after recalc, got %d", got)
	}
	// 干净行零写入：再次对账应返回 fixed=false。
	_, fixed, err = CommentService.RecalcTopicCommentCount(topic.Id)
	if err != nil {
		t.Fatalf("re-recalc: %v", err)
	}
	if fixed {
		t.Fatalf("expected fixed=false on clean row")
	}
}

func TestReconcileTopicCommentCounts_Batch(t *testing.T) {
	setupTopicCountTestDB(t)
	user := mustCreateUser(t, dates.NowTimestamp())
	clean := mustCreateTopicWithStatus(t, user.Id, constants.StatusOk)
	mustCreateTopicCommentFixture(t, user.Id, clean.Id, constants.StatusOk)
	mustSetTopicCommentCount(t, clean.Id, 1)

	dirty := mustCreateTopicWithStatus(t, user.Id, constants.StatusOk)
	mustCreateTopicCommentFixture(t, user.Id, dirty.Id, constants.StatusOk)
	mustSetTopicCommentCount(t, dirty.Id, 9)

	checked, fixed, err := CommentService.ReconcileTopicCommentCounts(100)
	if err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	if checked < 2 {
		t.Fatalf("expected checked>=2, got %d", checked)
	}
	if fixed != 1 {
		t.Fatalf("expected fixed=1, got %d", fixed)
	}
	if got := getTopicCommentCount(t, dirty.Id); got != 1 {
		t.Fatalf("expected dirty topic fixed to 1, got %d", got)
	}
	if got := getTopicCommentCount(t, clean.Id); got != 1 {
		t.Fatalf("expected clean topic untouched at 1, got %d", got)
	}
}
