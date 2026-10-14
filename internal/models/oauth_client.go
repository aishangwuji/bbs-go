package models

import "gorm.io/gorm"

// OAuthClient 登记接入 bbs-go 统一身份通行证的客户端应用凭据
type OAuthClient struct {
	Model
	ClientId     string         `gorm:"size:64;not null;uniqueIndex:uk_oauth_client_id" json:"clientId" form:"clientId"`       // 客户端公钥标识（例如：hnw_web_client）
	ClientSecret string         `gorm:"size:128;not null" json:"clientSecret" form:"clientSecret"`                              // 客户端通信机密密钥（bcrypt 哈希存储，严禁明文落库）
	Name         string         `gorm:"size:64;not null" json:"name" form:"name"`                                               // 应用展示名称（例如："北向行者导航站"）
	RedirectUris string         `gorm:"type:text;not null" json:"redirectUris" form:"redirectUris"`                             // 授权回调白名单地址列表（逗号分隔，严防开放重定向钓鱼漏洞）
	Description  string         `gorm:"size:256;default:''" json:"description" form:"description"`                               // 应用用途与权限说明
	Status       int            `gorm:"type:int;not null;default:0;index:idx_oauth_client_status" json:"status" form:"status"`   // 客户端状态（0: 正常使用, 1: 已禁用）
	CreateTime   int64          `gorm:"not null;default:0" json:"createTime" form:"createTime"`                                 // 创建时间戳（毫秒）
	UpdateTime   int64          `gorm:"not null;default:0" json:"updateTime" form:"updateTime"`                                 // 更新时间戳（毫秒）
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`                                                                         // 软删除标记
}
