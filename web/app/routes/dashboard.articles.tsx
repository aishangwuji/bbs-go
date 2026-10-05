"use client"

import * as React from "react"
import {
  ClipboardCheckIcon,
  EyeIcon,
  MessageCircleIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react"

import {
  DashboardDataFeedList,
  DashboardDataPage,
  type DashboardDataPageConfig,
} from "@/components/dashboard/data"
import * as dashboardData from "@/components/dashboard/data/dashboard-data-route-utils"
import { useCurrentUser } from "@/components/app/app-provider"
import { PreviewableImage } from "@/components/common/image-preview"
import { Button } from "@/components/ui/button"
import type { AdminRecord } from "@/lib/api/admin"
import type { ImageInfo } from "@/lib/api/types"
import { userHasPermission } from "@/lib/auth/roles"
import { formatDateTime } from "@/lib/format"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"

type ArticleRecord = AdminRecord & {
  id?: number
  title?: string
  summary?: string
  status?: number
  createTime?: number
  viewCount?: number
  commentCount?: number
  cover?: ImageInfo | string | null
  user?: {
    id?: number
    idEncode?: string
    nickname?: string
    username?: string
    avatar?: string
  }
  tags?: Array<{
    id?: number
    name?: string
  }>
}

type ArticleAction = "audit" | "delete" | "undelete"

function articleStatusLabel(
  t: ReturnType<typeof useI18n>["t"],
  status?: number
) {
  if (status === 1) return t("dashboard.topicFeed.statusDeleted")
  if (status === 2) return t("dashboard.topicFeed.statusReview")
  return t("dashboard.topicFeed.statusNormal")
}


function compactText(value: unknown) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim()
}

function imageSrc(image: ImageInfo | string | null | undefined) {
  if (typeof image === "string") return image
  return image?.preview || image?.url || ""
}

export default function DashboardArticlesRoute() {
  const { t } = useI18n()
  const currentUser = useCurrentUser()
  const canAudit = userHasPermission(currentUser, PERMISSIONS.DASHBOARD_ARTICLE_AUDIT)
  const canDelete = userHasPermission(currentUser, PERMISSIONS.DASHBOARD_ARTICLE_DELETE)

  const config: DashboardDataPageConfig = {
    title: dashboardData.title(t, "articles"),
    description: dashboardData.desc(t, "articles"),
    listEndpoint: "/api/admin/article/list",
    viewPermission: PERMISSIONS.DASHBOARD_ARTICLE_VIEW,
    pageSize: 20,
    filters: [
      { name: "id", label: dashboardData.label(t, "id") },
      { name: "userId", label: dashboardData.label(t, "userId") },
      { name: "title", label: dashboardData.label(t, "title") },
      {
        name: "status",
        label: dashboardData.label(t, "status"),
        type: "select",
        options: dashboardData.topicStatusOptionsFor(t),
      },
    ],
    toolbarExtraActions: ({ filters, updateFilter }) => (
      <Button
        variant={filters.status === 2 ? "default" : "outline"}
        size="sm"
        onClick={() =>
          updateFilter("status", filters.status === 2 ? undefined : 2)
        }
        title={t("dashboard.actions.pendingReviewTooltip")}
      >
        <ClipboardCheckIcon />
        {t("dashboard.actions.pendingReview")}
      </Button>
    ),
    rowActions: [
      {
        label: t("dashboard.actions.audit"),
        endpoint: "/api/admin/article/audit",
        permission: PERMISSIONS.DASHBOARD_ARTICLE_AUDIT,
        visible: (record) => record.status === 2,
        successMessage: t("dashboard.messages.audited"),
      },
      {
        label: t("dashboard.actions.undelete"),
        endpoint: "/api/admin/article/audit",
        permission: PERMISSIONS.DASHBOARD_ARTICLE_DELETE,
        visible: (record) => record.status === 1,
        successMessage: t("dashboard.messages.restored"),
      },
      {
        label: t("dashboard.actions.delete"),
        endpoint: "/api/admin/article/delete",
        permission: PERMISSIONS.DASHBOARD_ARTICLE_DELETE,
        visible: (record) => record.status === 0 || record.status === 2,
        confirm: t("dashboard.confirmDelete"),
        successMessage: t("dashboard.messages.deleted"),
      },
    ],
    renderFeed: ({ records, loading, state }) => (
      <DashboardDataFeedList
        records={records as ArticleRecord[]}
        loading={loading}
        page={state.page}
        pageCount={state.pageCount}
        total={state.total}
        limit={state.limit}
        onPageChange={(nextPage) => state.updateFilter("page", nextPage)}
        onLimitChange={(nextLimit) =>
          state.setFilters((current) => ({
            ...current,
            page: 1,
            limit: nextLimit,
          }))
        }
        renderItem={(article) => (
          <ArticleFeedItem
            article={article}
            permissions={{ audit: canAudit, delete: canDelete }}
            onAction={(action) => {
              const matchedAction = config.rowActions?.find((item) => {
                if (action === "audit") return item.label === t("dashboard.actions.audit")
                if (action === "undelete") return item.label === t("dashboard.actions.undelete")
                if (action === "delete") return item.label === t("dashboard.actions.delete")
                return false
              })
              if (matchedAction) {
                void state.runAction(matchedAction, article)
              }
            }}
          />
        )}
      />
    ),
  }

  return <DashboardDataPage config={config} />
}

