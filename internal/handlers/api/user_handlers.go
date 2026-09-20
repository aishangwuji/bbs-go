package api

import (
	"encoding/json"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/models/req"
	"bbs-go/internal/models/resp"
	"bbs-go/internal/pkg/common"
	"bbs-go/internal/pkg/config"
	"bbs-go/internal/pkg/errs"
	"bbs-go/internal/pkg/idcodec"
	"bbs-go/internal/pkg/locales"
	"bbs-go/internal/pkg/markdown"
	"bbs-go/internal/pkg/msg"
	"bbs-go/internal/pkg/validate"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/sqls"
	"github.com/spf13/cast"

	"bbs-go/internal/cache"
	"bbs-go/internal/handlers/render"
	"bbs-go/internal/models"
	"bbs-go/internal/pkg/roles"
	"bbs-go/internal/services"
)

func UserCurrent(ctx *gin.Context) {
	if !config.Instance.Installed {
		ginx.WriteJSON(ctx, nil)
		return
	}
	user := common.GetCurrentUser(ctx)
	if user != nil {
		ginx.WriteJSON(ctx, render.BuildUserProfile(user))
		return
	}
	ginx.WriteJSON(ctx, nil)
}

func UserDetail(ctx *gin.Context) {
	userIdStr := ctx.Param("id")

	userId := idcodec.Decode(userIdStr)
	user := cache.UserCache.Get(userId)
	if user != nil && user.Status != constants.StatusDeleted {
		detail := render.BuildUserDetail(user)
		spaceCtx := roles.ResolveSpaceRole(ctx, user.Id)
		detail.ViewRole = spaceCtx.Role
		detail.CanPreview = spaceCtx.CanPreview
		detail.Followed = spaceCtx.Followed
		ginx.WriteJSON(ctx, detail)
		return
	}
	ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Get("user.not_found")))

}

// UserCard 用户悬浮卡片数据（前端按需加载，非列表页内联返回）
// 数据链路：idcodec 解码 -> UserCache（内存缓存）-> BuildUserInfo（复用脱敏/等级逻辑）
//          -> UserBadgeCache（按用户缓存）+ BadgeCache（全量勋章内存缓存）关联已获得勋章
//          -> UserFollowService.IsFollowed 注入当前登录用户关注态
// 性能：全程命中内存缓存，无新增回源 SQL，避免每次悬浮都打数据库。
func UserCard(ctx *gin.Context) {
	userId := idcodec.Decode(ctx.Param("id"))
	if userId <= 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Get("user.not_found")))
		return
	}
	user := cache.UserCache.Get(userId)
	if user == nil || user.Status == constants.StatusDeleted {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Get("user.not_found")))
		return
	}

	card := &resp.UserCardResponse{
		UserInfo: *render.BuildUserInfo(user),
		Badges:   buildUserCardBadges(userId),
	}
	card.BadgeCount = len(card.Badges)

	// 关注态只对已登录用户有意义；匿名访问保持 false，避免前端误显示「已关注」
	if current := common.GetCurrentUser(ctx); current != nil && current.Id != userId {
		card.Followed = services.UserFollowService.IsFollowed(current.Id, userId)
	}

	ginx.WriteJSON(ctx, card)
}

// buildUserCardBadges 组装用户已获得的勋章：佩戴优先，其次按勋章配置的 sortNo 升序。
// 复杂度：以 badgeId 建 map 后单次遍历勋章库，O(n) 而非双层嵌套 O(n*m)；
// 只用内存缓存（BadgeCache / UserBadgeCache），不触发数据库查询。
func buildUserCardBadges(userId int64) []resp.BadgeResponse {
	userBadges := cache.UserBadgeCache.GetByUser(userId)
	if len(userBadges) == 0 {
		return []resp.BadgeResponse{}
	}

	owned := make(map[int64]models.UserBadge, len(userBadges))
	for _, ub := range userBadges {
		owned[ub.BadgeId] = ub
	}

	badges := cache.BadgeCache.GetAll()
	ret := make([]resp.BadgeResponse, 0, len(userBadges))
	for i := range badges {
		b := badges[i]
		ub, ok := owned[b.Id]
		if !ok {
			continue
		}
		ret = append(ret, resp.BadgeResponse{
			Id:          b.Id,
			Name:        b.Name,
			Title:       b.Title,
			Description: b.Description,
			Icon:        b.Icon,
			SortNo:      b.SortNo,
			Status:      b.Status,
			Owned:       true,
			Worn:        ub.IsWorn,
			ObtainTime:  ub.CreateTime,
		})
	}

	// 佩戴优先：用户选择佩戴的勋章是主动成就展示，应排在卡片最前。
	// SliceStable 保证同组内维持勋章库原有的 sortNo 顺序（稳定排序）。
	sort.SliceStable(ret, func(i, j int) bool {
		if ret[i].Worn != ret[j].Worn {
			return ret[i].Worn
		}
		return ret[i].SortNo < ret[j].SortNo
	})
	return ret
}

