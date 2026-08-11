"use client"

import * as React from "react"
import {
  CopyIcon,
  KeyRoundIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { useCurrentUser } from "@/components/app/app-provider"
import {
  ConfirmDialog,
  type ConfirmDialogState,
} from "@/components/common/confirm-dialog"
import { ErrorPage } from "@/components/common/error-page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import {
  adminGet,
  adminPostForm,
  adminPostJson,
  type AdminPageResult,
  type AdminRecord,
} from "@/lib/api/admin"
import { normalizeAdminPageResult } from "@/lib/api/admin-page-result"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"
import { userHasPermission } from "@/lib/auth/roles"
import { useI18n } from "@/lib/i18n/provider"
import { msgError, msgSuccess } from "@/lib/toast"
import { cn } from "@/lib/utils"

type AgentTokenRecord = AdminRecord & {
  id?: number | string
  name?: string
  remark?: string
  creatorNickname?: string
  apiCount?: number
  status?: number
  expiredAt?: number
  lastUsedAt?: number
  createTime?: number
}

type AgentCapabilityRecord = AdminRecord & {
  method?: string
  path?: string
  nameZh?: string
  nameEn?: string
  permissionCodes?: string[]
  granted?: boolean
}

const PAGE_SIZE = 20

function formatTime(ts?: number) {
  if (!ts || ts <= 0) return "-"
  return new Date(ts).toLocaleString()
}

function isActive(record: AgentTokenRecord) {
  return Number(record.status) === 0
}

