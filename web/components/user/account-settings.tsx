"use client"

import * as React from "react"
import { useRouter } from "@/lib/router/navigation"
import { useActionState } from "react"

import {
  requestEmailVerifyAction,
  setEmailAction,
  setPasswordAction,
  setUsernameAction,
  unbindProviderAction,
  updatePasswordAction,
  type UserActionState,
} from "@/lib/actions/user"
import { useRequiredUser } from "@/components/auth/require-user"
import {
  ConfirmDialog,
  type ConfirmDialogState,
} from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "@/components/common/link"
import { ExternalLink, Eye, GitPullRequest, LayoutList, Star } from "lucide-react"
import { apiFetch } from "@/lib/api/client"
import type { BindInfo, SiteConfig, SpaceModulesConfig, UserSummary } from "@/lib/api/types"
import type { TFunction } from "@/lib/i18n"
import { useI18n } from "@/lib/i18n/provider"
import { toast } from "@/lib/toast"

const initialState: UserActionState = { ok: false }

type DialogKey = "username" | "email" | "setPassword" | "updatePassword" | null
type BindDialogKey = "wx" | "google" | "github" | null
type BindProvider = "wx" | "google" | "github"

function getBindInfo(provider: BindProvider) {
  const path =
    provider === "wx"
      ? "/api/user/wx_bind_info"
      : provider === "google"
        ? "/api/user/google_bind_info"
        : "/api/user/github_bind_info"
  return apiFetch<BindInfo>(path)
}

