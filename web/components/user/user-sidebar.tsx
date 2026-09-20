import Link from "@/components/common/link"
import { ChevronRight, Medal } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { WidgetCard } from "@/components/common/widget-card"
import { UserCenterOperations } from "@/components/user/user-center-operations"
import { UserFollowList } from "@/components/user/user-follow-list"
import type { Badge, UserSummary } from "@/lib/api/types"
import type { TFunction } from "@/lib/i18n"

export function UserCountsCard({
  user,
  t,
}: {
  user: UserSummary
  t: TFunction
}) {
  return (
    <WidgetCard title={t("component.myCounts.title")}>
      <ul className="extra-info">
        <li>
          <span>{t("component.myCounts.level")}</span>
          <br />
          <b>{`Lv.${user.level ?? 0}`}</b>
        </li>
        <li>
          <span>{t("component.myCounts.score")}</span>
          <br />
          <Link href="/user/scores">
            <b>{user.score ?? 0}</b>
          </Link>
        </li>
        <li>
          <span>{t("component.myCounts.topicCount")}</span>
          <br />
          <b>{user.topicCount ?? 0}</b>
        </li>
        <li>
          <span>{t("component.myCounts.commentCount")}</span>
          <br />
          <b>{user.commentCount ?? 0}</b>
        </li>
      </ul>
    </WidgetCard>
  )
}