export default function DashboardAgentTokensRoute() {
  const { t } = useI18n()
  const currentUser = useCurrentUser()

  const [records, setRecords] = React.useState<AgentTokenRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [newToken, setNewToken] = React.useState<string | null>(null)

  const [editing, setEditing] = React.useState<AgentTokenRecord | null>(null)
  const [capabilities, setCapabilities] = React.useState<
    AgentCapabilityRecord[]
  >([])
  const [grantedKeys, setGrantedKeys] = React.useState<Set<string>>(new Set())
  const [capsLoading, setCapsLoading] = React.useState(false)

  const [confirmState, setConfirmState] = React.useState<ConfirmDialogState>(null)

  const canView = userHasPermission(
    currentUser,
    PERMISSIONS.DASHBOARD_AGENT_TOKEN_VIEW
  )
  const canCreate = userHasPermission(
    currentUser,
    PERMISSIONS.DASHBOARD_AGENT_TOKEN_CREATE
  )
  const canUpdate = userHasPermission(
    currentUser,
    PERMISSIONS.DASHBOARD_AGENT_TOKEN_UPDATE
  )
  const canDelete = userHasPermission(
    currentUser,
    PERMISSIONS.DASHBOARD_AGENT_TOKEN_DELETE
  )

  async function loadList() {
    setLoading(true)
    try {
      const data = await adminPostForm<AdminPageResult<AgentTokenRecord> | null>(
        "/api/admin/agent-token/list",
        { page, limit: PAGE_SIZE }
      )
      const result = normalizeAdminPageResult(data)
      setRecords(result.results)
      setTotal(result.page?.total ?? 0)
    } catch (err) {
      msgError(err instanceof Error ? err.message : "load failed")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (canView) {
      void loadList()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, page])

  async function openEdit(token: AgentTokenRecord) {
    setEditing(token)
    setCapsLoading(true)
    setGrantedKeys(new Set())
    try {
      const caps = await adminGet<AgentCapabilityRecord[]>(
        `/api/admin/agent-token/capabilities?tokenId=${token.id}`
      )
      setCapabilities(caps ?? [])
      setGrantedKeys(
        new Set(
          (caps ?? [])
            .filter((c) => c.granted)
            .map((c) => `${c.method} ${c.path}`)
        )
      )
    } catch (err) {
      msgError(err instanceof Error ? err.message : "load failed")
    } finally {
      setCapsLoading(false)
    }
  }

  function toggleGrant(method: string | undefined, path: string | undefined) {
    if (!method || !path) return
    const key = `${method} ${path}`
    setGrantedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  async function saveGrants() {
    if (!editing) return
    const apis = Array.from(grantedKeys)
      .map((key) => {
        const [method, ...rest] = key.split(" ")
        return { method, path: rest.join(" ") }
      })
      .filter((item) => item.method && item.path)
    try {
      await adminPostJson("/api/admin/agent-token/grant", {
        id: editing.id,
        apis,
      })
      msgSuccess(t("dashboard.agentTokens.grantSaved"))
      await loadList()
    } catch (err) {
      msgError(err instanceof Error ? err.message : "save failed")
    }
  }

  async function updateStatus(record: AgentTokenRecord, status: number) {
    try {
      await adminPostJson("/api/admin/agent-token/update", {
        id: record.id,
        name: record.name ?? "",
        remark: record.remark ?? "",
        expiredAt: record.expiredAt ?? 0,
        status,
      })
      msgSuccess(t("dashboard.messages.actionDone"))
      await loadList()
    } catch (err) {
      msgError(err instanceof Error ? err.message : "update failed")
    }
  }

  async function removeToken(record: AgentTokenRecord) {
    try {
      await adminPostForm("/api/admin/agent-token/delete", { id: record.id })
      msgSuccess(t("dashboard.messages.deleted"))
      await loadList()
    } catch (err) {
      msgError(err instanceof Error ? err.message : "delete failed")
    }
  }

  async function handleCreate(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<boolean> {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    const remark = String(form.get("remark") ?? "").trim()
    const expiresValue = String(form.get("expiredAt") ?? "").trim()
    const expiredAt = expiresValue ? new Date(expiresValue).getTime() : 0

    if (!name) {
      msgError(t("dashboard.agentTokens.nameRequired"))
      return false
    }
    if (expiredAt && expiredAt < Date.now()) {
      msgError(t("dashboard.agentTokens.expiredAtInPast"))
      return false
    }
    try {
      const data = await adminPostJson<{ id: number; token: string }>(
        "/api/admin/agent-token/create",
        { name, remark, expiredAt }
      )
      setNewToken(data.token)
      await loadList()
      return true
    } catch (err) {
      msgError(err instanceof Error ? err.message : "create failed")
      return false
    }
  }

  if (!canView) {
    return <ErrorPage statusCode={403} />
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            {t("dashboard.pages.agentTokens.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.pages.agentTokens.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadList()}
            disabled={loading}
          >
            <RefreshCwIcon />
            {t("dashboard.actions.refresh")}
          </Button>
          {canCreate ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              {t("dashboard.agentTokens.create")}
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("dashboard.loading")}
            </div>
          ) : records.length === 0 ? (
            <div className="p-8">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>
                    {t("dashboard.pages.agentTokens.title")}
                  </EmptyTitle>
                  <EmptyDescription>
                    {t("dashboard.agentTokens.empty")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">{t("dashboard.agentTokens.name")}</th>
                    <th className="px-4 py-3 font-medium">{t("dashboard.agentTokens.creator")}</th>
                    <th className="px-4 py-3 font-medium">{t("dashboard.agentTokens.apiCount")}</th>
                    <th className="px-4 py-3 font-medium">{t("dashboard.agentTokens.status")}</th>
                    <th className="px-4 py-3 font-medium">{t("dashboard.agentTokens.lastUsedAt")}</th>
                    <th className="px-4 py-3 font-medium">{t("dashboard.agentTokens.createTime")}</th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t("dashboard.agentTokens.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const active = isActive(record)
                    return (
                      <tr
                        key={String(record.id)}
                        className="border-b last:border-0 hover:bg-muted/50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{record.name}</div>
                          {record.remark ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {record.remark}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {record.creatorNickname || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <ShieldCheckIcon className="size-3" />
                            {record.apiCount ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                              active
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {active
                              ? t("dashboard.agentTokens.statusActive")
                              : t("dashboard.agentTokens.statusRevoked")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatTime(record.lastUsedAt)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatTime(record.createTime)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canUpdate ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void openEdit(record)}
                              >
                                <KeyRoundIcon />
                                {t("dashboard.agentTokens.grant")}
                              </Button>
                            ) : null}
                            {active ? (
                              canUpdate ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmState({
                                      description: t(
                                        "dashboard.agentTokens.revokeConfirm"
                                      ),
                                      onConfirm: () =>
                                        void updateStatus(record, 1),
                                    })
                                  }
                                >
                                  <XIcon />
                                  {t("dashboard.agentTokens.revoke")}
                                </Button>
                              ) : null
                            ) : null}
                            {canDelete ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                  setConfirmState({
                                    description: t(
                                      "dashboard.agentTokens.deleteConfirm"
                                    ),
                                    onConfirm: () => void removeToken(record),
                                  })
                                }
                              >
                                <Trash2Icon />
                                {t("dashboard.agentTokens.delete")}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {total > 0 ? (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
              <span>{t("dashboard.pagination.total", { total })}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("dashboard.pagination.previous")}
                </Button>
                <span>
                  {page} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("dashboard.pagination.next")}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 创建令牌 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.agentTokens.create")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              void handleCreate(e).then((ok) => {
                if (ok) setCreateOpen(false)
              })
            }}
            className="space-y-4"
          >
            <FieldGroup>
              <Field>
                <FieldLabel>{t("dashboard.agentTokens.name")}</FieldLabel>
                <Input
                  name="name"
                  placeholder={t("dashboard.agentTokens.namePlaceholder")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>{t("dashboard.agentTokens.remark")}</FieldLabel>
                <Textarea
                  name="remark"
                  placeholder={t("dashboard.agentTokens.remarkPlaceholder")}
                  rows={2}
                />
              </Field>
              <Field>
                <FieldLabel>{t("dashboard.agentTokens.expiresAt")}</FieldLabel>
                <Input
                  name="expiredAt"
                  type="datetime-local"
                  placeholder={t("dashboard.agentTokens.expiresAtPlaceholder")}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit">{t("dashboard.agentTokens.create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 令牌明文一次性展示 */}
      <Dialog open={newToken !== null} onOpenChange={() => setNewToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.agentTokens.tokenCreated")}</DialogTitle>
            <DialogDescription>
              {t("dashboard.agentTokens.tokenValue")}
            </DialogDescription>
          </DialogHeader>
          {newToken ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm">
                {newToken}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(newToken)
                  msgSuccess(t("dashboard.agentTokens.copied"))
                }}
              >
                <CopyIcon />
                {t("dashboard.agentTokens.copyToken")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 编辑 + 能力授权 */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.name} - {t("dashboard.agentTokens.grant")}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.agentTokens.capabilitiesHint")}
            </DialogDescription>
          </DialogHeader>
          {capsLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("dashboard.loading")}
            </div>
          ) : (
            <>
              <ScrollArea className="max-h-80 rounded-md border">
                {capabilities.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {t("dashboard.agentTokens.noCapabilities")}
                  </div>
                ) : (
                  <div className="divide-y">
                    {capabilities.map((cap) => {
                      const key = `${cap.method} ${cap.path}`
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={grantedKeys.has(key)}
                            onCheckedChange={() =>
                              toggleGrant(cap.method, cap.path)
                            }
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                {cap.method}
                              </span>
                              <code className="truncate text-sm">
                                {cap.path}
                              </code>
                            </div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {cap.nameZh || cap.nameEn || "-"}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={!canUpdate}
                  onClick={() => void saveGrants()}
                >
                  {t("dashboard.agentTokens.saveGrant")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog state={confirmState} onOpenChange={() => setConfirmState(null)} />
    </div>
  )
}
