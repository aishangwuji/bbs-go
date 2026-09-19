"use client"

import * as React from "react"
import Link from "@/components/common/link"
import { Medal } from "lucide-react"

import { useCurrentUser } from "@/components/app/app-provider"
import { UserAvatar } from "@/components/common/avatar"
import { FollowButton } from "@/components/user/follow-button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import type { UserCard as UserCardData, UserSummary } from "@/lib/api/types"
import { getUserCard } from "@/lib/api/users"
import { useI18n } from "@/lib/i18n/provider"

// ---------------------------------------------------------------------------
// 卡片数据缓存
//
// 为什么放在模块作用域：HoverCard 实例随触发器分散在全站（每个头像一个 HoverCard
// 根节点），缓存必须跨实例共享，才能避免「同一用户被多处悬浮」重复回源。
//
// 为什么带 TTL 而不做永久缓存：粉丝数/发帖数允许弱一致，但不应永久陈旧；
// 60s 内复用可显著削减请求量，同时保证数据基本新鲜。
//
// 为什么需要 inflight 合并：快速连续悬浮时可能对同一用户并发发起多次请求，
// inflight 表把同一用户的并发请求折叠为一次，避免重复网络开销。
// ---------------------------------------------------------------------------
const CARD_CACHE_TTL = 60_000
const CARD_CACHE_MAX = 200

type CacheEntry = { data: UserCardData; expireAt: number }
const cardCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<UserCardData>>()

// 缓存键必须包含「观看者」身份：接口返回的 followed 是相对当前登录用户的关注态，
// 若只按被查看者 userId 缓存，登录/登出或切换观看者后会命中旧包，误显示「已关注」
// 并泄露他人关注关系。匿名观看者统一用 "anon"。
function cardCacheKey(viewerId: string, userId: string) {
  return `${viewerId}:${userId}`
}

function readCachedCard(cacheKey: string): UserCardData | null {
  const entry = cardCache.get(cacheKey)
  if (!entry) {
    return null
  }
  if (entry.expireAt < Date.now()) {
    cardCache.delete(cacheKey)
    return null
  }
  return entry.data
}

function writeCachedCard(cacheKey: string, data: UserCardData) {
  // 已存在时先删除再写入：JS Map 的 set 不会刷新已有键的迭代顺序，
  // 先删后写才能让「最近写入」的条目落到队尾，淘汰时优先淘汰真正最旧的。
  if (cardCache.has(cacheKey)) {
    cardCache.delete(cacheKey)
  } else if (cardCache.size >= CARD_CACHE_MAX) {
    const oldest = cardCache.keys().next().value
    if (oldest) {
      cardCache.delete(oldest)
    }
  }
  cardCache.set(cacheKey, { data, expireAt: Date.now() + CARD_CACHE_TTL })
}

// mutateUserCardCache 就地更新已缓存卡片的字段（不创建新条目）。
// 用途：关注态变更后同步缓存，避免 60s TTL 内再次悬浮读到旧的 followed。
function mutateUserCardCache(
  viewerId: string,
  userId: string,
  patch: Partial<UserCardData>
) {
  const cacheKey = cardCacheKey(viewerId, userId)
  const entry = cardCache.get(cacheKey)
  if (!entry) {
    return
  }
  cardCache.set(cacheKey, { ...entry, data: { ...entry.data, ...patch } })
}

function loadUserCard(viewerId: string, userId: string): Promise<UserCardData> {
  const cacheKey = cardCacheKey(viewerId, userId)
  const cached = readCachedCard(cacheKey)
  if (cached) {
    return Promise.resolve(cached)
  }
  const pending = inflight.get(cacheKey)
  if (pending) {
    return pending
  }
  const request = getUserCard(userId)
    .then((data) => {
      writeCachedCard(cacheKey, data)
      return data
    })
    .finally(() => {
      inflight.delete(cacheKey)
    })
  inflight.set(cacheKey, request)
  return request
}

function displayName(user: UserSummary) {
  return user.nickname || user.username || `#${user.id}`
}

type UserHoverCardProps = {
  user?: UserSummary | null
  children: React.ReactNode
  side?: React.ComponentProps<typeof HoverCardContent>["side"]
  align?: React.ComponentProps<typeof HoverCardContent>["align"]
  // disabled 用于「自己是当前登录用户」「匿名不展示」等无需弹卡的场景
  disabled?: boolean
}

