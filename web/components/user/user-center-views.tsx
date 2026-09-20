"use client"

import { Medal } from "lucide-react"
import { useOutletContext } from "react-router"

import { ArticleList } from "@/components/article/article-list"
import { EmptyState } from "@/components/common/empty-state"
import { LoadMore } from "@/components/common/load-more"
import { TopicListItem } from "@/components/topic/topic-list-item"
import { UserFollowList } from "@/components/user/user-follow-list"
import { WidgetCard } from "@/components/common/widget-card"
import type { UserCenterData } from "@/app/route-helpers/user-profile"
import { apiFetch } from "@/lib/api/client"
import type {
  Article,
  Badge,
  PageData,
  Topic,
  UserSummary,
} from "@/lib/api/types"
import { formatDate } from "@/lib/format"
import { useI18n } from "@/lib/i18n/provider"

// ---------------------------------------------------------------------------
// 用户中心内容视图（各 tab 的内容区，不含外壳）
// 设计：父布局路由已拉取外壳数据并通过 Outlet context 下发，视图只负责本 tab 的
// 首屏渲染与 LoadMore 分页。切 tab 时外壳不重建，只有这里的内容替换。
// ---------------------------------------------------------------------------

export function UserTopicsView({ initial }: { initial: PageData<Topic> }) {
  const { t } = useI18n()
  const { user } = useOutletContext<UserCenterData>()
  const loadMoreLabels = {
    loadMore: t("common.loadMore.loadMore"),
    noMore: t("common.loadMore.noMore"),
  }

  return (
    <WidgetCard>
      <LoadMore<Topic>
        initialItems={initial.results || []}
        initialCursor={initial.cursor}
        initialHasMore={initial.hasMore}
        initialLoad
        resetKey={`user-topics:${user.id}:${initial.cursor}:${initial.hasMore}`}
        labels={loadMoreLabels}
        loadPage={({ cursor }) =>
          apiFetch<PageData<Topic>>("/api/topic/user_topics", {
            params: { userId: user.id, cursor },
          })
        }
        renderItems={(items) => (
          <ul className="divide-y divide-border">
            {items.map((topic) => (
              <TopicListItem key={topic.id} topic={topic} t={t} />
            ))}
          </ul>
        )}
        renderEmpty={() => <EmptyState title={t("common.noData")} />}
      />
    </WidgetCard>
  )
}

export function UserArticlesView({ initial }: { initial: PageData<Article> }) {
  const { t } = useI18n()
  const { user } = useOutletContext<UserCenterData>()
  const loadMoreLabels = {
    loadMore: t("common.loadMore.loadMore"),
    noMore: t("common.loadMore.noMore"),
  }

  return (
    <WidgetCard>
      <LoadMore<Article>
        initialItems={initial.results || []}
        initialCursor={initial.cursor}
        initialHasMore={initial.hasMore}
        initialLoad
        resetKey={`user-articles:${user.id}:${initial.cursor}:${initial.hasMore}`}
        labels={loadMoreLabels}
        loadPage={({ cursor }) =>
          apiFetch<PageData<Article>>("/api/article/user_articles", {
            params: { userId: user.id, cursor },
          })
        }
        renderItems={(items) => <ArticleList articles={items} t={t} />}
        renderEmpty={() => <EmptyState title={t("common.noData")} />}
      />
    </WidgetCard>
  )
}

export function UserBadgesView({ badges }: { badges: Badge[] }) {
  const { t } = useI18n()

  return (
    <WidgetCard>
      <div className="mb-4">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {t("pages.user.badgesTitle")}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("pages.user.badgesSubtitle")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={
              badge.owned
                ? "flex flex-col items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 transition dark:border-amber-800/60 dark:bg-amber-900/20"
                : "flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4 opacity-70 transition dark:border-slate-700 dark:bg-slate-900/40"
            }
          >
            <div className="relative">
              {badge.icon ? (
                <img
                  src={badge.icon}
                  alt={badge.title || ""}
                  className={
                    badge.owned
                      ? "h-14 w-14 object-contain"
                      : "h-14 w-14 object-contain opacity-40 grayscale"
                  }
                />
              ) : (
                <div
                  className={
                    badge.owned
                      ? "flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700"
                      : "flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 opacity-40 dark:bg-slate-700"
                  }
                >
                  <Medal className="h-8 w-8 text-slate-600 dark:text-slate-300" />
                </div>
              )}
              {badge.worn ? (
                <span className="absolute -top-1 -right-4 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {t("component.userBadges.worn")}
                </span>
              ) : null}
            </div>
            <span
              className={
                badge.owned
                  ? "line-clamp-2 text-center text-sm font-medium text-slate-800 dark:text-slate-100"
                  : "line-clamp-2 text-center text-sm font-medium text-slate-500 dark:text-slate-400"
              }
            >
              {badge.title}
            </span>
            {badge.owned && badge.obtainTime ? (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t("component.userBadges.obtainedAt")}{" "}
                {formatDate(badge.obtainTime, "yyyy-MM-dd")}
              </span>
            ) : !badge.owned ? (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {t("component.userBadges.notObtained")}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

function UserFollowView({
  kind,
  initial,
}: {
  kind: "fans" | "followed"
  initial: PageData<UserSummary>
}) {
  const { t } = useI18n()
  const { user } = useOutletContext<UserCenterData>()
  const labels = {
    loadMore: t("common.loadMore.loadMore"),
    noMore: t("common.loadMore.noMore"),
  }

  return (
    <WidgetCard>
      <UserFollowList users={initial.results || []} />
      <LoadMore<UserSummary>
        initialCursor={initial.cursor}
        initialHasMore={initial.hasMore}
        resetKey={`user-${kind}:${user.id}:${initial.cursor}:${initial.hasMore}`}
        labels={labels}
        loadPage={({ cursor }) =>
          apiFetch<PageData<UserSummary>>(
            kind === "fans" ? "/api/fans/fans" : "/api/fans/followed",
            { params: { userId: user.id, cursor } }
          )
        }
        renderItems={(items) => <UserFollowList users={items} />}
        alwaysShowButton
      />
    </WidgetCard>
  )
}

export function UserFansView({ initial }: { initial: PageData<UserSummary> }) {
  return <UserFollowView kind="fans" initial={initial} />
}

export function UserFollowedView({
  initial,
}: {
  initial: PageData<UserSummary>
}) {
  return <UserFollowView kind="followed" initial={initial} />
}
