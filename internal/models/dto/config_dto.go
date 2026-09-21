package dto

// SysConfigAdminResponse
//
//	Admin配置返回结构体
type SysConfigAdminResponse struct {
	SiteTitle                  string                      `json:"siteTitle"`
	SiteDescription            string                      `json:"siteDescription"`
	BaseURL                    string                      `json:"baseURL"`
	SiteKeywords               []string                    `json:"siteKeywords"`
	SiteLogo                   string                      `json:"siteLogo"`
	SiteNavs                   []ActionLink                `json:"siteNavs"`
	SiteNotification           string                      `json:"siteNotification"`
	AboutPageConfig            AboutPageConfig             `json:"aboutPageConfig"`
	FooterLinks                []FooterLink                `json:"footerLinks"`
	LinkPageConfig             LinkPageConfig              `json:"linkPageConfig"`
	SignatureMinLevel          int                         `json:"signatureMinLevel"`
	RecommendTags              []string                    `json:"recommendTags"`
	UrlRedirect                bool                        `json:"urlRedirect"`
	DefaultCategoryId          int64                       `json:"defaultCategoryId"`
	TopicListStyle             string                      `json:"topicListStyle"`
	ArticlePending             bool                        `json:"articlePending"`
	TopicCaptcha               bool                        `json:"topicCaptcha"`
	TopicPending               bool                        `json:"topicPending"`
	UserObserveSeconds         int                         `json:"userObserveSeconds"`
	TokenExpireDays            int                         `json:"tokenExpireDays"`
	CreateTopicEmailVerified   bool                        `json:"createTopicEmailVerified"`
	CreateArticleEmailVerified bool                        `json:"createArticleEmailVerified"`
	CreateCommentEmailVerified bool                        `json:"createCommentEmailVerified"`
	EnableHideContent          bool                        `json:"enableHideContent"`
	EnableQaBounty             bool                        `json:"enableQaBounty"`
	QaBountyMin                int                         `json:"qaBountyMin"`
	QaBountyMax                int                         `json:"qaBountyMax"`
	QaBountyRequired           bool                        `json:"qaBountyRequired"`
	Modules                    ModulesConfig               `json:"modules"`
	EmailWhitelist             []string                    `json:"emailWhitelist"`             // 邮箱白名单
	EmailNoticeIntervalSeconds int                         `json:"emailNoticeIntervalSeconds"` // 邮件通知间隔(秒)
	NotificationTypes          map[string]NoticeTypeConfig `json:"notificationTypes"`          // 各消息类型站内信+邮件开关
	LoginConfig                LoginConfig                 `json:"loginConfig"`                // 登录配置
	SmtpConfig                 SmtpConfig                  `json:"smtpConfig"`                 // SMTP配置
	UploadConfig               UploadConfig                `json:"uploadConfig"`               // 上传配置
	AttachmentConfig           AttachmentConfig            `json:"attachmentConfig"`           // 附件配置
	ScriptInjections           []ScriptInjection           `json:"scriptInjections"`           // head脚本注入
	JevConfig                  JevConfig                   `json:"jevConfig"`                  // Jev/OpenRouter 智能风控配置
}

// SysConfigOpenResponse
//
//	Open配置返回结构体
type SysConfigOpenResponse struct {
	SiteTitle                  string            `json:"siteTitle"`
	SiteDescription            string            `json:"siteDescription"`
	BaseURL                    string            `json:"baseURL"`
	SiteKeywords               []string          `json:"siteKeywords"`
	SiteLogo                   string            `json:"siteLogo"`
	SiteNavs                   []ActionLink      `json:"siteNavs"`
	SiteNotification           string            `json:"siteNotification"`
	FooterLinks                []FooterLink      `json:"footerLinks"`
	LinkPageConfig             LinkPageConfig    `json:"linkPageConfig"`
	SignatureMinLevel          int               `json:"signatureMinLevel"`
	RecommendTags              []string          `json:"recommendTags"`
	UrlRedirect                bool              `json:"urlRedirect"`
	DefaultCategoryId          int64             `json:"defaultCategoryId"`
	TopicListStyle             string            `json:"topicListStyle"`
	ArticlePending             bool              `json:"articlePending"`
	TopicCaptcha               bool              `json:"topicCaptcha"`
	TopicPending               bool              `json:"topicPending"`
	UserObserveSeconds         int               `json:"userObserveSeconds"`
	TokenExpireDays            int               `json:"tokenExpireDays"`
	CreateTopicEmailVerified   bool              `json:"createTopicEmailVerified"`
	CreateArticleEmailVerified bool              `json:"createArticleEmailVerified"`
	CreateCommentEmailVerified bool              `json:"createCommentEmailVerified"`
	EnableHideContent          bool              `json:"enableHideContent"`
	EnableQaBounty             bool              `json:"enableQaBounty"`
	QaBountyMin                int               `json:"qaBountyMin"`
	QaBountyMax                int               `json:"qaBountyMax"`
	QaBountyRequired           bool              `json:"qaBountyRequired"`
	Modules                    ModulesConfig     `json:"modules"`
	EmailNoticeIntervalSeconds int               `json:"emailNoticeIntervalSeconds"` // 邮件通知间隔(秒)
	AttachmentConfig           AttachmentConfig  `json:"attachmentConfig"`           // 附件配置
	LoginConfig                OpenLoginConfig   `json:"loginConfig"`                // 登录配置
	ScriptInjections           []ScriptInjection `json:"scriptInjections"`           // head脚本注入
}