export function UserBadgesWidget({
  user,
  badges,
  t,
}: {
  user: UserSummary
  badges: Badge[]
  t: TFunction
}) {
  const owned = badges.filter((badge) => badge.owned !== false)
  const display = owned.slice(0, 6)
  const badgesLink = `/user/${user.id}/badges`

  return (
    <WidgetCard
      title={
        <>
          <span>{t("component.userBadges.title")}</span>
          <span>&nbsp;</span>
          <span>{owned.length}</span>
        </>
      }
      actions={
        <Link href={badgesLink} className="inline-flex items-center gap-1">
          {t("component.userBadges.viewAll")}
          <ChevronRight className="h-4 w-4" />
        </Link>
      }
    >
      {!owned.length ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {t("component.userBadges.noBadges")}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {display.map((badge) => (
              <Link
                key={badge.id}
                href={badgesLink}
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-amber-200/80 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-900/20"
                title={badge.title}
              >
                {badge.icon ? (
                  <img
                    src={badge.icon}
                    alt={badge.title || ""}
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <Medal className="h-6 w-6" />
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  )
}

export function MyProfileCard({
  user,
  currentUser,
  t,
}: {
  user: UserSummary
  currentUser?: UserSummary | null
  t: TFunction
}) {
  const canEdit = currentUser?.id === user.id
  return (
    <WidgetCard
      title={t("component.myProfile.title")}
      actions={
        canEdit ? (
          <Link
            href={`/user/${user.id}/profile`}
            className="inline-flex items-center gap-1"
          >
            {t("component.myProfile.editProfile")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null
      }
    >
      <div className="stable">
        <div className="str">
          <div className="slabel">{t("component.myProfile.nickname")}</div>
          <div className="svalue">{user.nickname}</div>
        </div>
        <div className="str">
          <div className="slabel">{t("component.myProfile.description")}</div>
          <div className="svalue">{user.description}</div>
        </div>
        {user.homePage ? (
          <div className="str">
            <div className="slabel">{t("component.myProfile.homePage")}</div>
            <div className="svalue">
              <a href={user.homePage} target="_blank" rel="nofollow noreferrer">
                {user.homePage}
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </WidgetCard>
  )
}

export function FollowWidget({
  title,
  count,
  moreHref,
  users,
  t,
}: {
  title: string
  count?: number
  moreHref: string
  users: UserSummary[]
  t: TFunction
}) {
  return (
    <WidgetCard
      title={
        <>
          <span>{title}</span>
          <span>&nbsp;</span>
          <span>{count ?? 0}</span>
        </>
      }
      actions={
        <Link href={moreHref} className="inline-flex items-center gap-1">
          {t("component.fansWidget.more")}
          <ChevronRight className="h-4 w-4" />
        </Link>
      }
    >
      {users.length ? (
        <UserFollowList users={users} />
      ) : (
        <EmptyState title={t("common.noData")} />
      )}
    </WidgetCard>
  )
}

import { UserGithubProfileWidget } from "@/components/user/user-github-widget"
import { useSpaceView } from "@/components/user/space-view-context"

export function UserCenterSidebar({
  user,
  currentUser,
  badges,
  fans,
  followed,
  t,
}: {
  user: UserSummary
  currentUser?: UserSummary | null
  badges: Badge[]
  fans: UserSummary[]
  followed: UserSummary[]
  t: TFunction
}) {
  const { currentRole, isRealOwner, isMocking } = useSpaceView()

  const config = user.spaceModulesConfig || {
    github: true,
    counts: true,
    badges: true,
    profile: true,
    fans: true,
    followed: true,
  }

  // 模块显隐判断：
  // 1. 若配置为 true，全员可见
  // 2. 若配置为 false，访客态/模拟视角直接隐藏；仅号主本尊且非模拟模式下可见（带私密标记）
  const isVisible = (enabled?: boolean) => {
    const isPublic = enabled !== false
    if (isPublic) return true
    return isRealOwner && !isMocking
  }

  const renderPrivateBadge = (enabled?: boolean) => {
    if (enabled !== false) return null
    if (isRealOwner && !isMocking) {
      return (
        <span className="inline-flex items-center rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
          👁️‍🗨️ 仅自己可见（访客已隐藏）
        </span>
      )
    }
    return null
  }

  return (
    <div className="left-container space-y-4">
      {isVisible(config.github) && (
        <div className="space-y-1">
          {renderPrivateBadge(config.github) && (
            <div className="flex justify-end pr-1">
              {renderPrivateBadge(config.github)}
            </div>
          )}
          <UserGithubProfileWidget user={user} currentUser={currentUser} />
        </div>
      )}
      {isVisible(config.counts) && (
        <div className="space-y-1">
          {renderPrivateBadge(config.counts) && (
            <div className="flex justify-end pr-1">
              {renderPrivateBadge(config.counts)}
            </div>
          )}
          <UserCountsCard user={user} t={t} />
        </div>
      )}
      {isVisible(config.badges) && (
        <div className="space-y-1">
          {renderPrivateBadge(config.badges) && (
            <div className="flex justify-end pr-1">
              {renderPrivateBadge(config.badges)}
            </div>
          )}
          <UserBadgesWidget user={user} badges={badges} t={t} />
        </div>
      )}
      {isVisible(config.profile) && (
        <div className="space-y-1">
          {renderPrivateBadge(config.profile) && (
            <div className="flex justify-end pr-1">
              {renderPrivateBadge(config.profile)}
            </div>
          )}
          <MyProfileCard user={user} currentUser={currentUser} t={t} />
        </div>
      )}
      {isVisible(config.fans) && (
        <div className="space-y-1">
          {renderPrivateBadge(config.fans) && (
            <div className="flex justify-end pr-1">
              {renderPrivateBadge(config.fans)}
            </div>
          )}
          <FollowWidget
            title={t("component.fansWidget.title")}
            count={user.fansCount}
            moreHref={`/user/${user.id}/fans`}
            users={fans}
            t={t}
          />
        </div>
      )}
      {isVisible(config.followed) && (
        <div className="space-y-1">
          {renderPrivateBadge(config.followed) && (
            <div className="flex justify-end pr-1">
              {renderPrivateBadge(config.followed)}
            </div>
          )}
          <FollowWidget
            title={t("component.followWidget.title")}
            count={user.followCount}
            moreHref={`/user/${user.id}/followed`}
            users={followed}
            t={t}
          />
        </div>
      )}
      <UserCenterOperations user={user} currentUser={currentUser} />
    </div>
  )
}
