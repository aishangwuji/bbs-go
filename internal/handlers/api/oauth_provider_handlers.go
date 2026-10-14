package api

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"bbs-go/internal/pkg/ginx"
	"bbs-go/internal/services"

	"github.com/gin-gonic/gin"
)

// OAuthAuthorizeReq 授权入口请求参数
type OAuthAuthorizeReq struct {
	ClientId     string `form:"client_id" json:"client_id"`
	RedirectUri  string `form:"redirect_uri" json:"redirect_uri"`
	ResponseType string `form:"response_type" json:"response_type"`
	State        string `form:"state" json:"state"`
	Scope        string `form:"scope" json:"scope"`
}

// OAuthTokenReq 换取 Token 请求参数
type OAuthTokenReq struct {
	GrantType    string `form:"grant_type" json:"grant_type"`
	ClientId     string `form:"client_id" json:"client_id"`
	ClientSecret string `form:"client_secret" json:"client_secret"`
	Code         string `form:"code" json:"code"`
	RedirectUri  string `form:"redirect_uri" json:"redirect_uri"`
}

// OAuthAuthorize GET /api/oauth/authorize
// 授权端点：校验客户端、检查登录态（未登录重定向至论坛登录页，已登录自动发码跳回）
func OAuthAuthorize(ctx *gin.Context) {
	var req OAuthAuthorizeReq
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("请求参数格式错误"))
		return
	}

	req.ClientId = strings.TrimSpace(req.ClientId)
	req.RedirectUri = strings.TrimSpace(req.RedirectUri)
	if req.ClientId == "" || req.RedirectUri == "" {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("client_id 与 redirect_uri 为必填项"))
		return
	}

	// 校验客户端与重定向白名单
	client, err := services.OAuthProviderService.GetClientByClientId(req.ClientId)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}
	if err := services.OAuthProviderService.ValidateRedirectUri(client, req.RedirectUri); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	// 检查当前用户在 bbs-go 的登录态
	currentUser := services.UserTokenService.GetCurrent(ctx)
	if currentUser == nil {
		// 未登录：引导用户前往登录页，并将当前授权全路径作为 redirect 参数回跳
		originalUrl := ctx.Request.URL.RequestURI()
		signInUrl := fmt.Sprintf("/user/signin?redirect=%s", url.QueryEscape(originalUrl))
		ctx.Redirect(http.StatusFound, signInUrl)
		return
	}

	// 已登录：生成一次性短效授权码
	code, err := services.OAuthProviderService.CreateAuthorizationCode(req.ClientId, currentUser.Id, req.RedirectUri, req.Scope)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	// 拼装回调地址
	separator := "?"
	if strings.Contains(req.RedirectUri, "?") {
		separator = "&"
	}
	callbackUrl := fmt.Sprintf("%s%scode=%s", req.RedirectUri, separator, url.QueryEscape(code))
	if req.State != "" {
		callbackUrl = fmt.Sprintf("%s&state=%s", callbackUrl, url.QueryEscape(req.State))
	}

	// 302 重定向携带 code 跳回 RP 依赖方
	ctx.Redirect(http.StatusFound, callbackUrl)
}

// OAuthToken POST /api/oauth/token
// 换取令牌：由 RP 服务端 Back-channel 发起，验证客户端机密与单次消费授权码
func OAuthToken(ctx *gin.Context) {
	var req OAuthTokenReq
	if err := ctx.ShouldBind(&req); err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("请求参数解析失败"))
		return
	}

	req.ClientId = strings.TrimSpace(req.ClientId)
	req.ClientSecret = strings.TrimSpace(req.ClientSecret)
	req.Code = strings.TrimSpace(req.Code)
	req.RedirectUri = strings.TrimSpace(req.RedirectUri)

	if req.ClientId == "" || req.ClientSecret == "" || req.Code == "" || req.RedirectUri == "" {
		ginx.WriteJSON(ctx, ginx.ErrorMessage("client_id, client_secret, code, redirect_uri 均为必填项"))
		return
	}

	resp, err := services.OAuthProviderService.ExchangeToken(req.ClientId, req.ClientSecret, req.Code, req.RedirectUri)
	if err != nil {
		ginx.WriteJSON(ctx, ginx.ErrorMessage(err.Error()))
		return
	}

	ctx.JSON(http.StatusOK, resp)
}

// OAuthUserInfo GET /api/oauth/userinfo
// 获取公开用户资料：携带 Bearer Token 获取用户基础画像
func OAuthUserInfo(ctx *gin.Context) {
	authHeader := ctx.GetHeader("Authorization")
	accessToken := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	if accessToken == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "message": "缺失 Bearer 访问令牌"})
		return
	}

	userInfo, err := services.OAuthProviderService.GetUserInfoByAccessToken(accessToken)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "message": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, userInfo)
}
