package models

import (
	"gorm.io/gorm"
)

// UserGithubProfile 用户 GitHub 开源开发者画像与贡献证明表
type UserGithubProfile struct {
	Model
	UserId               int64          `gorm:"not null;uniqueIndex:uk_user_github_profile_user_id" json:"userId" form:"userId"` // 社区用户ID，关联 t_user.id
	GithubId             int64          `gorm:"not null;index:idx_github_profile_gid" json:"githubId" form:"githubId"`           // GitHub 用户数字 ID
	GithubLogin          string         `gorm:"size:64;not null" json:"githubLogin" form:"githubLogin"`                          // GitHub 用户名（handle）
	GithubName           string         `gorm:"size:64;default:''" json:"githubName" form:"githubName"`                          // GitHub 显示昵称
	GithubAvatar         string         `gorm:"size:1024;default:''" json:"githubAvatar" form:"githubAvatar"`                    // GitHub 头像地址
	GithubBio            string         `gorm:"size:512;default:''" json:"githubBio" form:"githubBio"`                           // GitHub 个人简介
	GithubCreatedAt      int64          `gorm:"not null;default:0" json:"githubCreatedAt" form:"githubCreatedAt"`                // GitHub 账号创建时间戳（毫秒）
	AccountAgeDays       int            `gorm:"not null;default:0" json:"accountAgeDays" form:"accountAgeDays"`                   // GitHub 账号注册天数（计算至今）
	PublicRepos          int            `gorm:"not null;default:0" json:"publicRepos" form:"publicRepos"`                         // GitHub 公开仓库数
	Followers            int            `gorm:"not null;default:0" json:"followers" form:"followers"`                             // GitHub 关注者粉丝数
	TopRepoName          string         `gorm:"size:128;default:''" json:"topRepoName" form:"topRepoName"`                       // 名下最高 Star 仓库全名（例如 owner/repo）
	TopRepoStars         int            `gorm:"not null;default:0" json:"topRepoStars" form:"topRepoStars"`                      // 名下最高 Star 仓库 Star 数
	TopRepoUrl           string         `gorm:"size:512;default:''" json:"topRepoUrl" form:"topRepoUrl"`                         // 名下最高 Star 仓库页面链接
	TopRepoLang          string         `gorm:"size:64;default:''" json:"topRepoLang" form:"topRepoLang"`                         // 名下最高 Star 仓库主要编程语言
	TopRepoDesc          string         `gorm:"size:512;default:''" json:"topRepoDesc" form:"topRepoDesc"`                       // 名下最高 Star 仓库简介
	ContributedRepoName  string         `gorm:"size:128;default:''" json:"contributedRepoName" form:"contributedRepoName"`       // 贡献合并 PR 的最高 Star 仓库全名
	ContributedRepoStars int            `gorm:"not null;default:0" json:"contributedRepoStars" form:"contributedRepoStars"`     // 贡献合并 PR 的仓库 Star 数
	ContributedPrTitle   string         `gorm:"size:256;default:''" json:"contributedPrTitle" form:"contributedPrTitle"`         // 贡献的已合并 PR 标题
	ContributedPrUrl     string         `gorm:"size:512;default:''" json:"contributedPrUrl" form:"contributedPrUrl"`             // 贡献的已合并 PR 页面链接
	MergedPrs            string         `gorm:"type:text" json:"mergedPrs" form:"mergedPrs"`                                     // 用户贡献的合格合并PR候选列表JSON快照
	SelectedPrUrl        string         `gorm:"size:512;default:''" json:"selectedPrUrl" form:"selectedPrUrl"`                   // 用户在个人主页自主指定置顶展示的合并PR链接
	PassedAdmission      bool           `gorm:"not null;default:false" json:"passedAdmission" form:"passedAdmission"`           // 是否达成开发者准入门槛（true:达成 false:未达成）
	ProofType            string         `gorm:"size:32;default:''" json:"proofType" form:"proofType"`                            // 最高成就证明类型：repo_owner / contributor_merged_pr / account_age / none
	ProofReason          string         `gorm:"size:256;default:''" json:"proofReason" form:"proofReason"`                       // 准入判定中文结果说明
	RawData              string         `gorm:"type:text" json:"rawData" form:"rawData"`                                         // GitHub 完整资料与校验结果 JSON 快照
	SyncedAt             int64          `gorm:"not null;default:0" json:"syncedAt" form:"syncedAt"`                               // 上次同步成功时间戳（毫秒）
	CreateTime           int64          `gorm:"not null;default:0" json:"createTime" form:"createTime"`                           // 创建时间戳（毫秒）
	UpdateTime           int64          `gorm:"not null;default:0" json:"updateTime" form:"updateTime"`                           // 更新时间戳（毫秒）
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`                                                                  // 软删除标记
}
