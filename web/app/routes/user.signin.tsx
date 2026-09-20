import * as React from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router"

import { useAppState } from "@/components/app/app-provider"
import { SigninForm } from "@/components/auth/signin-form"
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
  return noindexRouteMeta(matches, "Sign in", "登录")
}

export default function SigninRoute() {
  const { t } = useI18n()
  useDocumentTitle(t("user.signin.title"))
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const authError =
    typeof location.state === "object" &&
    location.state &&
    "authError" in location.state
      ? String(location.state.authError || "")
      : ""
  const { config, isLogin, currentUser } = useAppState()

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
      {authError ? (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow">
          {authError}
        </div>
      ) : null}
      <div className="container">
        <div className="main-body no-bg">
          <SigninForm
            redirect={searchParams.get("redirect") || undefined}
            config={config}
          />
        </div>
      </div>
    </section>
  )
}

