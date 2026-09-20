import { Outlet, useLoaderData } from "react-router"

import { useCurrentUser } from "@/components/app/app-provider"
import { UserCenterShell } from "@/components/user/user-center-shell"
import type { Locale } from "@/lib/i18n"
import { useI18n } from "@/lib/i18n/provider"
import {
  loadUserCenterData,
  type UserCenterData,
} from "../route-helpers/user-profile"
import {
  localizedTitle,
  rootDataFromMatches,
  userMeta,
} from "@/lib/seo"

type RouteArgs = {
  request: Request
  params: { userId?: string }
}

export async function loader({ request, params }: RouteArgs) {
  return loadUserCenterData({ request, userId: params.userId || "" })
}

export async function clientLoader({ params }: RouteArgs) {
  return loadUserCenterData({ userId: params.userId || "" })
}

// 同一用户内切换子 tab，不重新加载外壳数据：布局与侧边栏保持挂载，
// 只有 Outlet 内容替换，这是切 tab 不再整页闪烁的关键。
// 例外：preview_role（管理员预览视角）变化时必须重拉，否则外壳数据
//（用户/徽章）停留在旧视角，与 SpaceViewContext 的角色切换脱节。
export function shouldRevalidate({
  currentParams,
  nextParams,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: {
  currentParams: Record<string, string | undefined>
  nextParams: Record<string, string | undefined>
  currentUrl: URL
  nextUrl: URL
  defaultShouldRevalidate: boolean
}) {
  if (currentParams.userId && currentParams.userId === nextParams.userId) {
    const currentRole = currentUrl.searchParams.get("preview_role")
    const nextRole = nextUrl.searchParams.get("preview_role")
    if (currentRole === nextRole) {
      return false
    }
  }
  return defaultShouldRevalidate
}

// 布局统一产出各 tab 的标题（按当前子路径判定），子路由不再重复定义 meta。
function sectionTitle(pathname: string, locale?: Locale) {
  const tail = pathname.split("/").filter(Boolean).pop() ?? ""
  if (tail === "articles") return localizedTitle(locale, "Articles", "文章")
  if (tail === "badges") return localizedTitle(locale, "Badges", "勋章")
  if (tail === "fans") return localizedTitle(locale, "Fans", "粉丝")
  if (tail === "followed") return localizedTitle(locale, "Following", "关注")
  return undefined
}

export function meta({
  data,
  location,
  matches,
}: {
  data?: UserCenterData
  location: { pathname: string }
  matches: Array<{ data?: unknown; loaderData?: unknown }>
}) {
  const rootData = rootDataFromMatches(matches)
  return userMeta(
    rootData?.config,
    data?.user,
    sectionTitle(location.pathname, rootData?.locale),
    location.pathname
  )
}

export default function UserCenterRoute() {
  const data = useLoaderData<typeof loader>()
  const currentUser = useCurrentUser()
  const { t } = useI18n()

  return (
    <UserCenterShell
      user={data.user}
      currentUser={currentUser}
      badges={data.badges}
      fans={data.fans}
      followed={data.followed}
      t={t}
      showTabs
    >
      <Outlet context={data} />
    </UserCenterShell>
  )
}