type ScriptInjection struct {
	Enabled     bool   `json:"enabled"`
	ScriptName  string `json:"scriptName"` // 仅后台展示
	Type        string `json:"type"`       // external | inline
	Src         string `json:"src"`
	Code        string `json:"code"`
	Async       bool   `json:"async"`
	Defer       bool   `json:"defer"`
	Crossorigin string `json:"crossorigin"`
}

type AboutPageConfig struct {
	Content LocalizedText `json:"content"`
}

type LinkPageConfig struct {
	ShowFavicon bool `json:"showFavicon"` // 友链页是否实时展示网站图标（不存储，基于 URL 实时拼接 favicon 服务）
}

type FooterLink struct {
	Text            LocalizedText `json:"text"`
	Url             string        `json:"url"`
	OpenInNewWindow bool          `json:"openInNewWindow"`
	Visible         bool          `json:"visible"`
}

type OpenLoginConfig struct {
	PasswordLogin EnabledConfig `json:"passwordLogin"` // 密码登录
	WeixinLogin   EnabledConfig `json:"weixinLogin"`   // 微信登录
	SmsLogin      EnabledConfig `json:"smsLogin"`      // 短信登录
	GoogleLogin   OAuthConfig   `json:"googleLogin"`   // Google登录
	GithubLogin   EnabledConfig `json:"githubLogin"`   // GitHub登录
}

type EnabledConfig struct {
	Enabled bool `json:"enabled"`
}

type OAuthConfig struct {
	Enabled  bool   `json:"enabled"`
	ClientId string `json:"clientId,omitempty"`
}

// NoticeTypeConfig 某类消息的站内信/邮件开关
type NoticeTypeConfig struct {
	Site  bool `json:"site"`
	Email bool `json:"email"`
}

// ModulesConfig
//
//	模块配置
type ModulesConfig struct {
	Tweet   bool `json:"tweet"`
	Topic   bool `json:"topic"`
	QA      bool `json:"qa"`
	Article bool `json:"article"`
}

// LoginConfig 登录配置
type LoginConfig struct {
	// 密码登录
	PasswordLogin EnabledConfig `json:"passwordLogin"`

	// 微信登录
	WeixinLogin struct {
		Enabled   bool   `json:"enabled"`
		AppId     string `json:"appId"`
		AppSecret string `json:"appSecret"`
	} `json:"weixinLogin"`

	// 短信登录
	SmsLogin struct {
		Enabled bool `json:"enabled"`
		// 短信平台
		Platform string `json:"platform"`
		// 阿里云平台配置
		Aliyun AliyunSmsConfig `json:"aliyun"`
	} `json:"smsLogin"`

	// Google登录
	GoogleLogin struct {
		Enabled      bool   `json:"enabled"`
		ClientId     string `json:"clientId"`
		ClientSecret string `json:"clientSecret"`
	} `json:"googleLogin"`

	// GitHub登录
	GithubLogin struct {
		Enabled      bool   `json:"enabled"`
		ClientId     string `json:"clientId"`
		ClientSecret string `json:"clientSecret"`
	} `json:"githubLogin"`
}

type AliyunSmsConfig struct {
	AccessKeyId     string `json:"accessKeyId"`
	AccessKeySecret string `json:"accessKeySecret"`
	SignName        string `json:"signName"`
	TemplateCode    string `json:"templateCode"`
}

// IsAllDisabled 是否禁用了所有登录方式
func (c *LoginConfig) IsAllDisabled() bool {
	return !c.PasswordLogin.Enabled && !c.WeixinLogin.Enabled && !c.SmsLogin.Enabled && !c.GoogleLogin.Enabled && !c.GithubLogin.Enabled
}

type UploadMethod string

