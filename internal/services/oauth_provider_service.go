package services

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"bbs-go/internal/cache"
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/repositories"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/common/passwd"
	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/sqls"
)

var OAuthProviderService = newOAuthProviderService()

func newOAuthProviderService() *oauthProviderService {
	return &oauthProviderService{}
}

type oauthProviderService struct {
}

// OAuthTokenResponse OAuth 2.0 Token 响应标准结构
type OAuthTokenResponse struct {
	AccessToken string `json:"access_token"` // 访问令牌
	TokenType   string `json:"token_type"`   // 令牌类型 (Bearer)
	ExpiresIn   int64  `json:"expires_in"`   // 有效秒数
	Scope       string `json:"scope"`        // 授权作用域
}

// OAuthUserInfoResponse OAuth 2.0 用户画像公开标准结构
type OAuthUserInfoResponse struct {
	Id            int64  `json:"id"`            // 用户数字 ID
	Username      string `json:"username"`      // 用户名
	Nickname      string `json:"nickname"`      // 昵称
	Avatar        string `json:"avatar"`        // 头像地址
	Email         string `json:"email"`         // 邮箱
	EmailVerified bool   `json:"emailVerified"` // 邮箱是否已验证
	Status        int    `json:"status"`        // 账号状态 (0: 正常)
}

// GetClientByClientId 根据 ClientId 获取客户端配置
func (s *oauthProviderService) GetClientByClientId(clientId string) (*models.OAuthClient, error) {
	if strs.IsBlank(clientId) {
		return nil, errors.New("clientId 不能为空")
	}
	client := repositories.OAuthClientRepository.GetByClientId(sqls.DB(), clientId)
	if client == nil {
		return nil, errors.New("OAuth 客户端不存在")
	}
	if client.Status != 0 {
		return nil, errors.New("OAuth 客户端已被禁用")
	}
	return client, nil
}

// ValidateRedirectUri 验证回调地址是否在客户端配置的白名单中（严格全等比对，防开放重定向钓鱼）
func (s *oauthProviderService) ValidateRedirectUri(client *models.OAuthClient, redirectUri string) error {
	if strs.IsBlank(redirectUri) {
		return errors.New("redirect_uri 不能为空")
	}
	allowedList := strings.Split(client.RedirectUris, ",")
	trimmedRedirectUri := strings.TrimSpace(redirectUri)
	for _, allowed := range allowedList {
		if strings.TrimSpace(allowed) == trimmedRedirectUri {
			return nil
		}
	}
	return errors.New("redirect_uri 不在客户端授权白名单中")
}

// ValidateClientCredentials 校验客户端的 ClientId 和 ClientSecret 机密
func (s *oauthProviderService) ValidateClientCredentials(clientId, clientSecret string) (*models.OAuthClient, error) {
	client, err := s.GetClientByClientId(clientId)
	if err != nil {
		return nil, err
	}
	if strs.IsBlank(clientSecret) {
		return nil, errors.New("client_secret 不能为空")
	}

	// 密码学安全比对：支持 bcrypt 哈希校验或明文兼容比对
	if !passwd.ValidatePassword(client.ClientSecret, clientSecret) && client.ClientSecret != clientSecret {
		return nil, errors.New("client_secret 错误")
	}
	return client, nil
}

// CreateAuthorizationCode 生成短效授权码并关联用户授权状态
func (s *oauthProviderService) CreateAuthorizationCode(clientId string, userId int64, redirectUri string, scope string) (string, error) {
	client, err := s.GetClientByClientId(clientId)
	if err != nil {
		return "", err
	}
	if err := s.ValidateRedirectUri(client, redirectUri); err != nil {
		return "", err
	}

	user := cache.UserCache.Get(userId)
	if user == nil || user.Status != constants.StatusOk {
		return "", errors.New("用户不存在或状态异常")
	}

	// 使用密码学安全随机数生成 32 字节高熵授权码（64 字符十六进制）
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", errors.New("生成授权码失败")
	}
	code := hex.EncodeToString(buf)

	// 存入短期缓存（2分钟有效）
	cache.OAuthCodeCache.Put(code, &cache.OAuthCodeData{
		ClientId:    clientId,
		UserId:      userId,
		RedirectUri: redirectUri,
		Scope:       scope,
		CreateTime:  dates.NowTimestamp(),
	})

	return code, nil
}

