import * as React from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { AlertTriangle, GitMerge, LoaderCircle } from "lucide-react"

import { useAppState } from "@/components/app/app-provider"
import { UserAvatar } from "@/components/common/avatar"
import { Button } from "@/components/ui/button"
import { apiFetch, toFormData } from "@/lib/api/client"
import type { LoginResult, UserSummary } from "@/lib/api/types"
import { parseOAuthCallback } from "@/lib/auth/oauth-callback.js"
import { useI18n } from "@/lib/i18n/provider"
import { noindexRouteMeta } from "@/lib/seo"
import { safeRedirect } from "@/lib/site"
import { useToastActions } from "@/lib/toast"
import { useDocumentTitle } from "@/lib/use-document-title"

export function meta({
  matches,
}: {
  matches: Array<{ data?: unknown; loaderData?: unknown }>
}) {
  return noindexRouteMeta(matches, "Signing in", "登录中")
}

type ConflictInfo = {
  status: "conflict"
  provider: string
  conflictToken: string
  conflictUser: {
    id: number
    nickname: string
    avatar: string
    topicCount: number
    commentCount: number
    score: number
    isEmpty: boolean
  }
  redirect?: string
}

export default function SigninCallbackRoute() {
  const { t } = useI18n()
  useDocumentTitle(t("user.signin.callbackTitle"))
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const { setCurrentUser } = useAppState()
  const { catchError, msgError, msgSuccess } = useToastActions()
  const submittedRef = React.useRef(false)
  const [conflict, setConflict] = React.useState<ConflictInfo | null>(null)
  const [resolving, setResolving] = React.useState(false)

  const callbackPath =
    params["*"] ||
    (typeof window !== "undefined" ? window.location.pathname : "")
  const callback = parseOAuthCallback(callbackPath, searchParams).callback

  React.useEffect(() => {
    if (submittedRef.current) return
    submittedRef.current = true

    async function submitCallback() {
      const parsed = parseOAuthCallback(callbackPath, searchParams)
      if (!parsed.ok) {
        msgError(t("user.signin.missingAuthParams"))
        navigate(parsed.callback?.failureRedirect || "/user/signin", {
          replace: true,
        })
        return
      }

      try {
        if (parsed.callback.kind === "bind") {
          const res = await apiFetch<any>(parsed.callback.submitPath, {
            method: "POST",
            body: toFormData({ code: parsed.code, state: parsed.state }),
          })
          if (res?.status === "conflict") {
            setConflict(res as ConflictInfo)
            return
          }
          navigate(parsed.callback.successRedirect, { replace: true })
          return
        }

        const result = await apiFetch<any>(parsed.callback.submitPath, {
          method: "POST",
          body: toFormData({ code: parsed.code, state: parsed.state }),
        })

        if (result?.status === "conflict") {
          setConflict(result as ConflictInfo)
          return
        }

        const loginRes = result as LoginResult
        setCurrentUser(loginRes.user)
        window.location.replace(
          safeRedirect(loginRes.redirect, `/user/${loginRes.user.id}`)
        )
      } catch (error) {
        catchError(error)
        const parsed = parseOAuthCallback(callbackPath, searchParams)
        navigate(parsed.callback?.failureRedirect || "/user/signin", {
          replace: true,
        })
      }
    }

    void submitCallback()
  }, [
    callbackPath,
    catchError,
    msgError,
    navigate,
    searchParams,
    setCurrentUser,
    t,
  ])

  const handleResolve = async (action: "merge" | "cancel") => {
    if (!conflict) return
    if (action === "cancel") {
      try {
        await apiFetch("/api/login/oauth_resolve_conflict", {
          method: "POST",
          body: { conflictToken: conflict.conflictToken, action: "cancel" },
        })
      } catch {}
      navigate(safeRedirect(conflict.redirect, "/user/profile/account"), {
        replace: true,
      })
      return
    }

    setResolving(true)
    try {
      await apiFetch("/api/login/oauth_resolve_conflict", {
        method: "POST",
        body: { conflictToken: conflict.conflictToken, action: "merge" },
      })
      msgSuccess(
        conflict.conflictUser.isEmpty
          ? "第三方账号已成功解绑并关联至当前账号！"
          : "账号资产合并与第三方绑定已全部完成！"
      )
      const current = await apiFetch<UserSummary>("/api/user/current").catch(
        () => null
      )
      if (current) setCurrentUser(current)
      navigate(safeRedirect(conflict.redirect, "/user/profile/account"), {
        replace: true,
      })
    } catch (err) {
      catchError(err)
      setResolving(false)
    }
  }

  const providerLabel =
    conflict?.provider === "github"
      ? "GitHub"
      : conflict?.provider === "google"
        ? "Google"
        : "第三方"

  return (
    <section className="main">
      <div className="container" style={{ minHeight: 360 }}>
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
          {conflict ? (
            <div className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-2xl transition-all">
              <div className="flex items-center gap-3 border-b pb-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold leading-none">
                    绑定第三方账号冲突
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    该 {providerLabel} 账号已关联其他社区账号
                  </p>
                </div>
              </div>

              <div className="my-4 rounded-lg border border-border/70 bg-muted/40 p-3.5">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    user={{
                      id: String(conflict.conflictUser.id),
                      nickname: conflict.conflictUser.nickname,
                      avatar: conflict.conflictUser.avatar,
                    }}
                    size={40}
                    linkToProfile={false}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {conflict.conflictUser.nickname}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {conflict.conflictUser.isEmpty ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          空白影子账号（无发帖无内容）
                        </span>
                      ) : (
                        <span>
                          发帖 {conflict.conflictUser.topicCount} · 评论{" "}
                          {conflict.conflictUser.commentCount} · 积分{" "}
                          {conflict.conflictUser.score}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {conflict.conflictUser.isEmpty
                  ? `检测到该 ${providerLabel} 账号曾创建了一个没有任何内容的空白账号。您可以将其解绑并直接绑定到当前账号，原空白账号将自动注销。`
                  : `检测到该 ${providerLabel} 账号已关联一个已有社区账号。确认后系统将在单个原子事务中把原账号的所有帖子、评论和积分全部合并到当前账号，并将原账号注销。`}
              </p>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resolving}
                  onClick={() => handleResolve("cancel")}
                >
                  取消并返回
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  disabled={resolving}
                  onClick={() => handleResolve("merge")}
                >
                  {resolving ? (
                    <LoaderCircle className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <GitMerge className="mr-1.5 size-3.5" />
                  )}
                  {conflict.conflictUser.isEmpty
                    ? "解绑并关联至当前账号"
                    : "确认合并资产并关联"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-w-40 flex-col items-center gap-3 rounded-md border bg-background px-6 py-5 text-sm text-muted-foreground shadow-lg">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
              <span>
                {callback
                  ? t(callback.loadingKey)
                  : t("user.signin.missingAuthParams")}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
