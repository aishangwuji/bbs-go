export type EntityId = string

export interface ApiEnvelope<T> {
  success?: boolean
  data: T
  message?: string
  errorCode?: number
}

export interface PageData<T> {
  cursor?: string
  hasMore: boolean
  results: T[]
}

export interface UserSummary {
  id: EntityId
  username?: string
  nickname?: string
  avatar?: string
  smallAvatar?: string
  description?: string
  signature?: string
  signatureHtml?: string
  backgroundImage?: string
  smallBackgroundImage?: string
  homePage?: string
  createTime?: number
  score?: number
  exp?: number
  level?: number
  levelTitle?: string
  topicCount?: number
  commentCount?: number
  fansCount?: number
  followCount?: number
  forbidden?: boolean
  followed?: boolean
  // viewRole 当前上下文生效的视角角色：owner（主人态）、fans（粉丝态）、visitor（访客态）
  viewRole?: "owner" | "fans" | "visitor"
  // canPreview 当前访问者是否具备开启模拟视角的权限（仅号主本人为 true）
  canPreview?: boolean
  roles?: string[]
  permissions?: string[]
  passwordSet?: boolean
  email?: string
  emailVerified?: boolean
  expProgress?: {
    currentExp?: number
    level?: number
    levelTitle?: string
    expInCurrentLevel?: number
    expNeedForNextLevel?: number
    expProgressPercent?: number
    isMaxLevel?: boolean
  }
  githubProfile?: UserGithubProfile
}

export interface UserGithubProfile {
  githubId: number
  githubLogin: string
  githubName?: string
  githubAvatar?: string
  githubBio?: string
  githubCreatedAt: number
  accountAgeDays: number
  publicRepos: number
  followers: number
  topRepoName?: string
  topRepoStars?: number
  topRepoUrl?: string
  topRepoLang?: string
  topRepoDesc?: string
  contributedRepoName?: string
  contributedRepoStars?: number
  contributedPrTitle?: string
  contributedPrUrl?: string
  passedAdmission: boolean
  proofType: "repo_owner" | "contributor_merged_pr" | "account_age" | "none" | string
  proofReason?: string
  syncedAt?: number
}

export interface ImageInfo {
  name?: string
  url?: string
  preview?: string
  size?: number
}

export interface Category {
  id: number
  name: string
  type?: "normal" | "qa" | string
  description?: string
  logo?: string
  parentId?: number
  children?: Category[]
}

export interface Tag {
  id: number
  name: string
  description?: string
}

export interface Attachment {
  id: EntityId
  fileName?: string
  fileSize?: number
  downloadScore?: number
  downloadCount?: number
  downloaded?: boolean
}

export interface TopicAttachment extends Attachment {
  createTime?: number
}

export interface TopicTocItem {
  id: string
  title: string
  level?: number
}

export interface TopicVoteOption {
  id: number
  content: string
  sortNo?: number
  voteCount?: number
  percent?: number
  voted?: boolean
}

export interface TopicVote {
  id: number
  type?: 1 | 2 | "single" | "multiple" | string
  title?: string
  expiredAt?: number
  voteNum?: number
  optionCount?: number
  voteCount?: number
  expired?: boolean
  voted?: boolean
  optionIds?: number[]
  options?: TopicVoteOption[]
}

export interface Topic {
  id: EntityId
  type?: number
  title?: string
  content?: string
  summary?: string
  createTime?: number
  updateTime?: number
  user: UserSummary
  category?: Category
  tags?: Tag[]
  sticky?: boolean
  recommend?: boolean
  liked?: boolean
  likeCount?: number
  commentCount?: number
  viewCount?: number
  imageList?: ImageInfo[]
  qaStatus?: "solved" | "unsolved" | string
  bountyScore?: number
  attachments?: Attachment[]
  toc?: TopicTocItem[]
  favorited?: boolean
  ipLocation?: string
  status?: number
  vote?: TopicVote | null
  acceptedCommentId?: number
}

export interface TopicHideContent {
  content?: string
  exists: boolean
  show: boolean
}

export interface Pagination {
  currentPage: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
  prevPage: number
  nextPage: number
  pageList: number[]
}

export interface CommentPageData extends PageData<Comment> {
  pagination?: Pagination
}

export interface Comment {
  id: number
  floor?: number
  user: UserSummary
  entityType?: string
  entityId?: number | string
  contentType?: "text" | "html" | string
  content?: string
  imageList?: ImageInfo[]
  likeCount?: number
  commentCount?: number
  liked?: boolean
  quoteId?: number
  quote?: Comment | null
  replies?: PageData<Comment> | null
  ipLocation?: string
  status?: number
  createTime?: number
}

