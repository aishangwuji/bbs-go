package services

import (
	"bbs-go/internal/models/constants"
	"bbs-go/internal/models/req"
	"bbs-go/internal/models/resp"
	"bbs-go/internal/permissions"
	"bbs-go/internal/pkg/common"
	"bbs-go/internal/pkg/errs"
	"bbs-go/internal/pkg/event"
	"bbs-go/internal/pkg/iplocator"
	"bbs-go/internal/pkg/locales"
	"errors"
	"log/slog"
	"strings"

	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/common/jsons"
	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/sqls"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cast"
	"gorm.io/gorm"

	"bbs-go/internal/models"
	"bbs-go/internal/repositories"
)

var CommentService = newCommentService()

func newCommentService() *commentService {
	return &commentService{}
}

type commentService struct {
}

func (s *commentService) Get(id int64) *models.Comment {
	return repositories.CommentRepository.Get(sqls.DB(), id)
}

func (s *commentService) Take(where ...interface{}) *models.Comment {
	return repositories.CommentRepository.Take(sqls.DB(), where...)
}

func (s *commentService) Find(cnd *sqls.Cnd) []models.Comment {
	return repositories.CommentRepository.Find(sqls.DB(), cnd)
}

func (s *commentService) FindOne(cnd *sqls.Cnd) *models.Comment {
	return repositories.CommentRepository.FindOne(sqls.DB(), cnd)
}

func (s *commentService) FindPageByParams(params *params.QueryParams) (list []models.Comment, paging *sqls.Paging) {
	return repositories.CommentRepository.FindPageByParams(sqls.DB(), params)
}

func (s *commentService) FindPageByCnd(cnd *sqls.Cnd) (list []models.Comment, paging *sqls.Paging) {
	return repositories.CommentRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *commentService) Count(cnd *sqls.Cnd) int64 {
	return repositories.CommentRepository.Count(sqls.DB(), cnd)
}

func (s *commentService) Create(t *models.Comment) error {
	return repositories.CommentRepository.Create(sqls.DB(), t)
}

func (s *commentService) Update(t *models.Comment) error {
	return repositories.CommentRepository.Update(sqls.DB(), t)
}

func (s *commentService) Updates(id int64, columns map[string]interface{}) error {
	return repositories.CommentRepository.Updates(sqls.DB(), id, columns)
}

func (s *commentService) UpdateColumn(id int64, name string, value interface{}) error {
	return repositories.CommentRepository.UpdateColumn(sqls.DB(), id, name, value)
}

func (s *commentService) Delete(id int64) error {
	comment := s.Get(id)
	if comment == nil || comment.Status == constants.StatusDeleted {
		return nil
	}
	_, err := s.Transition(id, constants.StatusDeleted)
	return err
}

// Audit 审核通过评论（解冻恢复为正常状态 StatusOk）
// Business Rule: 仅 StatusOk 计入话题/用户/父评论计数，经 Transition 按可见性 delta 联动，避免重复加。
func (s *commentService) Audit(id int64) error {
	comment := s.Get(id)
	if comment == nil {
		return errors.New("comment not found")
	}
	if comment.Status == constants.StatusOk {
		return nil
	}
	_, err := s.Transition(id, constants.StatusOk)
	return err
}

// Transition 将评论流转到目标状态，计数与可见性同增同减，CAS 幂等。
// Business Rule: 仅 StatusOk 为可见并计入 t_topic/t_comment(父级)/t_user 的 comment_count；
// 可见性 delta = (to==Ok?1:0) - (from==Ok?1:0)，+1/-1/0 三种情况。
// Reason: Jev 异步拦截、人工审核、超时兜底、用户删除四条路径并发，必须单点收敛，否则重复扣/漏扣。
// 注意：EntityArticle 的文章侧 comment_count 历史上 Publish 就未维护（见 Publish 仅处理 topic/comment），
// 此处只联动用户计数，文章侧计数缺口另行立项修复，不在此处引入新的漂移。
func (s *commentService) Transition(id int64, to int) (bool, error) {
	comment := s.Get(id)
	if comment == nil {
		return false, errors.New("comment not found")
	}
	if comment.Status == to {
		return false, nil
	}
	return s.TransitionFrom(id, comment.Status, to)
}

