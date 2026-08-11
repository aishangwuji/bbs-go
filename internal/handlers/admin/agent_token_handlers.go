package admin

import (
	"strconv"

	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/permissions"
	"bbs-go/internal/pkg/common"
	"bbs-go/internal/pkg/errs"
	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/pkg/params"
	"bbs-go/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/web"
)

// ---- 请求结构 ----

type AgentTokenCreateReq struct {
	Name      string `json:"name" binding:"required"`
	Remark    string `json:"remark"`
	ExpiredAt int64  `json:"expiredAt"` // 0 表示永不过期
}

type AgentTokenUpdateReq struct {
	Id        int64  `json:"id" binding:"required"`
	Name      string `json:"name" binding:"required"`
	Remark    string `json:"remark"`
	Status    int    `json:"status"`
	ExpiredAt int64  `json:"expiredAt"`
}

type AgentTokenGrantReq struct {
	Id   int64            `json:"id" binding:"required"`
	Apis []AgentGrantedApi `json:"apis"` // 整体覆盖令牌白名单
}

type AgentGrantedApi struct {
	Method string `json:"method"`
	Path   string `json:"path"`
}

// ---- 输出结构 ----

type agentTokenVO struct {
	*models.AgentToken
	CreatorNickname string `json:"creatorNickname"`
	ApiCount        int    `json:"apiCount"`
}

type agentCapabilityVO struct {
	Method          string   `json:"method"`
	Path            string   `json:"path"`
	NameZh          string   `json:"nameZh"`
	NameEn          string   `json:"nameEn"`
	PermissionCodes []string `json:"permissionCodes"`
	Granted         bool     `json:"granted"`
}

// ---- 接口实现 ----

func AgentTokenDetail(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	t := services.AgentTokenService.Get(id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Not found, id="+strconv.FormatInt(id, 10)))
		return
	}
	ginx.WriteJSON(ctx, buildAgentTokenVO(t))
}

func AgentTokenList(ctx *gin.Context) {
	list, paging := services.AgentTokenService.FindPageByParams(params.NewQueryParams(ctx).PageByReq().Desc("id"))
	results := make([]agentTokenVO, 0, len(list))
	for _, t := range list {
		results = append(results, buildAgentTokenVO(&t))
	}
	ginx.WriteJSON(ctx, &web.PageResult{Results: results, Page: paging})
}

func AgentTokenCreate(ctx *gin.Context) {
	var req AgentTokenCreateReq
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	if req.ExpiredAt > 0 && req.ExpiredAt < dates.NowTimestamp() {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("expiredAt is in the past"))
		return
	}
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}

	plainToken, err := services.AgentTokenService.GenerateToken()
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	now := dates.NowTimestamp()
	t := &models.AgentToken{
		TokenHash:     services.AgentTokenService.HashToken(plainToken),
		Name:          req.Name,
		Remark:        req.Remark,
		CreatorUserId: user.Id,
		Status:        constants.StatusOk,
		ExpiredAt:     req.ExpiredAt,
		CreateTime:    now,
		UpdateTime:    now,
	}
	if err := services.AgentTokenService.Create(t); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	// 明文令牌仅在创建时返回一次
	ginx.WriteJSON(ctx, gin.H{"id": t.Id, "token": plainToken})
}

func AgentTokenUpdate(ctx *gin.Context) {
	var req AgentTokenUpdateReq
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	t := services.AgentTokenService.Get(req.Id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Not found"))
		return
	}
	if req.ExpiredAt > 0 && req.ExpiredAt < dates.NowTimestamp() {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("expiredAt is in the past"))
		return
	}
	t.Name = req.Name
	t.Remark = req.Remark
	t.Status = req.Status
	t.ExpiredAt = req.ExpiredAt
	t.UpdateTime = dates.NowTimestamp()
	if err := services.AgentTokenService.Update(t); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)
}

func AgentTokenRemove(ctx *gin.Context) {
	id, err := params.FormValueInt64(ctx, "id")
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	services.AgentTokenService.Delete(id)
	ginx.WriteJSON(ctx, nil)
}

// AgentTokenApis 返回某令牌已获授权的能力（白名单）。
func AgentTokenApis(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, services.AgentTokenService.GetGrantedApis(id))
}

// AgentTokenCapabilities 返回当前管理员可见（其权限范围内）的全部 Agent 能力，
// 若带 tokenId 则额外标注该令牌是否已授权。
func AgentTokenCapabilities(ctx *gin.Context) {
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	tokenId, _ := params.GetInt64(ctx, "tokenId")

	var grantedMap map[string]bool
	if tokenId > 0 {
		grantedMap = map[string]bool{}
		for _, api := range services.AgentTokenService.GetGrantedApis(tokenId) {
			grantedMap[api.Method+" "+api.Path] = true
		}
	}

	results := make([]agentCapabilityVO, 0)
	for _, cap := range permissions.GetAgentCapabilities() {
		if !user.IsOwner() &&
			!services.PermissionService.HasAnyPermission(user, cap.PermissionCodes...) {
			continue // 只能看到/授权自己权限范围内的能力
		}
		vo := agentCapabilityVO{
			Method:          cap.Method,
			Path:            cap.Path,
			NameZh:          cap.NameZh,
			NameEn:          cap.NameEn,
			PermissionCodes: cap.PermissionCodes,
		}
		if grantedMap != nil {
			vo.Granted = grantedMap[cap.Method+" "+cap.Path]
		}
		results = append(results, vo)
	}
	ginx.WriteJSON(ctx, results)
}

// AgentTokenGrant 整体覆盖令牌白名单。每个能力都必须：
//  1. 存在于能力注册表（防伪造）
//  2. 在当前管理员自己的权限范围内（防越权放权）
func AgentTokenGrant(ctx *gin.Context) {
	var req AgentTokenGrantReq
	if err := ginx.Bind(ctx, &req); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	user := common.GetCurrentUser(ctx)
	if user == nil {
		ginx.WriteJSON(ctx, errs.NotLogin())
		return
	}
	t := services.AgentTokenService.Get(req.Id)
	if t == nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("Not found"))
		return
	}

	apis := make([]models.AgentTokenApi, 0, len(req.Apis))
	for _, item := range req.Apis {
		if item.Method == "" || item.Path == "" {
			continue
		}
		cap := permissions.GetAgentCapability(item.Method, item.Path)
		if cap == nil {
			ginx.WriteJSON(ctx, ginx.ErrorMessage("unknown capability: "+item.Method+" "+item.Path))
			return
		}
		if !user.IsOwner() && !services.PermissionService.HasAnyPermission(user, cap.PermissionCodes...) {
			ginx.WriteJSON(ctx, errs.NoPermission())
			return
		}
		apis = append(apis, models.AgentTokenApi{TokenId: req.Id, Method: item.Method, Path: item.Path})
	}
	if err := services.AgentTokenService.GrantApis(req.Id, apis); err != nil {
		ginx.WriteJSON(ctx, err)
		return
	}
	ginx.WriteJSON(ctx, nil)
}

func buildAgentTokenVO(t *models.AgentToken) agentTokenVO {
	vo := agentTokenVO{AgentToken: t}
	if creator := services.UserService.Get(t.CreatorUserId); creator != nil {
		vo.CreatorNickname = creator.Nickname
	}
	vo.ApiCount = len(services.AgentTokenService.GetGrantedApis(t.Id))
	return vo
}
