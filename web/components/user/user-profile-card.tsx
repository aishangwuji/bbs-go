"use client"

import * as React from "react"
import Link from "@/components/common/link"
import { Camera, Eye, Medal, Pencil, Sparkles, UserCheck } from "lucide-react"

import { UserAvatar } from "@/components/common/avatar"
import { FollowButton } from "@/components/user/follow-button"
import { BackgroundUploadButton } from "@/components/user/image-upload"
import { useSpaceView } from "@/components/user/space-view-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Badge, UserSummary } from "@/lib/api/types"
import { cn } from "@/lib/utils"

type UserProfileSummary = UserSummary & {
  level?: number
  smallBackgroundImage?: string
}

function displayName(user: UserProfileSummary) {
  return user.nickname || user.username || `#${user.id}`
}

export function UserProfileCard({
  user,
  currentUser,
  badges = [],
}: {
  user: UserProfileSummary
  currentUser?: UserSummary | null
  badges?: Badge[]
}) {
  const {
    currentRole,
    previewMode,
    isRealOwner,
    effectiveFollowed,
    setPreviewMode,
  } = useSpaceView()

  const [backgroundImage, setBackgroundImage] = React.useState(
    user.smallBackgroundImage || user.backgroundImage || ""
  )
  const wornBadges = badges.filter((badge) => badge.worn).slice(0, 3)
  // 是否呈现号主本尊能力（仅在非模拟的 owner 态下生效）
  const showOwnerActions = currentRole === "owner"

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {/* 1. 上半部分：纯净 1280x400 背景封面 */}
      <div
        className="relative h-44 sm:h-52 md:h-60 w-full bg-muted bg-cover bg-center transition-all"
        style={
          backgroundImage
            ? { backgroundImage: `url(${backgroundImage})` }
            : undefined
        }
      >
        {/* 右上角更换背景按钮（仅号主本人可见，高质感毛玻璃胶囊） */}
        {showOwnerActions ? (
          <div className="absolute right-3 top-3 z-10">
            <BackgroundUploadButton onUploaded={setBackgroundImage} />
          </div>
        ) : null}
      </div>

      {/* 2. 下半部分：信息与交互主体 */}
      <div className="relative px-4 pb-4 pt-0 sm:px-6">
        {/* 头像与操作栏行 */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          {/* 跨界半下沉立体头像（上浮深入背景图） */}
          <div className="relative -mt-12 sm:-mt-16 shrink-0">
            <div className="rounded-full ring-4 ring-card shadow-md">
              <UserAvatar user={user} size={108} />
            </div>
            {/* 号主本尊头像相机角标引导：手机触屏端也能一眼看出点击可修改资料 */}
            {showOwnerActions ? (
              <Link
                href={`/user/${user.id}/profile`}
                className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-xs transition-transform hover:scale-105 active:scale-95"
                title="修改头像与个人资料"
              >
                <Camera className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>

          {/* 右侧动作按钮区 */}
          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
            {/* 编辑资料快捷入口（号主主人态直达） */}
            {showOwnerActions ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <Link href={`/user/${user.id}/profile`}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>编辑资料</span>
                </Link>
              </Button>
            ) : null}

            {/* 视角切换下拉：仅号主本人拥有该能力 */}
            {isRealOwner ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-dashed border-primary/40 bg-background text-xs font-medium hover:bg-accent"
                  >
                    <Eye className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {previewMode === "fans"
                        ? "视角: 粉丝"
                        : previewMode === "visitor"
                          ? "视角: 访客"
                          : "视角切换"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    空间主客态预览
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setPreviewMode(null)}
                    className={cn(!previewMode && "bg-accent font-medium")}
                  >
                    <UserCheck className="mr-2 h-4 w-4 text-emerald-500" />
                    主人视角 (本尊)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setPreviewMode("fans")}
                    className={cn(
                      previewMode === "fans" && "bg-accent font-medium"
                    )}
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                    粉丝视角预览
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setPreviewMode("visitor")}
                    className={cn(
                      previewMode === "visitor" && "bg-accent font-medium"
                    )}
                  >
                    <Eye className="mr-2 h-4 w-4 text-blue-500" />
                    普通访客视角预览
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {/* 关注按钮：非主人态时渲染 */}
            {currentRole !== "owner" ? (
              <FollowButton
                key={`${user.id}-${currentRole}-${effectiveFollowed}`}
                userId={user.id}
                initialFollowed={effectiveFollowed}
              />
            ) : null}
          </div>
        </div>

        {/* 昵称、等级与佩戴勋章 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={`/user/${user.id}`}
            className="text-xl sm:text-2xl font-bold text-foreground hover:text-primary transition-colors"
          >
            {displayName(user)}
          </Link>
          {user.level !== undefined && user.level !== null ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span className="font-mono">Lv.{user.level}</span>
            </span>
          ) : null}
          {wornBadges.map((badge) => (
            <Link
              key={badge.id}
              href={`/user/${user.id}/badges`}
              className="inline-flex items-center shrink-0 transition-transform hover:scale-110"
              title={badge.title}
            >
              {badge.icon ? (
                <img
                  src={badge.icon}
                  alt={badge.title || ""}
                  className="h-6 w-6 object-contain"
                />
              ) : (
                <Medal className="h-5 w-5 text-amber-500" />
              )}
            </Link>
          ))}
        </div>

        {/* 个人简介 */}
        {user.description ? (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed break-words">
            {user.description}
          </p>
        ) : null}

        {/* 核心社交与资产数据汇总条（移动端/全端统一保全，彻底告别数据蒸发） */}
        <div className="mt-4 flex flex-wrap items-center gap-4 sm:gap-6 border-t border-border/60 pt-3 text-xs sm:text-sm text-muted-foreground">
          <Link
            href={`/user/${user.id}/followed`}
            className="transition-colors hover:text-foreground"
          >
            <strong className="font-semibold text-foreground">
              {user.followCount ?? 0}
            </strong>{" "}
            关注
          </Link>
          <Link
            href={`/user/${user.id}/fans`}
            className="transition-colors hover:text-foreground"
          >
            <strong className="font-semibold text-foreground">
              {user.fansCount ?? 0}
            </strong>{" "}
            粉丝
          </Link>
          <Link
            href={`/user/${user.id}`}
            className="transition-colors hover:text-foreground"
          >
            <strong className="font-semibold text-foreground">
              {user.topicCount ?? 0}
            </strong>{" "}
            话题
          </Link>
          <span className="cursor-default">
            <strong className="font-semibold text-foreground">
              {user.commentCount ?? 0}
            </strong>{" "}
            评论
          </span>
          {user.score !== undefined ? (
            <Link
              href="/user/scores"
              className="transition-colors hover:text-foreground"
            >
              <strong className="font-semibold text-foreground">
                {user.score}
              </strong>{" "}
              积分
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
