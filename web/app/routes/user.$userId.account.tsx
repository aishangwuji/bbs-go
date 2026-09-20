import { redirect } from "react-router"

import { useAppState } from "@/components/app/app-provider"
import { RequireUser } from "@/components/auth/require-user"
import { WidgetCard } from "@/components/common/widget-card"
import { AccountSettings } from "@/components/user/account-settings"
import { useI18n } from "@/lib/i18n/provider"
import { usePathname } from "@/lib/router/navigation"
import { requireUser, requireUserClient } from "../route-helpers/auth"

type RouteArgs = {
  request: Request
  params: { userId?: string }
}

// 账号设置仅本人可见：未登录去登录页；已登录但访问他人主页的 account，回该主页公开话题页。
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

export default function UserAccountSettingsRoute() {
  const { t } = useI18n()
  const pathname = usePathname()
  const { config, currentUser } = useAppState()

  return (
    <RequireUser initialUser={currentUser} redirectPath={pathname}>
      <WidgetCard title={t("user.profile.account.title")}>
        <AccountSettings
          user={currentUser || undefined}
          config={config}
          bindInfo={{}}
        />
      </WidgetCard>
    </RequireUser>
  )
}
