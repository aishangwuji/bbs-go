import { UserProfileCard } from "@/components/user/user-profile-card"
import { UserCenterSidebar } from "@/components/user/user-sidebar"
import { UserCenterTabs } from "@/components/user/user-center-tabs"
import type { Badge, UserSummary } from "@/lib/api/types"
import type { TFunction } from "@/lib/i18n"

export function UserCenterShell({
  user,
  currentUser,
  badges,
  profileBadges,
  fans,
  followed,
  t,
  showTabs = false,
  children,
}: {
  user: UserSummary
  currentUser?: UserSummary | null
  badges: Badge[]
  profileBadges?: Badge[]
  fans: UserSummary[]
  followed: UserSummary[]
  t: TFunction
  // showTabs：公开主页各分区（话题/文章/勋章/粉丝/关注）统一 Tab；
  // 私密中心（收藏/消息/积分）不展示，避免与公开分区混淆。
  showTabs?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="main">
      <div className="container">
        <UserProfileCard
          user={user}
          badges={profileBadges ?? badges}
          currentUser={currentUser}
        />
      </div>
      <div className="container main-container right-main side-size-360">
        <UserCenterSidebar
          user={user}
          currentUser={currentUser}
          badges={badges}
          fans={fans}
          followed={followed}
          t={t}
        />
        <div className="right-container">
          {showTabs ? (
            <UserCenterTabs user={user} currentUser={currentUser} t={t} />
          ) : null}
          {children}
        </div>
      </div>
    </section>
  )
}
