"use client"

import * as React from "react"

import { saveProfileAction, type UserActionState } from "@/lib/actions/user"
import { AvatarEdit } from "@/components/user/image-upload"
import { Signature } from "@/components/common/signature"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAppState, useAppConfig } from "@/components/app/app-provider"
import { useRequiredUser } from "@/components/auth/require-user"
import { apiFetch, toFormData } from "@/lib/api/client"
import type { UserSummary } from "@/lib/api/types"
import { useI18n } from "@/lib/i18n/provider"
import { toast } from "@/lib/toast"

const initialState: UserActionState = { ok: false }

export function ProfileForm({ user: initialUser }: { user?: UserSummary }) {
  const { t } = useI18n()
  const requiredUser = useRequiredUser()
  const { setCurrentUser } = useAppState()
  const config = useAppConfig()
  const user = initialUser || requiredUser
  const signatureMinLevel = config?.signatureMinLevel ?? 3
  const canEditSignature = (user.level || 0) >= signatureMinLevel
  const [avatar, setAvatar] = React.useState(user.avatar || "")
  const [profile, setProfile] = React.useState({
    nickname: user.nickname || "",
    description: user.description || "",
    homePage: user.homePage || "",
    signature: (user as unknown as { signature?: string }).signature || "",
  })
  const [state, action, pending] = React.useActionState(
    saveProfileAction,
    initialState
  )
  // 签名实时预览：走后端同一套消毒策略（POST /api/user/signature/preview），
  // 前端不自行解析 Markdown，避免预览与最终渲染不一致或绕过 XSS 防护。
  const [previewHtml, setPreviewHtml] = React.useState("")
  const [previewError, setPreviewError] = React.useState("")

  React.useEffect(() => {
    const markdown = profile.signature.trim()
    if (!canEditSignature || !markdown) {
      setPreviewHtml("")
      setPreviewError("")
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      apiFetch<{ html: string }>("/api/user/signature/preview", {
        method: "POST",
        body: toFormData({ signature: markdown }),
      })
        .then((result) => {
          if (!cancelled) {
            setPreviewHtml(result?.html || "")
            setPreviewError("")
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setPreviewHtml("")
            setPreviewError(
              error instanceof Error
                ? error.message
                : t("user.profile.signaturePreviewFailed")
            )
          }
        })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [canEditSignature, profile.signature, t])

  React.useEffect(() => {
    setAvatar(user.avatar || "")
    setProfile({
      nickname: user.nickname || "",
      description: user.description || "",
      homePage: user.homePage || "",
      signature:
        (user as unknown as { signature?: string }).signature || "",
    })
  }, [
    user.avatar,
    user.description,
    (user as unknown as { signature?: string }).signature,
    user.homePage,
    user.id,
    user.nickname,
  ])

  React.useEffect(() => {
    if (state.ok) {
      if (state.profile) {
        setAvatar(state.profile.avatar)
        setProfile({
          nickname: state.profile.nickname,
          description: state.profile.description,
          homePage: state.profile.homePage,
          signature: (state.profile as unknown as { signature?: string })
            .signature || "",
        })
        setCurrentUser((current) =>
          current ? { ...current, ...state.profile } : current
        )
        void apiFetch<UserSummary | null>("/api/user/current")
          .then((nextUser) => {
            if (nextUser) {
              setCurrentUser(nextUser)
            }
          })
          .catch(() => {
            // The optimistic profile update above already keeps the form fresh.
          })
      }
      toast.success(t("user.profile.editSuccess"))
    } else if (state.message) {
      toast.error(`${t("user.profile.editFailed")}：${state.message}`)
    }
  }, [setCurrentUser, state, t])

  function updateProfile(next: Partial<typeof profile>) {
    setProfile((current) => ({ ...current, ...next }))
  }

  return (
    <form action={action} className="m-4 space-y-6">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="avatar" value={avatar} />
      <div className="space-y-2">
        <Label>{t("user.profile.avatar")}</Label>
        <AvatarEdit value={avatar} onChange={setAvatar} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nickname">{t("user.profile.nickname")}</Label>
        <Input
          id="nickname"
          name="nickname"
          value={profile.nickname}
          onChange={(event) =>
            updateProfile({ nickname: event.currentTarget.value })
          }
          autoComplete="off"
          placeholder={t("user.profile.nicknamePlaceholder")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">{t("user.profile.brief")}</Label>
        <Textarea
          id="description"
          name="description"
          value={profile.description}
          onChange={(event) =>
            updateProfile({ description: event.currentTarget.value })
          }
          rows={3}
          placeholder={t("user.profile.briefPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">
          {t("user.profile.briefHelp")}
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="signature">{t("user.profile.signature")}</Label>
          <span className="text-xs text-muted-foreground">
            {canEditSignature
              ? t("user.profile.signatureHelp", { level: signatureMinLevel })
              : t("user.profile.signatureLocked", {
                  level: signatureMinLevel,
                  current: user.level || 0,
                })}
          </span>
        </div>
        <Textarea
          id="signature"
          name="signature"
          value={profile.signature}
          onChange={(event) =>
            updateProfile({ signature: event.currentTarget.value })
          }
          rows={3}
          maxLength={200}
          disabled={!canEditSignature}
          placeholder={
            canEditSignature
              ? t("user.profile.signaturePlaceholderMarkdown")
              : t("user.profile.signatureLockedPlaceholder", {
                  level: signatureMinLevel,
                })
          }
          className={!canEditSignature ? "opacity-60" : ""}
        />
        <p className="text-xs text-muted-foreground">
          {canEditSignature
            ? `${t("user.profile.signatureTip")} · ${profile.signature.length}/200`
            : t("user.profile.signatureLockedTip", { level: signatureMinLevel })}
        </p>
        {canEditSignature ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t("user.profile.signaturePreview")}
            </p>
            {previewHtml ? (
              <Signature html={previewHtml} className="mt-0" />
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("user.profile.signaturePreviewHelp")}
              </p>
            )}
            {previewError ? (
              <p className="mt-1 text-xs text-destructive">{previewError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="homePage">{t("user.profile.homepage")}</Label>
        <Input
          id="homePage"
          name="homePage"
          value={profile.homePage}
          onChange={(event) =>
            updateProfile({ homePage: event.currentTarget.value })
          }
          autoComplete="off"
          placeholder={t("user.profile.homepagePlaceholder")}
        />
      </div>
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={pending}>
          {t("user.profile.save")}
        </Button>
      </div>
    </form>
  )
}
