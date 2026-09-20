"use client"

import Link from "@/components/common/link"
import {
  Award,
  FileText,
  MessageSquare,
  Settings,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { UserSummary } from "@/lib/api/types"
import type { TFunction } from "@/lib/i18n"
import { usePathname } from "@/lib/router/navigation"
import { cn } from "@/lib/utils"
import { useSpaceView } from "@/components/user/space-view-context"

type TabItem = {
  key: string
  href: string
  label: string
  icon: LucideIcon
}

// UserCenterTabs 个人中心统一 Tab 导航
// 为什么用 Link 而非受控 Tabs 组件：各分区是不同的 URL 路由，
// 保留链接语义可继续支持深链、浏览器前进/后退与 SEO，改动也最小。
// 「资料 / 账号设置」Tab 仅在自己主页的主人视角下显示（内嵌于个人主页的
// 嵌套路由），看他人主页或处于预览模式时不出现。
export function UserCenterTabs({
  user,
  currentUser,
  t,
}: {
  user: UserSummary
  currentUser?: UserSummary | null
  t: TFunction
}) {
  const { currentRole } = useSpaceView()
  const pathname = usePathname() || ""
  const base = `/user/${user.id}`
  const isOwnerMode = currentRole === "owner"

  const tabs: TabItem[] = [
    {
      key: "topics",
      href: base,
      label: t("pages.user.topics"),
      icon: MessageSquare,
    },
    {
      key: "articles",
      href: `${base}/articles`,
      label: t("pages.user.articles"),
      icon: FileText,
    },
    {
      key: "badges",
      href: `${base}/badges`,
      label: t("pages.user.badges"),
      icon: Award,
    },
    {
      key: "fans",
      href: `${base}/fans`,
      label: t("pages.user.fans"),
      icon: Users,
    },
    {
      key: "followed",
      href: `${base}/followed`,
      label: t("pages.user.followed"),
      icon: UserPlus,
    },
  ]
  if (isOwnerMode) {
    tabs.push(
      {
        key: "profile",
        href: `${base}/profile`,
        label: t("layout.profile.profile"),
        icon: User,
      },
      {
        key: "account",
        href: `${base}/account`,
        label: t("layout.profile.accountSettings"),
        icon: Settings,
      }
    )
  }

  const isActive = (href: string) => {
    // 话题列表是 base 本身，需精确匹配，避免匹配到 /articles 等子路径
    if (href === base) {
      return pathname === base || pathname === `${base}/`
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <nav className="mb-3 flex items-center gap-1.5 overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = isActive(tab.href)
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors select-none",
              active
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