export interface SiteNav {
  title: string
  url: string
  openInNewWindow?: boolean
  children?: SiteNav[]
}

export interface SiteConfig {
  language?: string
  siteTitle?: string
  siteDescription?: string
  siteKeywords?: string[]
  baseURL?: string
  siteLogo?: string
  siteNavs?: SiteNav[]
  siteNotification?: string
  recommendTags?: string[]
  defaultCategoryId?: number
  topicListStyle?: "default" | "compact" | string
  topicCaptcha?: boolean
  createTopicEmailVerified?: boolean
  enableHideContent?: boolean
  enableQaBounty?: boolean
  attachmentConfig?: {
    enabled?: boolean
    allowedTypes?: string[]
    maxSizeMB?: number
    maxCount?: number
  }
  createArticleEmailVerified?: boolean
  createCommentEmailVerified?: boolean
  footerLinks?: Array<{
    text?: Record<string, string>
    url?: string
    visible?: boolean
    openInNewWindow?: boolean
  }>
  linkPageConfig?: {
    showFavicon?: boolean
  }
  signatureMinLevel?: number
  modules?: {
    tweet?: boolean
    topic?: boolean
    qa?: boolean
    article?: boolean
    [key: string]: boolean | undefined
  }
  loginConfig?: {
    passwordLogin?: { enabled?: boolean }
    smsLogin?: { enabled?: boolean }
    githubLogin?: { enabled?: boolean }
    googleLogin?: { enabled?: boolean; clientId?: string }
    weixinLogin?: { enabled?: boolean }
  }
  scriptInjections?: Array<{
    enabled?: boolean
    scriptName?: string
    type?: "external" | "inline" | string
    src?: string
    code?: string
    async?: boolean
    defer?: boolean
    crossorigin?: string
  }>
}

export interface ArticleEditForm {
  id: number
  articleId: number
  title: string
  content: string
  tags?: string[]
  cover?: ImageInfo | null
}

export interface TaskGroupInfo {
  key: string
  name: string
}

export interface TaskProgress {
  periodKey?: number
  eventProgress?: number
  eventTarget?: number
  finishedCount?: number
  maxFinishCount?: number
}

export interface TaskInfo {
  id: number
  groupName: string
  title: string
  description?: string
  eventType?: string
  period?: number
  eventCount?: number
  maxFinishCount?: number
  score?: number
  exp?: number
  badgeId?: number
  btnName?: string
  actionUrl?: string
  sortNo?: number
  startTime?: number
  endTime?: number
  status?: number
  userProgress?: TaskProgress | null
}

export interface CheckInInfo {
  id?: number
  userId?: number
  latestDayName?: string
  consecutiveDays?: number
  checkIn?: boolean
  updateTime?: number
  user?: UserSummary
}

export interface LoginResult {
  user: UserSummary
  token: string
  redirect?: string
}

export interface Article {
  id: number
  user: UserSummary
  tags?: Tag[]
  title: string
  content?: string
  summary?: string
  cover?: ImageInfo | null
  sourceUrl?: string
  viewCount?: number
  commentCount?: number
  likeCount?: number
  createTime?: number
  status?: number
  favorited?: boolean
  toc?: TopicTocItem[]
}

export interface SearchArticle {
  id: number
  user?: UserSummary
  tags?: Tag[]
  title?: string
  summary?: string
  createTime?: number
}

export interface SearchUser {
  user?: UserSummary
  nickname?: string
  username?: string
  description?: string
  createTime?: number
}

export interface SearchAllResult {
  topics?: Topic[]
  articles?: SearchArticle[]
  users?: SearchUser[]
}

export interface Favorite {
  id: number
  entityType?: string
  entityId?: number
  deleted?: boolean
  title?: string
  content?: string
  user?: UserSummary
  url?: string
  createTime?: number
}

export interface UserMessage {
  id: number
  from: UserSummary
  userId?: number
  title?: string
  content?: string
  quoteContent?: string
  type?: number
  detailUrl?: string
  extraData?: string
  status?: number
  createTime?: number
}

export interface ScoreLog {
  id: number
  userId?: number
  sourceType?: string
  sourceId?: string
  description?: string
  type: number
  score: number
  createTime?: number
}

export interface Badge {
  id: number
  name?: string
  title?: string
  description?: string
  icon?: string
  sortNo?: number
  status?: number
  owned?: boolean
  worn?: boolean
  obtainTime?: number
}

// UserCard 用户悬浮卡片数据（GET /api/user/:id/card）
// 复用 UserSummary 承载基础信息，badges 仅包含该用户已获得的勋章（佩戴优先）
export interface UserCard extends UserSummary {
  badges?: Badge[]
  badgeCount?: number
}

export interface BindInfo {
  bind?: boolean
  nickname?: string
}
