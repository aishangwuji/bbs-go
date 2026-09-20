import * as React from "react"
import { useNavigate, useSearchParams } from "react-router"

import { useAppState } from "@/components/app/app-provider"
import { SignupForm } from "@/components/auth/signup-form"
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
  return noindexRouteMeta(matches, "Sign up", "注册")
}

export default function SignupRoute() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isLogin, currentUser } = useAppState()
  const { t } = useI18n()
  useDocumentTitle(t("user.signup.title"))

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
      <div className="container mx-auto">
        <WidgetCard
          className="mx-auto max-w-[600px]"
          title={t("user.signup.title")}
          bodyClassName="pt-0"
        >
          <SignupForm redirect={searchParams.get("redirect") || undefined} />
        </WidgetCard>
      </div>
    </section>
  )
}