// UserHoverCard 用户悬浮卡片
// 交互：鼠标移入触发器延时弹出（Radix 内置）；Portal 挂载到 body，
// 并由 floating-ui 自动处理视口边界翻转，无需手写 getBoundingClientRect。
// 数据：首次打开时才请求 /api/user/:id/card，之后命中模块级短缓存。
export function UserHoverCard({
  user,
  children,
  side = "bottom",
  align = "start",
  disabled = false,
}: UserHoverCardProps) {
  const { t } = useI18n()
  const currentUser = useCurrentUser()
  const userId = user?.id ? String(user.id) : ""
  // 观看者身份参与缓存键：followed 是相对当前登录用户的，切换/登出后必须换键取新数据
  const viewerId = currentUser?.id ? String(currentUser.id) : "anon"
  const cacheKey = cardCacheKey(viewerId, userId)

  const [open, setOpen] = React.useState(false)
  const [card, setCard] = React.useState<UserCardData | null>(null)
  const [resolvedKey, setResolvedKey] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  // 竞态保护（session token 隔离）：每次请求自增序号，仅当响应返回时序号仍是最新
  // 才写入 state，防止「快速划过 A 再悬浮 B」时 A 的迟到响应覆盖 B 的卡片。
  const seqRef = React.useRef(0)

  React.useEffect(() => {
    if (!open || !userId) {
      return
    }
    const seq = ++seqRef.current

    setLoading(true)
    setFailed(false)
    loadUserCard(viewerId, userId)
      .then((data) => {
        if (seq === seqRef.current) {
          setCard(data)
          setResolvedKey(cacheKey)
        }
      })
      .catch(() => {
        if (seq === seqRef.current) {
          setFailed(true)
        }
      })
      .finally(() => {
        if (seq === seqRef.current) {
          setLoading(false)
        }
      })

    // 清理即失效：参数变更或组件卸载时递增序号，使本次在途请求结果被丢弃。
    // 无需额外维护 mountedRef（React 18+ 推荐的竞态处理方式）。
    return () => {
      seqRef.current++
    }
  }, [open, cacheKey, viewerId, userId])

  // 关注态变更回写：同步本地 state 与模块缓存，避免关闭后 60s 内再次悬浮读到旧值。
  const handleFollowChanged = React.useCallback(
    (followed: boolean) => {
      mutateUserCardCache(viewerId, userId, { followed })
      setCard((prev) => (prev ? { ...prev, followed } : prev))
    },
    [viewerId, userId]
  )

  if (disabled || !userId) {
    return <>{children}</>
  }

  // 仅当已加载的数据属于当前「观看者 + 被查看者」组合时才展示，
  // 避免切换用户或切换登录态瞬间闪现上一个用户的资料/关注态
  const shown = resolvedKey === cacheKey ? card : null
  // 复用已归一化的 viewerId/userId 比较，避免 id 类型不一致时把自己误判为他人
  const isSelf = Boolean(currentUser?.id) && viewerId === userId
  const badges = shown?.badges || []

  return (
    <HoverCard openDelay={200} closeDelay={120} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <span className="inline-flex min-w-0 max-w-full align-middle">
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side={side} align={align} className="w-80 p-0">
        {loading && !shown ? (
          <div className="p-4 text-sm text-muted-foreground">
            {t("component.userCard.loading")}
          </div>
        ) : failed && !shown ? (
          <div className="p-4 text-sm text-muted-foreground">
            {t("component.userCard.loadFailed")}
          </div>
        ) : shown ? (
          <div className="p-4">
            <div className="flex items-center gap-3">
              <UserAvatar user={shown} size={48} linkToProfile={false} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={`/user/${shown.id}`}
                    className="truncate text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {displayName(shown)}
                  </Link>
                  {shown.level ? (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
                      Lv{shown.level}
                    </span>
                  ) : null}
                </div>
                {shown.levelTitle ? (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {shown.levelTitle}
                  </div>
                ) : null}
              </div>
            </div>

            {shown.description ? (
              <p className="mt-3 line-clamp-2 text-xs break-all text-muted-foreground">
                {shown.description}
              </p>
            ) : null}

            <div className="mt-3 flex border-y border-border py-2 text-center text-xs">
              <div className="flex-1">
                <div className="font-semibold text-foreground">
                  {shown.topicCount ?? 0}
                </div>
                <div className="mt-0.5 text-muted-foreground">
                  {t("component.userCard.topics")}
                </div>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground">
                  {shown.commentCount ?? 0}
                </div>
                <div className="mt-0.5 text-muted-foreground">
                  {t("component.userCard.comments")}
                </div>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground">
                  {shown.fansCount ?? 0}
                </div>
                <div className="mt-0.5 text-muted-foreground">
                  {t("component.userCard.followers")}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t("component.userCard.badges")}
                  {shown.badgeCount ? ` (${shown.badgeCount})` : ""}
                </span>
                {badges.length ? (
                  <Link
                    href={`/user/${shown.id}/badges`}
                    className="hover:text-primary"
                  >
                    {t("component.userCard.viewAllBadges")}
                  </Link>
                ) : null}
              </div>
              {badges.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {badges.slice(0, 6).map((badge) => (
                    <Link
                      key={badge.id}
                      href={`/user/${shown.id}/badges`}
                      title={badge.title || badge.description || ""}
                      className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-muted"
                    >
                      {badge.icon ? (
                        <img
                          src={badge.icon}
                          alt={badge.title || ""}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Medal className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("component.userCard.noBadges")}
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              {!isSelf ? (
                <FollowButton
                  userId={shown.id}
                  initialFollowed={shown.followed}
                  onChanged={handleFollowChanged}
                />
              ) : null}
              <Link
                href={`/user/${shown.id}`}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                {t("component.userCard.viewProfile")}
              </Link>
            </div>
          </div>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  )
}