const (
	Local      UploadMethod = "Local"
	AliyunOss  UploadMethod = "AliyunOss"
	TencentCos UploadMethod = "TencentCos"
	AwsS3      UploadMethod = "AwsS3"
	S3         UploadMethod = "S3"
)

type UploadConfig struct {
	EnableUploadMethod UploadMethod           `json:"enableUploadMethod"`
	AliyunOss          AliyunOssUploadConfig  `json:"aliyunOss"`
	TencentCos         TencentCosUploadConfig `json:"tencentCos"`
	AwsS3              AwsS3UploadConfig      `json:"awsS3"`
	S3                 S3UploadConfig         `json:"s3"`
}

type SmtpConfig struct {
	Host     string `json:"host"`
	Port     string `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	SSL      bool   `json:"ssl"`
}

type AliyunOssUploadConfig struct {
	Host            string `json:"host"`
	Bucket          string `json:"bucket"`
	Endpoint        string `json:"endpoint"`
	AccessKeyId     string `json:"accessKeyId"`
	AccessKeySecret string `json:"accessKeySecret"`
	StyleSplitter   string `json:"styleSplitter"`
	StyleAvatar     string `json:"styleAvatar"`
	StylePreview    string `json:"stylePreview"`
	StyleSmall      string `json:"styleSmall"`
	StyleDetail     string `json:"styleDetail"`
}

type TencentCosUploadConfig struct {
	Bucket    string `json:"bucket"`
	Region    string `json:"region"`
	SecretId  string `json:"secretId"`
	SecretKey string `json:"secretKey"`
}

type AwsS3UploadConfig struct {
	Region          string `json:"region"`
	Bucket          string `json:"bucket"`
	AccessKeyId     string `json:"accessKeyId"`
	AccessKeySecret string `json:"accessKeySecret"`
}

// S3UploadConfig 通用 S3 兼容存储配置，兼容 Cloudflare R2 / MinIO / RustFS 等。
type S3UploadConfig struct {
	Host            string `json:"host"`        // 对象访问的 URL 前缀，留空时按 Endpoint+Bucket 推导
	Bucket          string `json:"bucket"`     // 桶名称
	Endpoint        string `json:"endpoint"`   // S3 API Endpoint，如 https://xxx.r2.cloudflarestorage.com
	Region          string `json:"region"`     // 区域，Cloudflare R2 使用 auto
	AccessKeyId     string `json:"accessKeyId"`
	AccessKeySecret string `json:"accessKeySecret"`
	PathStyle       bool   `json:"pathStyle"` // 是否使用 path-style 寻址（MinIO/RustFS 通常为 true，R2 为 false）
}

// AttachmentConfig 帖子附件配置（单 Key 存 JSON）
type AttachmentConfig struct {
	Enabled      bool     `json:"enabled"`      // 是否开启附件上传
	AllowedTypes []string `json:"allowedTypes"` // 允许的扩展名，如 [".pdf",".doc"]，空表示使用默认
	MaxSizeMB    int      `json:"maxSizeMB"`    // 单个附件大小限制(MB)，0 表示默认 10MB
	MaxCount     int      `json:"maxCount"`     // 每篇帖子最多附件数，0 表示默认 5
}

// JevConfig 智能内容风控配置 (Jev / OpenRouter)
type JevConfig struct {
	Enabled                  bool    `json:"enabled"`                  // 是否启用 Jev 智能风控
	Provider                 string  `json:"provider"`                 // 提供商类型：openrouter 或 typesafe
	ApiKey                   string  `json:"apiKey"`                   // API Key
	Endpoint                 string  `json:"endpoint"`                 // API 端点
	Model                    string  `json:"model"`                    // 模型标识 (如 ~typesafe/jev-latest)
	TimeoutMs                int     `json:"timeoutMs"`                // 超时毫秒数 (默认 3000)
	AutoRejectScoreThreshold float64 `json:"autoRejectScoreThreshold"` // 自动驳回严重程度阈值 (Score 0~2)
	AutoRejectSpamThreshold  float64 `json:"autoRejectSpamThreshold"`  // 自动驳回垃圾概率阈值 (Noul 0~1)
	AutoReviewScoreThreshold float64 `json:"autoReviewScoreThreshold"` // 自动进入待审严重程度阈值 (Score 0~2)
	AutoReviewSpamThreshold  float64 `json:"autoReviewSpamThreshold"`  // 自动进入待审垃圾概率阈值 (Noul 0~1)
}

// JevRuleConfig Jev 决策模型与问询规则中心配置
type JevRuleConfig struct {
	MaxContentLength int                 `json:"maxContentLength"` // 提取正文快照最大字符长度（默认 500）
	IncludeTitle     bool                `json:"includeTitle"`     // 是否注入标题字段至 State
	NoulQuestions    []JevNoulQuestion   `json:"noulQuestions"`    // Noul 概率类问题列表 (0~1)
	ScoreQuestions   []JevScoreQuestion  `json:"scoreQuestions"`   // Score 阶梯打分类问题列表 (0, 1, 2...)
	ChoiceQuestions  []JevChoiceQuestion `json:"choiceQuestions"`  // Choice 离散归类问题列表
}

// JevNoulQuestion Jev Noul 连续概率问题定义 (P ∈ [0, 1])
type JevNoulQuestion struct {
	Key             string  `json:"key"`             // 问询唯一标识，如 is_spam
	Label           string  `json:"label"`           // 中文展示名，如 垃圾推广概率
	Instructions    string  `json:"instructions"`    // Jev 判定指令提示词
	RejectThreshold float64 `json:"rejectThreshold"` // 触发自动下架驳回的概率阈值 (0~1)
	ReviewThreshold float64 `json:"reviewThreshold"` // 触发人工审核待审的概率阈值 (0~1)
	Enabled         bool    `json:"enabled"`         // 是否启用该维度判定
}

// JevScoreQuestion Jev Score 离散打分问题定义 (分值 0, 1, 2...)
type JevScoreQuestion struct {
	Key             string   `json:"key"`             // 问询唯一标识，如 toxicity
	Label           string   `json:"label"`           // 中文展示名，如 攻击性与辱骂程度
	Instructions    string   `json:"instructions"`    // Jev 判定指令提示词
	Criteria        []string `json:"criteria"`        // 阶梯判定标准列表 [0级说明, 1级说明, 2级说明]
	RejectThreshold float64  `json:"rejectThreshold"` // 触发自动下架驳回的分值阈值
	ReviewThreshold float64  `json:"reviewThreshold"` // 触发人工审核待审的分值阈值
	Enabled         bool     `json:"enabled"`         // 是否启用该维度判定
}

// JevChoiceQuestion Jev Choice 离散多分类归因问题定义
type JevChoiceQuestion struct {
	Key               string            `json:"key"`               // 问询唯一标识，如 violation_category
	Label             string            `json:"label"`             // 中文展示名，如 违规归因分类
	Instructions      string            `json:"instructions"`      // Jev 判定指令提示词
	Criteria          map[string]string `json:"criteria"`          // 选项与含义映射 [key -> 说明]
	AutoRejectOptions []string          `json:"autoRejectOptions"` // 命中即触发自动下架驳回的选项集合
	AutoReviewOptions []string          `json:"autoReviewOptions"` // 命中即触发人工待审的选项集合
	Enabled           bool              `json:"enabled"`           // 是否启用该维度判定
}

// DefaultJevRuleConfig 提供生产默认预设
func DefaultJevRuleConfig() JevRuleConfig {
	return JevRuleConfig{
		MaxContentLength: 500,
		IncludeTitle:     true,
		NoulQuestions: []JevNoulQuestion{
			{
				Key:             "is_spam",
				Label:           "垃圾营销广告",
				Instructions:    "Does `title` or `content` contain spam, commercial ads, fraudulent schemes, or prohibited promotional links?",
				RejectThreshold: 0.85,
				ReviewThreshold: 0.45,
				Enabled:         true,
			},
		},
		ScoreQuestions: []JevScoreQuestion{
			{
				Key:          "toxicity",
				Label:        "攻击辱骂严重度",
				Instructions: "How toxic, abusive, or hostile is the tone of this post?",
				Criteria: []string{
					"Civil and rational discussion; friendly or neutral",
					"Mildly uncivil, sarcastic, or slightly provocative, but still technical/relevant",
					"Severe personal attacks, vulgar abuse, hate speech, threats, or explicit harassment",
				},
				RejectThreshold: 1.5,
				ReviewThreshold: 0.8,
				Enabled:         true,
			},
		},
		ChoiceQuestions: []JevChoiceQuestion{
			{
				Key:          "violation_category",
				Label:        "违规类型归类",
				Instructions: "If this content violates community standards, which category does it primarily belong to?",
				Criteria: map[string]string{
					"clean":        "No violation found; normal discussion",
					"spam_ad":      "Unsolicited advertisement, promotional spam, or marketing",
					"flame_abuse":  "Personal attacks, insults, or harassment",
					"illegal_info": "Fraud, gambling, pornography, or prohibited items",
					"other":        "Other community guideline violations",
				},
				AutoRejectOptions: []string{"illegal_info"},
				AutoReviewOptions: []string{"spam_ad", "flame_abuse"},
				Enabled:           true,
			},
		},
	}
}