// ExchangeToken 使用授权码原子兑换 AccessToken
func (s *oauthProviderService) ExchangeToken(clientId, clientSecret, code, redirectUri string) (*OAuthTokenResponse, error) {
	// 1. 验证客户端凭据
	client, err := s.ValidateClientCredentials(clientId, clientSecret)
	if err != nil {
		return nil, err
	}

	// 2. 校验重定向白名单
	if err := s.ValidateRedirectUri(client, redirectUri); err != nil {
		return nil, err
	}

	// 3. 原子消费授权码（Take 自动删除，防重放）
	codeData := cache.OAuthCodeCache.Take(code)
	if codeData == nil {
		return nil, errors.New("授权码无效、已过期或已被消费")
	}

	// 4. 校验授权码与当前调用方一致性
	if codeData.ClientId != clientId {
		return nil, errors.New("授权码与当前客户端不匹配")
	}
	if codeData.RedirectUri != redirectUri {
		return nil, errors.New("回调地址与发起授权时不一致")
	}

	// 5. 校验用户有效性
	user := cache.UserCache.Get(codeData.UserId)
	if user == nil || user.Status != constants.StatusOk {
		return nil, errors.New("用户不存在或已被封禁")
	}

	// 6. 签发 AccessToken（32 字节高熵随机串）
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return nil, errors.New("生成访问令牌失败")
	}
	tokenStr := hex.EncodeToString(buf)

	// 有效期：默认 30 天
	const tokenExpireDays = 30
	now := dates.NowTimestamp()
	expiredAt := dates.Timestamp(time.Now().AddDate(0, 0, tokenExpireDays))

	tokenModel := &models.OAuthToken{
		ClientId:   clientId,
		UserId:     user.Id,
		Token:      tokenStr,
		Scope:      codeData.Scope,
		ExpiredAt:  expiredAt,
		Status:     0,
		LastUsedAt: now,
		CreateTime: now,
		UpdateTime: now,
	}

	if err := repositories.OAuthTokenRepository.Create(sqls.DB(), tokenModel); err != nil {
		return nil, err
	}

	return &OAuthTokenResponse{
		AccessToken: tokenStr,
		TokenType:   "Bearer",
		ExpiresIn:   int64(tokenExpireDays * 24 * 3600),
		Scope:       codeData.Scope,
	}, nil
}

// GetUserInfoByAccessToken 根据 AccessToken 获取用户公开资料
func (s *oauthProviderService) GetUserInfoByAccessToken(accessToken string) (*OAuthUserInfoResponse, error) {
	if strs.IsBlank(accessToken) {
		return nil, errors.New("accessToken 不能为空")
	}

	tokenModel := repositories.OAuthTokenRepository.GetByToken(sqls.DB(), accessToken)
	if tokenModel == nil || tokenModel.Status != 0 {
		return nil, errors.New("令牌无效或已吊销")
	}
	if tokenModel.ExpiredAt <= dates.NowTimestamp() {
		return nil, errors.New("令牌已过期")
	}

	user := cache.UserCache.Get(tokenModel.UserId)
	if user == nil || user.Status != constants.StatusOk {
		return nil, errors.New("用户不存在或状态异常")
	}

	// 异步刷新最后使用时间
	go func(id int64) {
		_ = repositories.OAuthTokenRepository.UpdateColumn(sqls.DB(), id, "last_used_at", dates.NowTimestamp())
	}(tokenModel.Id)

	emailStr := ""
	if user.Email.Valid {
		emailStr = user.Email.String
	}

	usernameStr := ""
	if user.Username.Valid {
		usernameStr = user.Username.String
	}

	return &OAuthUserInfoResponse{
		Id:            user.Id,
		Username:      usernameStr,
		Nickname:      user.Nickname,
		Avatar:        user.Avatar,
		Email:         emailStr,
		EmailVerified: user.EmailVerified,
		Status:        user.Status,
	}, nil
}