function ArticleFeedItem({
  article,
  permissions,
  onAction,
}: {
  article: ArticleRecord
  permissions: {
    audit: boolean
    delete: boolean
  }
  onAction: (action: ArticleAction) => void
}) {
  const { t } = useI18n()
  const userName =
    article.user?.nickname ||
    article.user?.username ||
    t("dashboard.user.anonymous")
  const articleUrl = `/article/${article.id}`
  const coverSrc = imageSrc(article.cover)
  const userUrl = article.user?.idEncode
    ? `/user/${article.user.idEncode}`
    : article.user?.id
      ? `/user/${article.user.id}`
      : undefined

  return (
    <article className="grid gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <a
          href={articleUrl}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 min-w-0 text-base font-semibold hover:underline"
        >
          {article.title || t("dashboard.topicFeed.untitled")}
        </a>
        <ArticleTag
          className={cn(
            article.status === 1 && "border-destructive/30 text-destructive",
            article.status === 2 && "border-amber-400/40 text-amber-700"
          )}
        >
          {articleStatusLabel(t, article.status)}
        </ArticleTag>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px] md:items-center">
        <div className="min-w-0">
          {compactText(article.summary) ? (
            <p className="line-clamp-3 w-full text-sm leading-6 text-muted-foreground">
              {compactText(article.summary)}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a
                href={userUrl || "#"}
                target={userUrl ? "_blank" : undefined}
                rel="noreferrer"
                className="hover:text-foreground"
              >
                {userName}
              </a>
              <span>{formatDateTime(article.createTime ?? null) || "-"}</span>
              <span>ID: {article.id}</span>
            </div>
            {article.tags?.length ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {article.tags.map((tag) =>
                  tag.name ? (
                    <ArticleTag key={tag.id || tag.name}>
                      #{tag.name}
                    </ArticleTag>
                  ) : null
                )}
              </div>
            ) : null}
          </div>
        </div>

        {coverSrc ? (
          <div className="aspect-[5/3] overflow-hidden rounded-md border bg-muted md:w-[150px]">
            <PreviewableImage
              src={coverSrc}
              previewSrcList={[coverSrc]}
              alt={article.title || ""}
              className="size-full cursor-zoom-in object-cover"
              loading="lazy"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <EyeIcon className="size-3.5" />
            {article.viewCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircleIcon className="size-3.5" />
            {article.commentCount ?? 0}
          </span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {permissions.audit && article.status === 2 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("audit")}
            >
              <Undo2Icon />
              {t("dashboard.actions.audit")}
            </Button>
          ) : null}
          {permissions.delete && article.status === 1 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("undelete")}
            >
              <Undo2Icon />
              {t("dashboard.actions.undelete")}
            </Button>
          ) : null}
          {permissions.delete && (article.status === 0 || article.status === 2) ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onAction("delete")}
            >
              <Trash2Icon />
              {t("dashboard.actions.delete")}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function ArticleTag({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  )
}