// TransitionFrom 仅当评论当前处于 expectFrom 时才流转到 to，CAS 保证幂等。
// Jev 拦截/超时路径必须用它（期望 StatusOk），防止与人工删除/审核并发时重复扣减。
func (s *commentService) TransitionFrom(id int64, expectFrom, to int) (bool, error) {
	if expectFrom == to {
		return false, nil
	}
	comment := s.Get(id)
	if comment == nil {
		return false, errors.New("comment not found")
	}
	if comment.Status != expectFrom {
		return false, nil
	}
	from := comment.Status
	delta := 0
	if from == constants.StatusOk && to != constants.StatusOk {
		delta = -1
	} else if from != constants.StatusOk && to == constants.StatusOk {
		delta = 1
	}

	applied := false
	err := sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		res := ctx.Tx.Model(&models.Comment{}).Where("id = ? AND status = ?", id, from).Update("status", to)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil
		}
		applied = true
		if delta == 0 {
			return nil
		}
		// 话题/父评论计数联动（与 Publish 的 onComment 路径对称）
		if comment.EntityType == constants.EntityTopic {
			colVal := gorm.Expr("comment_count + 1")
			if delta < 0 {
				colVal = gorm.Expr("CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END")
			}
			if err := repositories.TopicRepository.UpdateColumn(ctx.Tx, comment.EntityId, "comment_count", colVal); err != nil {
				return err
			}
		} else if comment.EntityType == constants.EntityComment {
			colVal := gorm.Expr("comment_count + 1")
			if delta < 0 {
				colVal = gorm.Expr("CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END")
			}
			if err := repositories.CommentRepository.UpdateColumn(ctx.Tx, comment.EntityId, "comment_count", colVal); err != nil {
				return err
			}
		}
		// 用户跟帖计数联动（Publish 对所有 entityType 都 +1，此处对称处理）
		if delta > 0 {
			if err := UserService.IncrCommentCountTx(ctx, comment.UserId); err != nil {
				return err
			}
		} else {
			if err := UserService.DecrCommentCountTx(ctx, comment.UserId); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	return applied, nil
}

func (s *commentService) DeleteByUser(user *models.User, id int64) error {
	if user == nil {
		return errs.NotLogin()
	}
	comment := s.Get(id)
	if comment == nil || comment.Status == constants.StatusDeleted {
		return errors.New("comment not found")
	}
	if !PermissionService.CanManageOwnedResource(user, comment.UserId, permissions.PermissionCommentDelete.Code) {
		return errs.NoPermission()
	}
	return s.Delete(id)
}