func UserUpdate(ctx *gin.Context) {
	userIdStr := ctx.Param("id")

	userId := idcodec.Decode(userIdStr)
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	if user.Id != userId {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Get("user.no_permission")))
		return
	}
	var req req.UserUpdateReq
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	nickname := strings.TrimSpace(req.Nickname)
	homePage := req.HomePage
	description := req.Description
	gender := strings.TrimSpace(req.Gender)
	signature := strings.TrimSpace(req.Signature)

	var (
		minLength = constants.NicknameMinLengthEnUS
		maxLength = constants.NicknameMaxLengthEnUS
	)
	if strings.EqualFold(string(config.Instance.Language), string(config.LanguageZhCN)) {
		minLength = constants.NicknameMinLengthZhCN
		maxLength = constants.NicknameMaxLengthZhCN
	}
	if nicknameLength := utf8.RuneCountInString(nickname); nicknameLength < minLength || nicknameLength > maxLength {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Getf("user.nickname_length_invalid", minLength, maxLength)))
		return
	}

	if strs.IsNotBlank(gender) {
		if gender != string(constants.GenderMale) && gender != string(constants.GenderFemale) {
			ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Get("user.gender_error")))
			return
		}
	}

	if len(homePage) > 0 && validate.IsURL(homePage) != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Get("user.homepage_error")))
		return
	}

	// 个性签名：长度与等级门槛校验（存储 Markdown 原文，展示时 lute+bluemonday 渲染）
	// 设计：签名变更低频，长度 200 字符防刷屏；等级门槛由 t_sys_config signatureMinLevel 控制（默认 3）
	if signature != strings.TrimSpace(user.Signature) {
		if utf8.RuneCountInString(signature) > 200 {
			ginx.WriteJSON(ctx, ginx.ErrorMessage("个性签名不能超过 200 字符"))
			return
		}
		if strs.IsNotBlank(signature) {
			minLevel := services.SysConfigService.GetSignatureMinLevel()
			if user.Level < minLevel {
				ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Getf("user.signature_level_required", minLevel)))
				return
			}
		}
	}

	err := services.UserService.Updates(user.Id, map[string]any{
		"nickname":    nickname,
		"home_page":   homePage,
		"description": description,
		"gender":      gender,
		"signature":   signature,
	})
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

func UserUpdateAvatar(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	avatar := strings.TrimSpace(params.FormValue(ctx, "avatar"))
	smallAvatar := strings.TrimSpace(params.FormValue(ctx, "smallAvatar"))
	if len(avatar) == 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Get("user.avatar_empty")))
		return
	}
	err := services.UserService.UpdateAvatar(user.Id, avatar, smallAvatar)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

func UserSetUsername(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	username := strings.TrimSpace(params.FormValue(ctx, "username"))
	err := services.UserService.SetUsername(user.Id, username)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)
}

