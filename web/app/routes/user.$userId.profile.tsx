import { redirect } from "react-router"

import { useCurrentUser } from "@/components/app/app-provider"
import { RequireUser } from "@/components/auth/require-user"
import { WidgetCard } from "@/components/common/widget-card"
import { ProfileForm } from "@/components/user/profile-form"
import { useI18n } from "@/lib/i18n/provider"
import { usePathname } from "@/lib/router/navigation"
import { requireUser, requireUserClient } from "../route-helpers/auth"

type RouteArgs = {
  request: Request
  params: { userId?: string }
}

// 资料编辑仅本人可见：未登录去登录页；已登录但访问他人主页的 profile，回该主页公开话题页。
export async function loader({ request, params }: RouteArgs) {
  const me = await requireUser({ request })
  const userId = params.userId || ""
  if (String(me.id) !== userId) {
    throw redirect(`/user/${userId}`)
  }
  return null
}

export async function clientLoader({ request, params }: RouteArgs) {
  const me = await requireUserClient({ request })
  const userId = params.userId || ""
  if (String(me.id) !== userId) {
    throw redirect(`/user/${userId}`)
  }
  return null
}

export default function UserProfileSettingsRoute() {
  const { t } = useI18n()
  const pathname = usePathname()
  const currentUser = useCurrentUser()

  return (
    <RequireUser initialUser={currentUser} redirectPath={pathname}>
      <WidgetCard title={t("user.profile.title")}>
        <ProfileForm user={currentUser || undefined} />
      </WidgetCard>
    </RequireUser>
  )
}
