"use client"

import * as React from "react"
import {
  CheckCircleIcon,
  ClipboardCheckIcon,
  EyeIcon,
  ExternalLinkIcon,
  LightbulbIcon,
  MessageCircleIcon,
  HeartIcon,
  RotateCcwIcon,
  StarIcon,
  StarOffIcon,
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
import { formatDateTime } from "@/lib/format"
import { userHasPermission } from "@/lib/auth/roles"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"

type TopicRecord = AdminRecord & {
  id?: number
  idEncode?: string
  title?: string
  summary?: string
  content?: string
  type?: number
  status?: number
  qaStatus?: string
  recommend?: boolean
  createTime?: number
  viewCount?: number
  commentCount?: number
  likeCount?: number
  user?: {
    id?: number
    idEncode?: string
    nickname?: string
    username?: string
    avatar?: string
  }
  category?: {
    name?: string
  }
  tags?: Array<{
    id?: number
    name?: string
  }>
  imageList?: Array<{
    preview?: string
    url?: string
  }>
  vote?: {
    title?: string
    optionCount?: number
    voteNum?: number
    voteCount?: number
    expired?: boolean
    expiredAt?: number
    options?: Array<{
      id?: number
      content?: string
      voteCount?: number
      percent?: number
    }>
  }
}

type TopicAction =
  | "recommend"
  | "unrecommend"
  | "audit"
  | "undelete"
  | "delete"
  | "solved"
  | "unsolved"

function topicTypeLabel(t: ReturnType<typeof useI18n>["t"], type?: number) {
  if (type === 1) return t("dashboard.topicFeed.typeTweet")
  if (type === 2) return t("dashboard.topicFeed.typeQa")
  return t("dashboard.topicFeed.typeTopic")
}

function topicStatusLabel(t: ReturnType<typeof useI18n>["t"], status?: number) {
  if (status === 1) return t("dashboard.topicFeed.statusDeleted")
  if (status === 2) return t("dashboard.topicFeed.statusReview")
  return t("dashboard.topicFeed.statusNormal")
}


function compactText(value: unknown) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim()
}

function voteOptionPercent(
  option: NonNullable<NonNullable<TopicRecord["vote"]>["options"]>[number],
  total: number
) {
  if (typeof option.percent === "number") {
    return Math.max(0, Math.min(100, option.percent))
  }
  if (total <= 0) return 0
  return Math.max(
    0,
    Math.min(100, Math.round(((option.voteCount || 0) / total) * 100))
  )
}

