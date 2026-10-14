package cache

import (
	"sync"
	"time"

	"github.com/goburrow/cache"
)

// OAuthCodeData 临时授权码关联的服务端状态数据（绝不下发到前端浏览器）
type OAuthCodeData struct {
	ClientId    string // 客户端 ClientId
	UserId      int64  // 授权用户 ID (关联 t_user.id)
	RedirectUri string // 授权时提交的回调地址，换取 Token 时必须全等比对
	Scope       string // 授权范围
	CreateTime  int64  // 创建时间戳（毫秒）
}

type oauthCodeCache struct {
	cache cache.Cache
	mu    sync.Mutex
}

// OAuthCodeCache 授权码缓存：TTL 设定为 2 分钟，到期自动剔除
var OAuthCodeCache = &oauthCodeCache{
	cache: cache.New(cache.WithMaximumSize(10000), cache.WithExpireAfterWrite(2*time.Minute)),
}

// Put 写入授权码状态
func (c *oauthCodeCache) Put(code string, data *OAuthCodeData) {
	c.cache.Put(code, data)
}

// Take 原子性消费授权码：读取的同时在同一互斥锁内立即抹除，防止并发竞态下的重放攻击
func (c *oauthCodeCache) Take(code string) *OAuthCodeData {
	c.mu.Lock()
	defer c.mu.Unlock()
	val, found := c.cache.GetIfPresent(code)
	if !found {
		return nil
	}
	c.cache.Invalidate(code)
	return val.(*OAuthCodeData)
}
