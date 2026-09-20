import { apiFetch } from "@/lib/api/client"
import type {
  Article,
  Badge,
  PageData,
  Topic,
  UserSummary,
} from "@/lib/api/types"

// UserCenterData 用户中心布局外壳数据（用户 + 徽章 + 粉丝/关注预览）。
// 设计：由父布局路由（user.$userId）一次性拉取；子 tab 切换时 shouldRevalidate
// 按 userId 裁决不再重拉，外壳组件因此不重建，切 tab 不再整页闪烁。
export type UserCenterData = {
  user: UserSummary
  badges: Badge[]
  fans: UserSummary[]
  followed: UserSummary[]
}

type CenterArgs = {
  request?: Request
  userId: string
}

// preview_role 管理员预览角色（?preview_role=…）：server loader 从 request.url 取，
// client 从地址栏取。沿用既有链路逐层透传，不在此处做权限判断。
function previewRoleOf(request?: Request) {
  const url = request ? new URL(request.url) : null
  return (
    url?.searchParams.get("preview_role") ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("preview_role")
      : null)
  )
}

function carrierOf(request?: Request) {
  return request ? { request } : {}
}

export async function loadUserCenterData({
  request,
  userId,
}: CenterArgs): Promise<UserCenterData> {
  const previewRole = previewRoleOf(request)
  const [user, badges, fans, followed] = await Promise.all([
    apiFetch<UserSummary>(`/api/user/${userId}`, {
      ...carrierOf(request),
      params: previewRole ? { preview_role: previewRole } : undefined,
    }),
    apiFetch<Badge[]>("/api/badge/badges", {
      ...carrierOf(request),
      params: { userId },
    }).catch(() => []),
    apiFetch<PageData<UserSummary>>("/api/fans/recent/fans", {
      ...carrierOf(request),
      params: { userId },
    })
      .then((data) => data.results || [])
      .catch(() => []),
    apiFetch<PageData<UserSummary>>("/api/fans/recent/follow", {
      ...carrierOf(request),
      params: { userId },
    })
      .then((data) => data.results || [])
      .catch(() => []),
  ])

  return { user, badges, fans, followed }
}

function emptyPageList<T>(): PageData<T> {
  return { results: [], cursor: "0", hasMore: false }
}

// 以下为各 tab 首屏数据，由子路由 loader 按需拉取。
// React Router 在子路由切换时保留旧内容直到新 loader 就绪，内容区不会出现空白占位；
// 分页后续仍由客户端 LoadMore 追加。失败时返回空页（与既有 .catch 行为一致）。
export async function loadUserTopics({
  request,
  userId,
}: CenterArgs): Promise<PageData<Topic>> {
  const previewRole = previewRoleOf(request)
  return apiFetch<PageData<Topic>>("/api/topic/user_topics", {
    ...carrierOf(request),
    params: { userId, preview_role: previewRole || undefined },
  }).catch(() => emptyPageList<Topic>())
}

export async function loadUserArticles({
  request,
  userId,
}: CenterArgs): Promise<PageData<Article>> {
  const previewRole = previewRoleOf(request)
  return apiFetch<PageData<Article>>("/api/article/user_articles", {
    ...carrierOf(request),
    params: { userId, preview_role: previewRole || undefined },
  }).catch(() => emptyPageList<Article>())
}

export async function loadUserFans({
  request,
  userId,
}: CenterArgs): Promise<PageData<UserSummary>> {
  return apiFetch<PageData<UserSummary>>("/api/fans/fans", {
    ...carrierOf(request),
    params: { userId },
  }).catch(() => emptyPageList<UserSummary>())
}

export async function loadUserFollowed({
  request,
  userId,
}: CenterArgs): Promise<PageData<UserSummary>> {
  return apiFetch<PageData<UserSummary>>("/api/fans/followed", {
    ...carrierOf(request),
    params: { userId },
  }).catch(() => emptyPageList<UserSummary>())
}