export default function DashboardTopicsRoute() {
  const { t } = useI18n()
  const currentUser = useCurrentUser()
  const canRecommend = userHasPermission(
    currentUser,
    PERMISSIONS.DASHBOARD_TOPIC_RECOMMEND
  )
  const canAudit = userHasPermission(currentUser, PERMISSIONS.DASHBOARD_TOPIC_AUDIT)
  const canDelete = userHasPermission(currentUser, PERMISSIONS.DASHBOARD_TOPIC_DELETE)
  const canSolve = userHasPermission(currentUser, PERMISSIONS.DASHBOARD_TOPIC_SOLVE)

  const config: DashboardDataPageConfig = {
    title: dashboardData.title(t, "topics"),
    description: dashboardData.desc(t, "topics"),
    listEndpoint: "/api/admin/topic/list",
    viewPermission: PERMISSIONS.DASHBOARD_TOPIC_VIEW,
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
      {
        name: "type",
        label: dashboardData.label(t, "type"),
        type: "select",
        options: dashboardData.topicTypeOptionsFor(t),
      },
      {
        name: "recommend",
        label: dashboardData.label(t, "recommend"),
        type: "select",
        options: dashboardData.booleanOptionsFor(t),
      },
      {
        name: "qaStatus",
        label: dashboardData.label(t, "qaStatus"),
        type: "select",
        options: [
          { label: t("dashboard.topicFeed.qaSolved"), value: "solved" },
          { label: t("dashboard.topicFeed.qaUnsolved"), value: "unsolved" },
        ],
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
        label: t("dashboard.actions.recommend"),
        endpoint: "/api/admin/topic/recommend",
        permission: PERMISSIONS.DASHBOARD_TOPIC_RECOMMEND,
        visible: (record) => record.status === 0 && !record.recommend,
        successMessage: t("dashboard.messages.recommended"),
      },
      {
        label: t("dashboard.actions.unrecommend"),
        endpoint: "/api/admin/topic/recommend",
        method: "DELETE",
        permission: PERMISSIONS.DASHBOARD_TOPIC_RECOMMEND,
        visible: (record) => record.status === 0 && Boolean(record.recommend),
        successMessage: t("dashboard.messages.unrecommended"),
      },
      {
        label: t("dashboard.actions.audit"),
        endpoint: "/api/admin/topic/audit",
        permission: PERMISSIONS.DASHBOARD_TOPIC_AUDIT,
        visible: (record) => record.status === 2,
        successMessage: t("dashboard.messages.audited"),
      },
      {
        label: t("dashboard.actions.undelete"),
        endpoint: "/api/admin/topic/undelete",
        permission: PERMISSIONS.DASHBOARD_TOPIC_DELETE,
        visible: (record) => record.status === 1,
        successMessage: t("dashboard.messages.restored"),
      },
      {
        label: t("dashboard.actions.markSolved"),
        endpoint: "/api/admin/topic/mark_solved",
        permission: PERMISSIONS.DASHBOARD_TOPIC_SOLVE,
        visible: (record) =>
          record.status === 0 && record.type === 2 && record.qaStatus !== "solved",
        successMessage: t("dashboard.messages.markedSolved"),
      },
      {
        label: t("dashboard.actions.markUnsolved"),
        endpoint: "/api/admin/topic/mark_unsolved",
        permission: PERMISSIONS.DASHBOARD_TOPIC_SOLVE,
        visible: (record) =>
          record.status === 0 && record.type === 2 && record.qaStatus === "solved",
        successMessage: t("dashboard.messages.markedUnsolved"),
      },
      {
        label: t("dashboard.actions.delete"),
        endpoint: "/api/admin/topic/delete",
        permission: PERMISSIONS.DASHBOARD_TOPIC_DELETE,
        visible: (record) => record.status === 0 || record.status === 2,
        confirm: t("dashboard.confirmDelete"),
        successMessage: t("dashboard.messages.deleted"),
      },
    ],
    renderFeed: ({ records, loading, state }) => (
      <DashboardDataFeedList
        records={records as TopicRecord[]}
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
        renderItem={(topic) => (
          <TopicFeedItem
            topic={topic}
            permissions={{
              recommend: canRecommend,
              audit: canAudit,
              delete: canDelete,
              solve: canSolve,
            }}
            onAction={(action) => {
              const matchedAction = config.rowActions?.find((item) => {
                if (action === "recommend") return item.label === t("dashboard.actions.recommend")
                if (action === "unrecommend") return item.label === t("dashboard.actions.unrecommend")
                if (action === "audit") return item.label === t("dashboard.actions.audit")
                if (action === "undelete") return item.label === t("dashboard.actions.undelete")
                if (action === "solved") return item.label === t("dashboard.actions.markSolved")
                if (action === "unsolved") return item.label === t("dashboard.actions.markUnsolved")
                if (action === "delete") return item.label === t("dashboard.actions.delete")
                return false
              })
              if (matchedAction) {
                void state.runAction(matchedAction, topic)
              }
            }}
          />
        )}
      />
    ),
  }

  return <DashboardDataPage config={config} />
}

