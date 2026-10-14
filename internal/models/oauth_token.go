package models

import "gorm.io/gorm"

// OAuthToken 记录签发给各 OAuth 客户端的用户访问令牌
type OAuthToken struct {
	Model
	ClientId   string         `gorm:"size:64;not null;index:idx_oauth_token_client_id" json:"clientId" form:"clientId"`       // 归属客户端 ClientId
	UserId     int64          `gorm:"not null;index:idx_oauth_token_user_id" json:"userId" form:"userId"`                     // 授权用户 ID，关联 t_user.id
	Token      string         `gorm:"size:128;not null;uniqueIndex:uk_oauth_token_token" json:"token" form:"token"`           // 访问令牌 AccessToken（高熵随机加密串）
	Scope      string         `gorm:"size:128;default:''" json:"scope" form:"scope"`                                           // 授权作用域范围（例如："profile,email"）
	ExpiredAt  int64          `gorm:"not null;default:0;index:idx_oauth_token_expired_at" json:"expiredAt" form:"expiredAt"`   // 令牌过期时间戳（毫秒）
	Status     int            `gorm:"type:int;not null;default:0;index:idx_oauth_token_status" json:"status" form:"status"`   // 令牌状态（0: 正常有效, 1: 已主动吊销）
	LastUsedAt int64          `gorm:"not null;default:0" json:"lastUsedAt" form:"lastUsedAt"`                                 // 最近使用时间戳（毫秒）
	CreateTime int64          `gorm:"not null;default:0" json:"createTime" form:"createTime"`                                 // 签发创建时间戳（毫秒）
	UpdateTime int64          `gorm:"not null;default:0" json:"updateTime" form:"updateTime"`                                 // 更新时间戳（毫秒）
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`                                                                         // 软删除标记
}
