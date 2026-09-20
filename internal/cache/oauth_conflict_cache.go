package cache

import (
	"bbs-go/internal/models"
	"time"

	"github.com/goburrow/cache"
)

// OAuthConflictData 账号绑定冲突上下文数据
type OAuthConflictData struct {
	ConflictToken string            `json:"conflictToken"`
	TargetUserId  int64             `json:"targetUserId"`  // 当前登录并发起绑定的用户ID
	ConflictUser  *models.User      `json:"conflictUser"`  // 占用该第三方账号的旧用户
	ThirdType     string            `json:"thirdType"`     // "github" 或 "google"
	OpenId        string            `json:"openId"`        // 第三方唯一账号ID
	ThirdUser     *models.ThirdUser `json:"thirdUser"`     // third_user 表中对应的记录
	Nickname      string            `json:"nickname"`      // 第三方账号昵称
	Avatar        string            `json:"avatar"`        // 第三方账号头像
	ExtraData     string            `json:"extraData"`     // 第三方扩展数据
	TopicCount    int64             `json:"topicCount"`    // 旧账号发帖数
	CommentCount  int64             `json:"commentCount"`  // 旧账号评论数
	Score         int               `json:"score"`         // 旧账号积分
	IsEmpty       bool              `json:"isEmpty"`       // 是否为没有任何内容的空白影子账号
}

type oauthConflictCache struct {
	cache cache.Cache
}

var OAuthConflictCache = newOAuthConflictCache()

func newOAuthConflictCache() *oauthConflictCache {
	return &oauthConflictCache{
		cache: cache.New(
			cache.WithMaximumSize(5000),
			cache.WithExpireAfterAccess(15*time.Minute), // 冲突确认凭据 15 分钟内有效
		),
	}
}

func (c *oauthConflictCache) Get(token string) *OAuthConflictData {
	val, found := c.cache.GetIfPresent(token)
	if !found {
		return nil
	}
	return val.(*OAuthConflictData)
}

func (c *oauthConflictCache) Put(token string, data *OAuthConflictData) {
	c.cache.Put(token, data)
}

func (c *oauthConflictCache) Invalidate(token string) {
	c.cache.Invalidate(token)
}
