package roles

import (
	"strings"

	"github.com/gin-gonic/gin"

	"bbs-go/internal/pkg/common"
	"bbs-go/internal/services"
)

// SpaceRole 表示个人空间访问时的视角角色枚举
type SpaceRole string

const (
	// RoleOwner 主人态：当前访问者是空间号主本人，拥有完整编辑与管理视野
	RoleOwner SpaceRole = "owner"
	// RoleFans 粉丝态：当前访问者已关注该号主，或号主正以粉丝视角进行模拟预览
	RoleFans SpaceRole = "fans"
	// RoleVisitor 访客态：普通未关注用户或未登录访客，或号主正以访客视角进行模拟预览
	RoleVisitor SpaceRole = "visitor"
)

// SpaceContext 封装空间访问的身份解析结果
type SpaceContext struct {
	// TargetUserID 当前所访问主页的号主用户 ID
	TargetUserID int64
	// ViewerUserID 当前发起请求的登录用户 ID（未登录为 0）
	ViewerUserID int64
	// Role 当前生效的呈现角色：owner / fans / visitor
	Role string
	// IsRealOwner 访问者是否为该空间客观真实的号主本尊
	IsRealOwner bool
	// CanPreview 是否允许发起视角模拟切换（仅 IsRealOwner 为 true 时有效）
	CanPreview bool
	// Followed 在当前视角下呈现的关注关系状态（供前端关注按钮状态消费）
	Followed bool
}

// ResolveSpaceRole 解析当前访问上下文在目标空间中的身份角色
//
// 核心鉴权与防越权机制（教学要点）：
// 1. 为什么必须先校验 viewer != nil && viewer.Id == targetUserID？
//    这是典型的“以客观凭证为唯一信任源”的防 IDOR（不安全直接对象引用）设计。
//    若允许任意请求通过 preview_role 篡改角色，攻击者可伪造号主身份或探测未公开信息。
// 2. preview_role 的白名单过滤：
//    仅允许在 fans 和 visitor 之间进行安全预览，防止注入无效非法状态。
// 3. 粉丝关系与号主自洽性：
//    号主自己不会（也不应该）在数据库中“关注自己”，但在模拟粉丝态时，系统通过 Followed=true
//    虚拟出已关注状态，从而让号主在 UI 上 100% 所见即所得地看到粉丝视角的关注按钮状态。
func ResolveSpaceRole(ctx *gin.Context, targetUserID int64) *SpaceContext {
	currentUser := common.GetCurrentUser(ctx)
	var viewerID int64 = 0
	if currentUser != nil {
		viewerID = currentUser.Id
	}

	result := &SpaceContext{
		TargetUserID: targetUserID,
		ViewerUserID: viewerID,
		Role:         string(RoleVisitor),
		IsRealOwner:  false,
		CanPreview:   false,
		Followed:     false,
	}

	// 1. 判定是否为客观号主本人
	if viewerID > 0 && viewerID == targetUserID {
		result.IsRealOwner = true
		result.CanPreview = true

		// 检查是否传入了合法的模拟预览参数（支持 URL Query 与 Header）
		previewRole := strings.ToLower(strings.TrimSpace(ctx.Query("preview_role")))
		if previewRole == "" {
			previewRole = strings.ToLower(strings.TrimSpace(ctx.GetHeader("X-Preview-Role")))
		}

		if previewRole == string(RoleFans) {
			result.Role = string(RoleFans)
			result.Followed = true // 粉丝视角下呈现已关注
			return result
		} else if previewRole == string(RoleVisitor) {
			result.Role = string(RoleVisitor)
			result.Followed = false // 访客视角下呈现未关注
			return result
		}

		// 未指定预览模式时，恢复真实主人态
		result.Role = string(RoleOwner)
		result.Followed = false
		return result
	}

	// 2. 外部访问者（包括未登录用户与已登录的其他用户）
	// 注意：外部访问者传入 preview_role 参数会被强制忽略，杜绝越权
	if viewerID > 0 {
		isFollowed := services.UserFollowService.IsFollowed(viewerID, targetUserID)
		if isFollowed {
			result.Role = string(RoleFans)
			result.Followed = true
		} else {
			result.Role = string(RoleVisitor)
			result.Followed = false
		}
	} else {
		// 未登录用户一律视为普通访客
		result.Role = string(RoleVisitor)
		result.Followed = false
	}

	return result
}