func UserSetEmail(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	email := strings.TrimSpace(params.FormValue(ctx, "email"))
	err := services.UserService.SetEmail(user.Id, email)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

func UserSetPassword(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	password := params.FormValue(ctx, "password")
	rePassword := params.FormValue(ctx, "rePassword")
	err := services.UserService.SetPassword(user.Id, password, rePassword)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

// UserSignaturePreview 个性签名 Markdown 实时预览
// 为什么放在后端：预览必须与楼层展示走同一套 lute+bluemonday 消毒策略，
// 否则前端自行解析 Markdown 会绕过安全边界（P0）。返回的是已消毒 HTML。
func UserSignaturePreview(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	signature := strings.TrimSpace(params.FormValue(ctx, "signature"))
	if utf8.RuneCountInString(signature) > 200 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("个性签名不能超过 200 字符"))
		return
	}
	ginx.WriteJSON(ctx, map[string]any{
		"html": markdown.ToSignatureHTML(signature),
	})
}

func UserUpdatePassword(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	var req req.PasswordUpdateReq
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	if err := services.UserService.UpdatePassword(user.Id, req.OldPassword, req.Password, req.RePassword); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

func UserSetBackgroundImage(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	backgroundImage := params.FormValue(ctx, "backgroundImage")
	if strs.IsBlank(backgroundImage) {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Get("user.upload_image_required")))
		return
	}
	if err := services.UserService.UpdateBackgroundImage(user.Id, backgroundImage); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

func UserFavorites(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	cursor := params.FormValueInt64Default(ctx, "cursor", 0)

	// 用户必须登录
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}

	// 查询列表
	limit := 20
	var favorites []models.Favorite
	if cursor > 0 {
		favorites = services.FavoriteService.Find(sqls.NewCnd().Where("user_id = ? and id < ?",
			user.Id, cursor).Desc("id").Limit(20))
	} else {
		favorites = services.FavoriteService.Find(sqls.NewCnd().Where("user_id = ?", user.Id).Desc("id").Limit(limit))
	}

	hasMore := false
	if len(favorites) > 0 {
		cursor = favorites[len(favorites)-1].Id
		hasMore = len(favorites) >= limit
	}

	ginx.WriteJSON(ctx, ginx.CursorData(render.BuildFavorites(favorites), strconv.FormatInt(cursor, 10), hasMore))

}

func UserMsgRecent(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	var count int64 = 0
	var messages []models.Message
	if user != nil {
		count = services.MessageService.GetUnReadCount(user.Id)
		messages = services.MessageService.Find(sqls.NewCnd().Eq("user_id", user.Id).
			Eq("status", msg.StatusUnread).Limit(3).Desc("id"))
	}
	ginx.WriteJSON(ctx, map[string]any{"count": count, "messages": render.BuildMessages(messages)})

}

func UserMessages(ctx *gin.Context) {
	user, err := common.CheckLogin(ctx)
	if err != nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	var (
		limit     = 20
		cursor, _ = params.GetInt64(ctx, "cursor")
	)

	cnd := sqls.NewCnd().Eq("user_id", user.Id).Limit(limit).Desc("id")
	if cursor > 0 {
		cnd.Lt("id", cursor)
	}
	list := services.MessageService.Find(cnd)

	var (
		nextCursor = cursor
		hasMore    = false
	)
	if len(list) > 0 {
		nextCursor = list[len(list)-1].Id
		hasMore = len(list) == limit
	}

	// 全部标记为已读
	services.MessageService.MarkRead(user.Id)

	ginx.WriteJSON(ctx, ginx.CursorData(render.BuildMessages(list), cast.ToString(nextCursor), hasMore))

}

func UserScoreLogs(ctx *gin.Context) {
	user, err := common.CheckLogin(ctx)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	var (
		limit     = 20
		cursor, _ = params.GetInt64(ctx, "cursor")
	)
	cnd := sqls.NewCnd().Eq("user_id", user.Id).Limit(limit).Desc("id")
	if cursor > 0 {
		cnd.Lt("id", cursor)
	}
	list := services.UserScoreLogService.Find(cnd)

	var (
		nextCursor = cursor
		hasMore    = false
	)
	if len(list) > 0 {
		nextCursor = list[len(list)-1].Id
		hasMore = len(list) == limit
	}

	ginx.WriteJSON(ctx, ginx.CursorData(list, cast.ToString(nextCursor), hasMore))

}

func UserScoreRank(ctx *gin.Context) {

	users := cache.UserCache.GetScoreRank()
	var results []*resp.UserInfo
	for _, user := range users {
		results = append(results, render.BuildUserInfo(&user))
	}
	ginx.WriteJSON(ctx, results)

}

