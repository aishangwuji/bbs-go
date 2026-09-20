import * as React from "react"
import { useNavigate, useSearchParams } from "react-router"

import { useAppState } from "@/components/app/app-provider"
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms"
import { WidgetCard } from "@/components/common/widget-card"
import { useI18n } from "@/lib/i18n/provider"
import { noindexRouteMeta } from "@/lib/seo"
import { safeRedirect } from "@/lib/site"
import { useDocumentTitle } from "@/lib/use-document-title"

import { requireGuest, requireGuestClient } from "../route-helpers/auth"

export async function loader(args: { request: Request; context?: any }) {
  await requireGuest(args)
  return null
}

export async function clientLoader(args: { request: Request }) {
  await requireGuestClient(args)
  return null
}

export function meta({
  matches,
}: {
  matches: Array<{ data?: unknown; loaderData?: unknown }>
}) {
  return noindexRouteMeta(matches, "Forgot password", "找回密码")
}

export default function ForgotRoute() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isLogin, currentUser } = useAppState()
  const { t } = useI18n()
  useDocumentTitle(t("user.passwordReset.forgot.title"))

  React.useEffect(() => {
    if (isLogin) {
      const target = safeRedirect(
        searchParams.get("redirect") || undefined,
        currentUser?.id ? `/user/${currentUser.id}` : "/"
      )
      navigate(target, { replace: true })
    }
  }, [isLogin, currentUser, navigate, searchParams])

  if (isLogin) {
    return null
  }

  return (
    <section className="main">
      <div className="container">
        <div className="main-body no-bg">
          <WidgetCard className="mx-auto max-w-[520px] p-6">
            <ForgotPasswordForm />
          </WidgetCard>
        </div>
      </div>
    </section>
  )
}

