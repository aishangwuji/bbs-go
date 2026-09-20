package roles

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"bbs-go/internal/models"
	"bbs-go/internal/pkg/common"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestResolveSpaceRole_OwnerWithoutPreview(t *testing.T) {
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest("GET", "/api/user/100", nil)

	// 模拟已登录号主本人 (ID=100)
	user := &models.User{}
	user.Id = 100
	common.SetCurrentUser(ctx, user)

	spaceCtx := ResolveSpaceRole(ctx, 100)
	if !spaceCtx.IsRealOwner {
		t.Fatalf("expected IsRealOwner=true, got false")
	}
	if !spaceCtx.CanPreview {
		t.Fatalf("expected CanPreview=true, got false")
	}
	if spaceCtx.Role != string(RoleOwner) {
		t.Fatalf("expected role=%s, got %s", RoleOwner, spaceCtx.Role)
	}
	if spaceCtx.Followed {
		t.Fatalf("expected followed=false in owner mode, got true")
	}
}

func TestResolveSpaceRole_OwnerWithPreviewFans(t *testing.T) {
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest("GET", "/api/user/100?preview_role=fans", nil)

	user := &models.User{}
	user.Id = 100
	common.SetCurrentUser(ctx, user)

	spaceCtx := ResolveSpaceRole(ctx, 100)
	if !spaceCtx.IsRealOwner {
		t.Fatalf("expected IsRealOwner=true, got false")
	}
	if spaceCtx.Role != string(RoleFans) {
		t.Fatalf("expected role=%s, got %s", RoleFans, spaceCtx.Role)
	}
	if !spaceCtx.Followed {
		t.Fatalf("expected followed=true in fans preview mode, got false")
	}
}

func TestResolveSpaceRole_OwnerWithPreviewVisitor(t *testing.T) {
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest("GET", "/api/user/100?preview_role=visitor", nil)

	user := &models.User{}
	user.Id = 100
	common.SetCurrentUser(ctx, user)

	spaceCtx := ResolveSpaceRole(ctx, 100)
	if !spaceCtx.IsRealOwner {
		t.Fatalf("expected IsRealOwner=true, got false")
	}
	if spaceCtx.Role != string(RoleVisitor) {
		t.Fatalf("expected role=%s, got %s", RoleVisitor, spaceCtx.Role)
	}
	if spaceCtx.Followed {
		t.Fatalf("expected followed=false in visitor preview mode, got true")
	}
}

func TestResolveSpaceRole_VisitorBypassIgnored(t *testing.T) {
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	// 未登录用户恶意附带 preview_role=owner 或 fans
	ctx.Request = httptest.NewRequest("GET", "/api/user/100?preview_role=fans", nil)

	spaceCtx := ResolveSpaceRole(ctx, 100)
	if spaceCtx.IsRealOwner {
		t.Fatalf("expected IsRealOwner=false for anonymous")
	}
	if spaceCtx.CanPreview {
		t.Fatalf("expected CanPreview=false for anonymous")
	}
	if spaceCtx.Role != string(RoleVisitor) {
		t.Fatalf("expected role=%s for anonymous, got %s", RoleVisitor, spaceCtx.Role)
	}
}