function TopicFeedItem({
  topic,
  permissions,
  onAction,
}: {
  topic: TopicRecord
  permissions: {
    recommend: boolean
    audit: boolean
    delete: boolean
    solve: boolean
  }
  onAction: (action: TopicAction) => void
}) {
  const { t } = useI18n()
  const body = compactText(topic.type === 1 ? topic.content : topic.summary)
  const userName =
    topic.user?.nickname ||
    topic.user?.username ||
    t("dashboard.user.anonymous")
  const topicUrl = `/topic/${topic.idEncode || topic.id}`
  const userUrl = topic.user?.idEncode
    ? `/user/${topic.user.idEncode}`
    : topic.user?.id
      ? `/user/${topic.user.id}`
      : undefined
  const voteOptions = topic.vote?.options || []
  const previewSrcList =
    topic.imageList
      ?.map((image) => image.url || image.preview || "")
      .filter(Boolean) || []
  const voteTotal = voteOptions.reduce(
    (total, option) => total + (option.voteCount || 0),
    0
  )

  return (
    <article className="grid gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <a
            href={userUrl || "#"}
            target={userUrl ? "_blank" : undefined}
            rel={userUrl ? "noreferrer" : undefined}
            aria-disabled={!userUrl}
            className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-medium"
          >
            {topic.user?.avatar ? (
              <img
                src={topic.user.avatar}
                alt={userName}
                className="size-full object-cover"
                loading="lazy"
              />
            ) : (
              userName.slice(0, 1)
            )}
          </a>
          <div className="min-w-0">
            <a
              href={topicUrl}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-2 text-base font-semibold hover:underline"
            >
              {topic.title || t("dashboard.topicFeed.untitled")}
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {userUrl ? (
                <a
                  href={userUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground hover:underline"
                >
                  {userName}
                </a>
              ) : (
                <span>{userName}</span>
              )}
              <span>{formatDateTime(topic.createTime ?? null) || "-"}</span>
              <span>ID: {topic.id}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-1">
          <TopicTag>{topicTypeLabel(t, topic.type)}</TopicTag>
          <TopicTag
            className={cn(
              topic.status === 1 && "border-destructive/30 text-destructive",
              topic.status === 2 && "border-amber-400/40 text-amber-700"
            )}
          >
            {topicStatusLabel(t, topic.status)}
          </TopicTag>
          {topic.recommend ? (
            <TopicTag className="border-primary/30 text-primary">
              {t("dashboard.fields.recommend")}
            </TopicTag>
          ) : null}
          {topic.type === 2 && topic.qaStatus ? (
            <TopicTag>
              {topic.qaStatus === "solved"
                ? t("dashboard.topicFeed.qaSolved")
                : t("dashboard.topicFeed.qaUnsolved")}
            </TopicTag>
          ) : null}
        </div>
      </div>

      {body ? (
        <p className="line-clamp-3 w-full text-sm leading-6 text-muted-foreground">
          {body}
        </p>
      ) : null}

      {topic.imageList?.length ? (
        <div className="flex flex-wrap gap-2">
          {topic.imageList.slice(0, 6).map((image, index) => {
            const src = image.url || image.preview || ""
            return src ? (
              <PreviewableImage
                key={`${src}-${index}`}
                src={src}
                previewSrcList={previewSrcList}
                initialIndex={index}
                alt=""
                className="size-24 cursor-zoom-in rounded-md border object-cover"
                loading="lazy"
              />
            ) : null
          })}
        </div>
      ) : null}

      {topic.vote ? (
        <div className="grid w-200 gap-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium">
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                {t("dashboard.fields.vote")}
              </span>
              <span className="truncate">
                {topic.vote.title || t("dashboard.fields.vote")}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {t("dashboard.topicFeed.voteMeta", {
                  optionCount: topic.vote.optionCount || voteOptions.length,
                  voteNum: topic.vote.voteNum || 1,
                })}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {t("dashboard.topicFeed.voteParticipants", {
                count: topic.vote.voteCount ?? voteTotal,
              })}
            </span>
          </div>
          <div className="grid gap-2">
            {voteOptions.map((option) => {
              const percent = voteOptionPercent(option, voteTotal)
              return (
                <div key={option.id ?? option.content} className="grid gap-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate">{option.content || "-"}</span>
                    <span className="text-muted-foreground">
                      {option.voteCount ?? 0} ({percent}%)
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {topic.vote.expired
              ? t("dashboard.topicFeed.voteExpired")
              : topic.vote.expiredAt
                ? t("dashboard.topicFeed.voteExpiredAt", {
                    time: formatDateTime(topic.vote.expiredAt) || "-",
                  })
                : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {topic.category?.name ? <span>{topic.category.name}</span> : null}
          {topic.tags?.map((tag) =>
            tag.name ? <span key={tag.id || tag.name}>#{tag.name}</span> : null
          )}
          <span className="inline-flex items-center gap-1">
            <EyeIcon className="size-3.5" />
            {topic.viewCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircleIcon className="size-3.5" />
            {topic.commentCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <HeartIcon className="size-3.5" />
            {topic.likeCount ?? 0}
          </span>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={topicUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon />
              {t("dashboard.actions.view")}
            </a>
          </Button>
          {permissions.recommend && topic.status === 0 && topic.recommend ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("unrecommend")}
            >
              <StarOffIcon />
              {t("dashboard.actions.unrecommend")}
            </Button>
          ) : null}
          {permissions.recommend && topic.status === 0 && !topic.recommend ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("recommend")}
            >
              <StarIcon />
              {t("dashboard.actions.recommend")}
            </Button>
          ) : null}
          {permissions.audit && topic.status === 2 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("audit")}
            >
              <CheckCircleIcon />
              {t("dashboard.actions.audit")}
            </Button>
          ) : null}
          {permissions.delete && topic.status === 1 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("undelete")}
            >
              <Undo2Icon />
              {t("dashboard.actions.undelete")}
            </Button>
          ) : null}
          {topic.status === 0 &&
          permissions.solve &&
          topic.type === 2 &&
          topic.qaStatus !== "solved" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("solved")}
            >
              <LightbulbIcon />
              {t("dashboard.actions.markSolved")}
            </Button>
          ) : null}
          {topic.status === 0 &&
          permissions.solve &&
          topic.type === 2 &&
          topic.qaStatus === "solved" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("unsolved")}
            >
              <RotateCcwIcon />
              {t("dashboard.actions.markUnsolved")}
            </Button>
          ) : null}
          {permissions.delete && (topic.status === 0 || topic.status === 2) ? (
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

function TopicTag({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  )
}