func UserForbidden(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	var req req.UserForbiddenReq
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	userId := idcodec.Decode(req.UserId)
	if !services.PermissionService.CanForbiddenUser(user, req.Days) {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(locales.Get("user.no_permission")))
		return
	}
	if userId < 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("param: userId required"))
		return
	}
	if req.Days == 0 {
		services.UserService.RemoveForbidden(user.Id, userId, ctx.Request)
	} else {
		if err := services.UserService.Forbidden(user.Id, userId, req.Days, req.Reason, ctx.Request); err != nil {
			ginx.WriteJSON(ctx, err)
			return
		}
	}
	ginx.WriteJSON(ctx, nil)

}

func UserSendVerifyEmail(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	if err := services.UserService.SendEmailVerifyEmail(user.Id); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)

}

func UserVerifyEmail(ctx *gin.Context) {
	token := params.FormValue(ctx, "token")
	if strs.IsBlank(token) {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Illegal request"))
		return
	}
	var (
		email string
		err   error
	)
	if email, err = services.UserService.VerifyEmail(token); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, map[string]any{"email": email})

}

func UserWxBindInfo(ctx *gin.Context) {
	user, err := common.CheckLogin(ctx)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	thirdUser := services.ThirdUserService.GetByUserId(user.Id, constants.ThirdTypeWeixin)
	if thirdUser != nil {
		ginx.WriteJSON(ctx, map[string]any{
			"bind":     true,
			"nickname": thirdUser.Nickname,
			"avatar":   thirdUser.Avatar,
		})
		return
	}
	ginx.WriteJSON(ctx, map[string]any{
		"bind": false,
	})

}

func UserGoogleBindInfo(ctx *gin.Context) {
	user, err := common.CheckLogin(ctx)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	thirdUser := services.ThirdUserService.GetByUserId(user.Id, constants.ThirdTypeGoogle)
	if thirdUser != nil {
		ginx.WriteJSON(ctx, map[string]any{
			"bind":     true,
			"nickname": thirdUser.Nickname,
			"avatar":   thirdUser.Avatar,
		})
		return
	}
	ginx.WriteJSON(ctx, map[string]any{
		"bind": false,
	})

}

func UserGithubBindInfo(ctx *gin.Context) {
	user, err := common.CheckLogin(ctx)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	thirdUser := services.ThirdUserService.GetByUserId(user.Id, constants.ThirdTypeGithub)
	if thirdUser != nil {
		profile := services.UserGithubProfileService.GetByUserId(user.Id)
		ginx.WriteJSON(ctx, map[string]any{
			"bind":          true,
			"nickname":      thirdUser.Nickname,
			"avatar":        thirdUser.Avatar,
			"githubProfile": profile,
		})
		return
	}
	ginx.WriteJSON(ctx, map[string]any{
		"bind": false,
	})
}

func UserGithubProfile(ctx *gin.Context) {
	userIdParam := ctx.Query("userId")
	userId := idcodec.Decode(userIdParam)
	if userId <= 0 {
		userId = cast.ToInt64(userIdParam)
	}
	if userId <= 0 {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Invalid userId"))
		return
	}
	profile := services.UserGithubProfileService.GetByUserId(userId)
	ginx.WriteJSON(ctx, profile)
}

func UserSyncGithubProfile(ctx *gin.Context) {
	user, err := common.CheckLogin(ctx)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	thirdUser := services.ThirdUserService.GetByUserId(user.Id, constants.ThirdTypeGithub)
	if thirdUser == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("您尚未绑定 GitHub 账号，请先绑定后再同步"))
		return
	}

	loginHandle := thirdUser.Nickname
	if strings.TrimSpace(thirdUser.ExtraData) != "" {
		var extra map[string]interface{}
		if err := json.Unmarshal([]byte(thirdUser.ExtraData), &extra); err == nil {
			if l, ok := extra["login"].(string); ok && l != "" {
				loginHandle = l
			}
		}
	}

	profile, err := services.UserGithubProfileService.SyncProfile(user.Id, "", loginHandle)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	ginx.WriteJSON(ctx, profile)
}