// Publish 发表评论
func (s *commentService) Publish(userId int64, form req.CreateCommentReq) (*models.Comment, error) {
	form.Content = strings.TrimSpace(form.Content)
	entityId := form.DecodedEntityId()
	if strs.IsBlank(form.EntityType) {
		return nil, errors.New(locales.Get("comment.invalid_params"))
	}
	if entityId <= 0 {
		return nil, errors.New(locales.Get("comment.invalid_params"))
	}
	if strs.IsBlank(form.Content) {
		return nil, errors.New(locales.Get("comment.content_required"))
	}

	comment := &models.Comment{
		UserId:      userId,
		EntityType:  form.EntityType,
		EntityId:    entityId,
		Content:     form.Content,
		ContentType: constants.ContentTypeText,
		QuoteId:     form.QuoteId,
		Status:      constants.StatusOk,
		UserAgent:   form.UserAgent,
		Ip:          form.Ip,
		IpLocation:  iplocator.IpLocation(form.Ip),
		CreateTime:  dates.NowTimestamp(),
	}

	imageList := form.ParsedImageList()
	if len(imageList) > 0 {
		imageListStr, err := jsons.ToStr(imageList)
		if err == nil {
			comment.ImageList = imageListStr
		} else {
			slog.Error(err.Error(), slog.Any("err", err))
		}
	}

	err := sqls.DB().Transaction(func(tx *gorm.DB) error {
		if err := repositories.CommentRepository.Create(tx, comment); err != nil {
			return err
		}

		switch form.EntityType {
		case constants.EntityTopic:
			if err := TopicService.onComment(tx, entityId, comment); err != nil {
				return err
			}
		case constants.EntityComment: // 二级评论
			if err := s.onComment(tx, comment); err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	// 用户跟帖计数
	UserService.IncrCommentCount(userId)
	// 发送事件
	event.Send(event.CommentCreateEvent{
		UserId:    userId,
		CommentId: comment.Id,
	})

	return comment, nil
}

// onComment 评论被回复（二级评论）
func (s *commentService) onComment(tx *gorm.DB, comment *models.Comment) error {
	return repositories.CommentRepository.UpdateColumn(tx, comment.EntityId, "comment_count", gorm.Expr("comment_count + 1"))
}

// // 统计数量
// func (s *commentService) Count(entityType string, entityId int64) int64 {
// 	var count int64 = 0
// 	sqls.DB().Model(&model.Comment{}).Where("entity_type = ? and entity_id = ?", entityType, entityId).Count(&count)
// 	return count
// }

// GetCommentsByPage 正序按固定步长分页查询一级评论，支持 NodeSeek 风格全局绝对楼层
func (s *commentService) GetCommentsByPage(entityType string, entityId int64, page, pageSize int) ([]models.Comment, resp.Pagination) {
	if pageSize <= 0 {
		pageSize = common.DefaultPageSize
	}
	if page <= 0 {
		page = 1
	}

	countCnd := sqls.NewCnd().
		Eq("entity_type", entityType).
		Eq("entity_id", entityId).
		Eq("status", constants.StatusOk)
	totalCount := repositories.CommentRepository.Count(sqls.DB(), countCnd)

	pagination := common.BuildPagination(page, pageSize, totalCount)
	if totalCount == 0 {
		return nil, pagination
	}

	queryCnd := sqls.NewCnd().
		Eq("entity_type", entityType).
		Eq("entity_id", entityId).
		Eq("status", constants.StatusOk).
		Asc("id").
		Page(pagination.CurrentPage, pageSize)

	comments := repositories.CommentRepository.Find(sqls.DB(), queryCnd)
	return comments, pagination
}

// GetComments 列表（基于游标的倒序加载模式，向下兼容）
func (s *commentService) GetComments(entityType string, entityId int64, cursor int64) (comments []models.Comment, nextCursor int64, hasMore bool) {
	limit := 20
	var acceptedComment *models.Comment
	var acceptedCommentId int64

	if entityType == constants.EntityTopic {
		if topic := TopicService.Get(entityId); topic != nil && topic.AcceptedCommentId > 0 {
			acceptedCommentId = topic.AcceptedCommentId
			if acceptedComment = repositories.CommentRepository.FindOne(sqls.DB(), sqls.NewCnd().
				Eq("id", acceptedCommentId).
				Eq("entity_type", entityType).
				Eq("entity_id", entityId).
				Eq("status", constants.StatusOk)); acceptedComment == nil {
				acceptedCommentId = 0
			}
		}
	}

	// First page reserves one slot for accepted answer if present, so it can stay pinned on top.
	normalLimit := limit
	if cursor <= 0 && acceptedComment != nil {
		normalLimit = limit - 1
	}

	cnd := sqls.NewCnd().
		Eq("entity_type", entityType).
		Eq("entity_id", entityId).
		Eq("status", constants.StatusOk).
		Desc("id").
		Limit(normalLimit)
	if cursor > 0 {
		cnd.Lt("id", cursor)
	}
	if acceptedCommentId > 0 {
		cnd.Where("id <> ?", acceptedCommentId)
	}

	normalComments := repositories.CommentRepository.Find(sqls.DB(), cnd)

	if cursor <= 0 && acceptedComment != nil {
		comments = append(comments, *acceptedComment)
	}
	comments = append(comments, normalComments...)

	if len(normalComments) > 0 {
		nextCursor = normalComments[len(normalComments)-1].Id
		hasMore = len(normalComments) >= normalLimit
	} else {
		nextCursor = cursor
		hasMore = false
	}
	return
}

// GetReplies 二级回复列表
func (s *commentService) GetReplies(commentId int64, cursor int64, limit int) (comments []models.Comment, nextCursor int64, hasMore bool) {
	cnd := sqls.NewCnd().Eq("entity_type", constants.EntityComment).Eq("entity_id", commentId).Eq("status", constants.StatusOk).Asc("id").Limit(limit)
	if cursor > 0 {
		cnd.Gt("id", cursor)
	}
	comments = s.Find(cnd)
	if len(comments) > 0 {
		nextCursor = comments[len(comments)-1].Id
		hasMore = len(comments) >= limit
	} else {
		nextCursor = cursor
	}
	return
}

// ScanByUser 按照用户扫描数据
func (s *commentService) ScanByUser(userId int64, callback func(comments []models.Comment)) {
	var cursor int64 = 0
	for {
		list := repositories.CommentRepository.Find(sqls.DB(), sqls.NewCnd().
			Eq("user_id", userId).Gt("id", cursor).Asc("id").Limit(1000))
		if len(list) == 0 {
			break
		}
		cursor = list[len(list)-1].Id
		callback(list)
	}
}

// ScanByUser 按照用户扫描数据
func (s *commentService) Scan(callback func(comments []models.Comment)) {
	var cursor int64 = 0
	for {
		logrus.Info("scan comments, cursor:" + cast.ToString(cursor))
		list := repositories.CommentRepository.Find(sqls.DB(), sqls.NewCnd().
			Gt("id", cursor).Asc("id").Limit(1000))
		if len(list) == 0 {
			break
		}
		cursor = list[len(list)-1].Id
		callback(list)
	}
}

func (s *commentService) IsCommented(userId int64, entityType string, entityId int64) bool {
	return s.FindOne(sqls.NewCnd().Where("user_id = ? and entity_id = ? and entity_type = ? and status = ?", userId, entityId, entityType, constants.StatusOk)) != nil
}

// GetFloor 计算某条评论在所属实体下的绝对楼层号（1-based，按 id 升序）
func (s *commentService) GetFloor(comment *models.Comment) int {
	if comment == nil || comment.EntityType != constants.EntityTopic {
		return 0
	}
	var count int64
	sqls.DB().Model(&models.Comment{}).
		Where("entity_type = ? and entity_id = ? and status = ? and id <= ?", comment.EntityType, comment.EntityId, constants.StatusOk, comment.Id).
		Count(&count)
	return int(count)
}
