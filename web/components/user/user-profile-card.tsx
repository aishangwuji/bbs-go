"use client"

import * as React from "react"
import Link from "@/components/common/link"
import { Eye, Medal, Sparkles, UserCheck } from "lucide-react"

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
    <section
      className="profile"
      style={
        backgroundImage
          ? { backgroundImage: `url(${backgroundImage})` }
          : undefined
      }
    >
      {showOwnerActions ? (
        <BackgroundUploadButton onUploaded={setBackgroundImage} />
      ) : null}
      <div className="profile-avatar">
        <UserAvatar user={user} size={100} />
      </div>
      <div className="profile-info">
        <div className="metas">
          <div className="nickname-row">
            <span className="nickname">
              <Link
                href={`/user/${user.id}`}
                className="text-foreground hover:underline"
              >
                {displayName(user)}
              </Link>
            </span>
            {user.level !== undefined && user.level !== null ? (
              <span className="level-badge">
                <span className="level-label">Lv</span>
                <span className="tabular-nums">{user.level}</span>
              </span>
            ) : null}
            {wornBadges.map((badge) => (
              <Link
                key={badge.id}
                href={`/user/${user.id}/badges`}
                className="badge-icon shrink-0"
                title={badge.title}
              >
                {badge.icon ? (
                  <img
                    src={badge.icon}
                    alt={badge.title || ""}
                    className="h-6 w-6 object-contain"
                  />
                ) : (
                  <Medal className="h-5 w-5" />
                )}
              </Link>
            ))}
          </div>
          {user.description ? (
            <div className="description">
              <p>{user.description}</p>
            </div>
          ) : null}
        </div>
        <div className="action-btns flex items-center gap-2">
          {/* 视角切换下拉：仅号主本人拥有该能力 */}
          {isRealOwner ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-dashed border-primary/40 bg-background/90 text-xs font-medium backdrop-blur-sm hover:bg-accent"
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

          {/* 关注按钮：非主人态时渲染（包括真实访客/粉丝，以及号主处于预览模拟态） */}
          {currentRole !== "owner" ? (
            <FollowButton
              key={`${user.id}-${currentRole}-${effectiveFollowed}`}
              userId={user.id}
              initialFollowed={effectiveFollowed}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}
