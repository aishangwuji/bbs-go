"use client"

import * as React from "react"
import { useSearchParams } from "react-router"

import type { UserSummary } from "@/lib/api/types"

// SpaceRole 空间视角角色枚举
// owner: 主人态（空间号主本尊）
// fans: 粉丝态（已关注号主的登录用户）
// visitor: 访客态（未登录或未关注该号主的普通用户）
export type SpaceRole = "owner" | "fans" | "visitor"

export interface SpaceViewContextValue {
  // owner 当前个人空间的主人
  owner: UserSummary
  // currentUser 当前登录的访问者
  currentUser?: UserSummary | null
  // realRole 当前访问者与该空间的客观真实关系
  realRole: SpaceRole
  // currentRole 当前生效的呈现角色（受预览模式影响）
  currentRole: SpaceRole
  // previewMode 当前所模拟的视角角色，null 表示正常模式
  previewMode: "fans" | "visitor" | null
  // isRealOwner 是否为空间号主本人
  isRealOwner: boolean
  // isMocking 是否正处于视角预览模式
  isMocking: boolean
  // effectiveFollowed 当前视角下呈现的关注状态
  effectiveFollowed: boolean
  // setPreviewMode 切换或退出视角预览模式
  setPreviewMode: (mode: "fans" | "visitor" | null) => void
}

const SpaceViewContext = React.createContext<SpaceViewContextValue | null>(null)

export function SpaceViewProvider({
  owner,
  currentUser,
  children,
}: {
  owner: UserSummary
  currentUser?: UserSummary | null
  children: React.ReactNode
}) {
  const [searchParams, setSearchParams] = useSearchParams()

  // 1. 判断是否为真实的号主本人
  const isRealOwner = Boolean(
    currentUser?.id &&
      owner?.id &&
      String(currentUser.id) === String(owner.id)
  )

  // 2. 从 URL Query 读取 preview_role（仅当是真实号主时才解析生效）
  const queryRole = searchParams.get("preview_role")
  const previewMode: "fans" | "visitor" | null = React.useMemo(() => {
    if (!isRealOwner) return null
    if (queryRole === "fans" || queryRole === "visitor") {
      return queryRole
    }
    return null
  }, [isRealOwner, queryRole])

  // 3. 计算真实客观角色 realRole
  const realRole: SpaceRole = React.useMemo(() => {
    if (isRealOwner) return "owner"
    if (owner.followed) return "fans"
    return "visitor"
  }, [isRealOwner, owner.followed])

  // 4. 计算当前展示角色 currentRole
  const currentRole: SpaceRole = React.useMemo(() => {
    if (isRealOwner && previewMode) {
      return previewMode
    }
    return realRole
  }, [isRealOwner, previewMode, realRole])

  // 5. 计算在当前视角下的关注状态
  const effectiveFollowed = React.useMemo(() => {
    if (isRealOwner && previewMode === "fans") return true
    if (isRealOwner && previewMode === "visitor") return false
    return Boolean(owner.followed)
  }, [isRealOwner, previewMode, owner.followed])

  // 6. 切换预览模式方法（同步 URL Query，无刷新切换）
  const setPreviewMode = React.useCallback(
    (mode: "fans" | "visitor" | null) => {
      if (!isRealOwner) return
      const nextParams = new URLSearchParams(searchParams)
      if (mode) {
        nextParams.set("preview_role", mode)
      } else {
        nextParams.delete("preview_role")
      }
      setSearchParams(nextParams, { replace: true })
    },
    [isRealOwner, searchParams, setSearchParams]
  )

  const value = React.useMemo<SpaceViewContextValue>(
    () => ({
      owner,
      currentUser,
      realRole,
      currentRole,
      previewMode,
      isRealOwner,
      isMocking: Boolean(previewMode),
      effectiveFollowed,
      setPreviewMode,
    }),
    [
      owner,
      currentUser,
      realRole,
      currentRole,
      previewMode,
      isRealOwner,
      effectiveFollowed,
      setPreviewMode,
    ]
  )

  return (
    <SpaceViewContext.Provider value={value}>
      {children}
    </SpaceViewContext.Provider>
  )
}

// useSpaceView Hook 供空间内所有子组件便捷获取当前视角上下文
export function useSpaceView(): SpaceViewContextValue {
  const context = React.useContext(SpaceViewContext)
  if (!context) {
    throw new Error("useSpaceView must be used within a SpaceViewProvider")
  }
  return context
}