export function AccountSettings({
  user: initialUser,
  config,
  bindInfo,
}: {
  user?: UserSummary
  config: SiteConfig | null
  bindInfo: { wx?: BindInfo; google?: BindInfo; github?: BindInfo }
}) {
  const { t } = useI18n()
  const requiredUser = useRequiredUser()
  const user = initialUser || requiredUser
  const router = useRouter()
  const [dialog, setDialog] = React.useState<DialogKey>(null)
  const [bindDialog, setBindDialog] = React.useState<BindDialogKey>(null)
  const [currentBindInfo, setCurrentBindInfo] = React.useState(bindInfo)
  const [confirmState, setConfirmState] =
    React.useState<ConfirmDialogState>(null)
  const [syncingGithub, setSyncingGithub] = React.useState(false)

  const handleSyncGithub = async () => {
    setSyncingGithub(true)
    try {
      await apiFetch("/api/user/sync_github_profile", { method: "POST" })
      toast.success("GitHub 开发者开源画像已同步更新！")
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message || "同步失败，请重试")
    } finally {
      setSyncingGithub(false)
    }
  }

  // 个人空间模块展示配置
  const [spaceConfig, setSpaceConfig] = React.useState<SpaceModulesConfig>(
    user.spaceModulesConfig || {
      github: true,
      counts: true,
      badges: true,
      profile: true,
      fans: true,
      followed: true,
    }
  )
  const [savingConfig, setSavingConfig] = React.useState(false)

  // GitHub 合并 PR 候选集与自主选定代表作
  const mergedPrs = user.githubProfile?.mergedPrs || []
  const [selectedPr, setSelectedPr] = React.useState<string>(
    user.githubProfile?.selectedPrUrl || (mergedPrs[0]?.prUrl ?? "")
  )
  const [savingPr, setSavingPr] = React.useState(false)

  const handleToggleModule = async (key: keyof SpaceModulesConfig, value: boolean) => {
    const next = { ...spaceConfig, [key]: value }
    setSpaceConfig(next)
    setSavingConfig(true)
    try {
      await apiFetch("/api/user/space_modules_config", {
        method: "POST",
        body: JSON.stringify(next),
      })
      toast.success("个人主页模块展示配置已更新！")
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message || "更新主页配置失败")
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSelectPr = async (prUrl: string) => {
    setSelectedPr(prUrl)
    setSavingPr(true)
    try {
      await apiFetch("/api/user/select_github_pr", {
        method: "POST",
        body: JSON.stringify({ prUrl }),
      })
      toast.success("已更新主页代表作展示 PR！")
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message || "选择代表作 PR 失败")
    } finally {
      setSavingPr(false)
    }
  }

  React.useEffect(() => {
    const providers: BindProvider[] = []
    if (config?.loginConfig?.weixinLogin?.enabled && !currentBindInfo.wx) {
      providers.push("wx")
    }
    if (config?.loginConfig?.googleLogin?.enabled && !currentBindInfo.google) {
      providers.push("google")
    }
    if (config?.loginConfig?.githubLogin?.enabled && !currentBindInfo.github) {
      providers.push("github")
    }
    if (!providers.length) return

    let active = true
    void Promise.all(
      providers.map(async (provider) => {
        const info = await getBindInfo(provider).catch(() => undefined)
        return [provider, info] as const
      })
    ).then((entries) => {
      if (!active) return
      setCurrentBindInfo((current) => {
        const next = { ...current }
        for (const [provider, info] of entries) {
          if (info) next[provider] = info
        }
        return next
      })
    })

    return () => {
      active = false
    }
  }, [
    config?.loginConfig?.githubLogin?.enabled,
    config?.loginConfig?.googleLogin?.enabled,
    config?.loginConfig?.weixinLogin?.enabled,
    currentBindInfo.github,
    currentBindInfo.google,
    currentBindInfo.wx,
  ])

  async function requestVerify() {
    const result = await requestEmailVerifyAction()
    if (result.ok) {
      toast.success(
        t("user.profile.account.emailVerifySuccess", {
          email: user.email || "",
        })
      )
    } else {
      toast.error(result.message || t("composables.unknownError"))
    }
  }

  async function unbind(provider: "wx" | "google" | "github") {
    const result = await unbindProviderAction(provider)
    if (result.ok) {
      setCurrentBindInfo((current) => ({
        ...current,
        [provider]: { bind: false },
      }))
      toast.success(t("user.profile.account.unbindSuccess"))
      router.refresh()
    } else {
      toast.error(
        `${t("user.profile.account.unbindFailed")}：${result.message || t("composables.unknownError")}`
      )
    }
  }

  function confirmUnbind(provider: "wx" | "google" | "github") {
    setConfirmState({
      description: t("user.profile.account.confirmUnbind"),
      confirmText: t("user.profile.account.unbind"),
      onConfirm: () => {
        void unbind(provider)
      },
    })
  }

  return (
    <>
      <div className="settings m-4">
        <SettingsItem
          title={t("user.profile.account.username")}
          value={user.username || ""}
        >
          {!user.username ? (
            <button type="button" onClick={() => setDialog("username")}>
              {t("user.profile.account.set")}
            </button>
          ) : null}
        </SettingsItem>
        <SettingsItem
          title={t("user.profile.account.email")}
          value={
            <>
              <span>{user.email}</span>
              {user.emailVerified ? (
                <span className="ml-1 text-[80%]">
                  ({t("user.profile.account.verified")})
                </span>
              ) : null}
            </>
          }
        >
          {user.email ? (
            <button type="button" onClick={() => setDialog("email")}>
              {t("user.profile.account.modify")}
            </button>
          ) : null}
          {user.email && !user.emailVerified ? (
            <button type="button" onClick={requestVerify}>
              {t("user.profile.account.verify")}
            </button>
          ) : null}
          {!user.email ? (
            <button type="button" onClick={() => setDialog("email")}>
              {t("user.profile.account.set")}
            </button>
          ) : null}
        </SettingsItem>
        <SettingsItem
          title={t("user.profile.account.password")}
          value={
            user.passwordSet
              ? t("user.profile.account.passwordSet")
              : t("user.profile.account.passwordNotSet")
          }
        >
          {user.passwordSet ? (
            <button type="button" onClick={() => setDialog("updatePassword")}>
              {t("user.profile.account.modify")}
            </button>
          ) : (
            <button type="button" onClick={() => setDialog("setPassword")}>
              {t("user.profile.account.set")}
            </button>
          )}
        </SettingsItem>
        {config?.loginConfig?.weixinLogin?.enabled ? (
          <BindItem
            title={t("user.profile.account.wechat")}
            value={
              currentBindInfo.wx?.bind
                ? currentBindInfo.wx.nickname
                : t("user.profile.account.wechatNotBound")
            }
            bound={currentBindInfo.wx?.bind}
            onBind={() => setBindDialog("wx")}
            onUnbind={() => confirmUnbind("wx")}
            bindText={t("user.profile.account.bind")}
            unbindText={t("user.profile.account.unbind")}
          />
        ) : null}
        {config?.loginConfig?.googleLogin?.enabled ? (
          <BindItem
            title={t("user.profile.account.google")}
            value={
              currentBindInfo.google?.bind
                ? currentBindInfo.google.nickname
                : t("user.profile.account.googleNotBound")
            }
            bound={currentBindInfo.google?.bind}
            onBind={() => setBindDialog("google")}
            onUnbind={() => confirmUnbind("google")}
            bindText={t("user.profile.account.bind")}
            unbindText={t("user.profile.account.unbind")}
          />
        ) : null}
        {config?.loginConfig?.githubLogin?.enabled ? (
          <BindItem
            title={t("user.profile.account.github")}
            value={
              currentBindInfo.github?.bind
                ? currentBindInfo.github.nickname
                : t("user.profile.account.githubNotBound")
            }
            bound={currentBindInfo.github?.bind}
            onBind={() => setBindDialog("github")}
            onUnbind={() => confirmUnbind("github")}
            bindText={t("user.profile.account.bind")}
            unbindText={t("user.profile.account.unbind")}
            extraAction={
              currentBindInfo.github?.bind ? (
                <button
                  type="button"
                  disabled={syncingGithub}
                  onClick={handleSyncGithub}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {syncingGithub ? "同步中..." : "同步画像"}
                </button>
              ) : null
            }
          />
        ) : null}

        {/* GitHub 合并 PR 代表作展台（仅当有合格 PR 候选时展示） */}
        {mergedPrs.length > 0 ? (
          <div className="mt-8 border-t border-border pt-6">
            <div className="mb-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <GitPullRequest className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>GitHub 合并 PR 代表作展台</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                您向顶级开源项目贡献了已合并的合格 PR。请选择要在个人主页开源画像中置顶展示的代表作：
              </p>
            </div>
            <div className="space-y-2.5">
              {mergedPrs.map((pr) => {
                const isChecked = (selectedPr || mergedPrs[0]?.prUrl) === pr.prUrl
                return (
                  <div
                    key={pr.prUrl}
                    onClick={() => !savingPr && handleSelectPr(pr.prUrl)}
                    className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 transition-colors ${
                      isChecked
                        ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/70 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="selected_pr"
                        checked={isChecked}
                        disabled={savingPr}
                        onChange={() => {}}
                        className="mt-0.5 text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {pr.repoFullName}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            <span>{pr.stars?.toLocaleString()}</span>
                          </span>
                          {isChecked ? (
                            <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                              当前代表作
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          #{pr.prTitle}
                        </p>
                      </div>
                    </div>
                    <a
                      href={pr.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                      title="在 GitHub 查看该 PR"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* 个人主页模块展示可见性配置（与视角切换深度联动） */}
        <div className="mt-8 border-t border-border pt-6">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <LayoutList className="h-4 w-4 text-primary" />
                <span>个人空间主页模块展示（公开与隐私）</span>
              </div>
              <Link
                href={`/user/${user.id}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>前往主页体验【视角切换】</span>
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              配置个人空间主页各模块的公开可见性。关闭的模块对访客彻底隐藏；您可在个人主页切换【访客视角】预览真实效果。
            </p>
          </div>

          <div className="divide-y divide-border/60 rounded-lg border border-border/80 bg-card">
            <div className="flex items-center justify-between p-3.5">
              <div>
                <div className="text-sm font-medium text-foreground">开源开发者画像</div>
                <div className="text-xs text-muted-foreground">
                  公开展示绑定的 GitHub 开发者画像、开源成就勋章与代表作
                </div>
              </div>
              <Switch
                checked={spaceConfig.github !== false}
                disabled={savingConfig}
                onCheckedChange={(val) => handleToggleModule("github", val)}
              />
            </div>

            <div className="flex items-center justify-between p-3.5">
              <div>
                <div className="text-sm font-medium text-foreground">数据统计卡片</div>
                <div className="text-xs text-muted-foreground">
                  公开展示您的等级、社区积分、发布的话题与跟帖统计
                </div>
              </div>
              <Switch
                checked={spaceConfig.counts !== false}
                disabled={savingConfig}
                onCheckedChange={(val) => handleToggleModule("counts", val)}
              />
            </div>

            <div className="flex items-center justify-between p-3.5">
              <div>
                <div className="text-sm font-medium text-foreground">成就勋章墙</div>
                <div className="text-xs text-muted-foreground">
                  公开展示您在社区解锁并获得的各类荣誉勋章
                </div>
              </div>
              <Switch
                checked={spaceConfig.badges !== false}
                disabled={savingConfig}
                onCheckedChange={(val) => handleToggleModule("badges", val)}
              />
            </div>

            <div className="flex items-center justify-between p-3.5">
              <div>
                <div className="text-sm font-medium text-foreground">个人简介与主页资料</div>
                <div className="text-xs text-muted-foreground">
                  公开展示昵称、个人签名描述与填写的外部个人主页链接
                </div>
              </div>
              <Switch
                checked={spaceConfig.profile !== false}
                disabled={savingConfig}
                onCheckedChange={(val) => handleToggleModule("profile", val)}
              />
            </div>

            <div className="flex items-center justify-between p-3.5">
              <div>
                <div className="text-sm font-medium text-foreground">粉丝列表</div>
                <div className="text-xs text-muted-foreground">
                  公开侧边栏关注我的粉丝头像列表与跳转
                </div>
              </div>
              <Switch
                checked={spaceConfig.fans !== false}
                disabled={savingConfig}
                onCheckedChange={(val) => handleToggleModule("fans", val)}
              />
            </div>

            <div className="flex items-center justify-between p-3.5">
              <div>
                <div className="text-sm font-medium text-foreground">关注列表</div>
                <div className="text-xs text-muted-foreground">
                  公开侧边栏我关注的用户头像列表与跳转
                </div>
              </div>
              <Switch
                checked={spaceConfig.followed !== false}
                disabled={savingConfig}
                onCheckedChange={(val) => handleToggleModule("followed", val)}
              />
            </div>
          </div>
        </div>
      </div>
      {dialog ? (
        <AccountDialog
          dialog={dialog}
          user={user}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {bindDialog ? (
        <ProviderBindDialog
          provider={bindDialog}
          onClose={() => setBindDialog(null)}
        />
      ) : null}
      <ConfirmDialog
        state={confirmState}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null)
        }}
      />
    </>
  )
}

function SettingsItem({
  title,
  value,
  children,
}: {
  title: string
  value: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="settings-item">
      <div className="settings-item-title">{title}</div>
      <div className="settings-item-input">
        <div className="input-value">{value}</div>
        <div className="action-box">{children}</div>
      </div>
    </div>
  )
}

function BindItem({
  title,
  value,
  bound,
  onBind,
  onUnbind,
  bindText,
  unbindText,
  extraAction,
}: {
  title: string
  value?: React.ReactNode
  bound?: boolean
  onBind: () => void
  onUnbind: () => void
  bindText: string
  unbindText: string
  extraAction?: React.ReactNode
}) {
  return (
    <SettingsItem title={title} value={value}>
      <div className="flex items-center gap-3">
        {extraAction}
        {bound ? (
          <button type="button" onClick={onUnbind}>
            {unbindText}
          </button>
        ) : (
          <button type="button" onClick={onBind}>
            {bindText}
          </button>
        )}
      </div>
    </SettingsItem>
  )
}

function ProviderBindDialog({
  provider,
  onClose,
}: {
  provider: Exclude<BindDialogKey, null>
  onClose: () => void
}) {
  const { t } = useI18n()
  const [loading, setLoading] = React.useState(false)
  const wxContainerId = React.useId().replaceAll(":", "")

  React.useEffect(() => {
    if (provider !== "wx") return
    let active = true

    async function initWx() {
      try {
        await loadScript(
          "https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js"
        )
        const config = await apiFetch<{
          appid?: string
          scope?: string
          redirect_uri?: string
          state?: string
        }>("/api/login/wx_login_config", {
          params: { bind: true },
        })
        if (!active || !window.WxLogin) return
        new window.WxLogin({
          self_redirect: false,
          id: `wx_bind_container_${wxContainerId}`,
          appid: config.appid,
          scope: config.scope,
          redirect_uri: config.redirect_uri,
          state: config.state || "",
          stylelite: 1,
        })
      } catch (error) {
        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("composables.unknownError")
          )
        }
      }
    }

    const timer = window.setTimeout(() => void initWx(), 300)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [provider, t, wxContainerId])

  async function bindOAuth() {
    if (provider === "wx") return
    setLoading(true)
    const path =
      provider === "google"
        ? "/api/login/google_login_config"
        : "/api/login/github_login_config"
    try {
      const config = await apiFetch<{ authUrl?: string }>(path, {
        params: { bind: true, redirect: window.location.pathname },
      })
      if (config.authUrl) {
        window.location.href = config.authUrl
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("composables.unknownError")
      )
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div
        className={
          provider === "wx"
            ? "w-[340px] max-w-[340px] rounded-lg bg-background p-5 shadow-lg"
            : "w-[400px] max-w-[400px] rounded-lg bg-background p-5 shadow-lg"
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{bindTitle(provider, t)}</h2>
          <button
            type="button"
            className="text-sm text-muted-foreground"
            onClick={onClose}
          >
            {t("dialog.cancel")}
          </button>
        </div>
        {provider === "wx" ? (
          <div className="px-2 pb-4">
            <div className="mt-4 mb-5 text-center text-sm text-muted-foreground">
              {t("component.wxBindDialog.scanTip")}
            </div>
            <div
              id={`wx_bind_container_${wxContainerId}`}
              className="wx_bind_container"
            />
          </div>
        ) : (
          <div className="px-2 pb-4">
            <div className="mt-4 mb-5 text-center text-sm text-muted-foreground">
              {provider === "google"
                ? t("component.googleBindDialog.bindTip")
                : t("component.githubBindDialog.bindTip")}
            </div>
            <Button
              type="button"
              className="w-full"
              variant="outline"
              disabled={loading}
              onClick={bindOAuth}
            >
              <ProviderIcon provider={provider} loading={loading} />
              <span>
                {loading ? bindLoading(provider, t) : bindButton(provider, t)}
              </span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function AccountDialog({
  dialog,
  user,
  onClose,
}: {
  dialog: Exclude<DialogKey, null>
  user: UserSummary
  onClose: () => void
}) {
  const { t } = useI18n()
  const router = useRouter()
  const action =
    dialog === "username"
      ? setUsernameAction
      : dialog === "email"
        ? setEmailAction
        : dialog === "setPassword"
          ? setPasswordAction
          : updatePasswordAction
  const [state, formAction, pending] = useActionState(action, initialState)

  React.useEffect(() => {
    if (state.ok) {
      toast.success(successText(dialog, t))
      router.refresh()
      onClose()
    } else if (state.message) {
      toast.error(state.message)
    }
  }, [dialog, onClose, router, state, t])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <form
        action={formAction}
        className="w-full max-w-md rounded-lg bg-background p-5 shadow-lg"
      >
        <h2 className="mb-4 text-lg font-semibold">{titleText(dialog, t)}</h2>
        <div
          className={
            dialog === "setPassword" ? "space-y-6 py-4" : "space-y-4 py-4"
          }
        >
          {dialog === "username" ? (
            <>
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-sm text-blue-700">
                  {t("component.setUsernameDialog.usernameRule")}
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Input
                  id="username"
                  name="username"
                  type="text"
                  defaultValue={user.username || ""}
                  placeholder={t(
                    "component.setUsernameDialog.usernamePlaceholder"
                  )}
                />
              </div>
            </>
          ) : null}
          {dialog === "email" ? (
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={user.email || ""}
              placeholder={t("component.setEmailDialog.emailPlaceholder")}
            />
          ) : null}
          {dialog === "setPassword" ? (
            <>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder={t(
                  "component.setPasswordDialog.passwordPlaceholder"
                )}
              />
              <Input
                id="rePassword"
                name="rePassword"
                type="password"
                placeholder={t(
                  "component.setPasswordDialog.rePasswordPlaceholder"
                )}
              />
            </>
          ) : null}
          {dialog === "updatePassword" ? (
            <>
              <Input
                id="oldPassword"
                name="oldPassword"
                type="password"
                placeholder={t(
                  "component.updatePasswordDialog.oldPasswordPlaceholder"
                )}
              />
              <Input
                id="newPassword"
                name="password"
                type="password"
                placeholder={t(
                  "component.updatePasswordDialog.newPasswordPlaceholder"
                )}
              />
              <Input
                id="rePassword"
                name="rePassword"
                type="password"
                placeholder={t(
                  "component.updatePasswordDialog.rePasswordPlaceholder"
                )}
              />
            </>
          ) : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("dialog.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {t("dialog.ok")}
          </Button>
        </div>
      </form>
    </div>
  )
}

function titleText(dialog: Exclude<DialogKey, null>, t: TFunction) {
  if (dialog === "username") return t("component.setUsernameDialog.title")
  if (dialog === "email") return t("component.setEmailDialog.title")
  if (dialog === "setPassword") return t("component.setPasswordDialog.title")
  return t("component.updatePasswordDialog.title")
}

function successText(dialog: Exclude<DialogKey, null>, t: TFunction) {
  if (dialog === "username") return t("component.setUsernameDialog.success")
  if (dialog === "email") return t("component.setEmailDialog.success")
  if (dialog === "setPassword") return t("component.setPasswordDialog.success")
  return t("component.updatePasswordDialog.success")
}

function bindTitle(provider: Exclude<BindDialogKey, null>, t: TFunction) {
  if (provider === "wx") return t("component.wxBindDialog.title")
  if (provider === "google") return t("component.googleBindDialog.title")
  return t("component.githubBindDialog.title")
}

function bindLoading(provider: Exclude<BindDialogKey, null>, t: TFunction) {
  if (provider === "google") return t("component.googleBindDialog.binding")
  return t("component.githubBindDialog.binding")
}

function bindButton(provider: Exclude<BindDialogKey, null>, t: TFunction) {
  if (provider === "google") return t("component.googleBindDialog.bindButton")
  return t("component.githubBindDialog.bindButton")
}

function ProviderIcon({
  provider,
  loading,
}: {
  provider: "google" | "github"
  loading: boolean
}) {
  if (loading) return null
  if (provider === "github") {
    return (
      <svg
        className="mr-2 h-5 w-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12c0 4.636 3.007 8.566 7.18 9.955.525.098.72-.228.72-.507 0-.25-.01-1.077-.014-1.953-2.92.635-3.536-1.236-3.536-1.236-.477-1.211-1.165-1.534-1.165-1.534-.952-.651.072-.638.072-.638 1.053.074 1.607 1.08 1.607 1.08.936 1.603 2.455 1.14 3.053.872.094-.678.366-1.14.666-1.402-2.33-.265-4.78-1.165-4.78-5.185 0-1.145.41-2.08 1.08-2.815-.108-.265-.468-1.332.103-2.777 0 0 .88-.282 2.88 1.075.835-.232 1.73-.348 2.62-.352.89.004 1.785.12 2.62.352 2-1.357 2.88-1.075 2.88-1.075.571 1.445.211 2.512.103 2.777.67.735 1.08 1.67 1.08 2.815 0 4.03-2.455 4.917-4.79 5.177.376.323.712.96.712 1.935 0 1.397-.013 2.522-.013 2.866 0 .281.19.61.725.507C19.494 20.562 22.5 16.635 22.5 12c0-5.799-4.701-10.5-10.5-10.5z"
        />
      </svg>
    )
  }
  return (
    <svg
      className="mr-2 h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function loadScript(src: string) {
  const existing = document.querySelector(`script[src="${src}"]`)
  if (existing) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load sign-in script"))
    document.head.appendChild(script)
  })
}

declare global {
  interface Window {
    WxLogin?: new (options: Record<string, unknown>) => unknown
  }
}
