"use client"

import * as React from "react"

import type { SiteConfig, UserSummary } from "@/lib/api/types"
import type { Locale } from "@/lib/i18n"

export type ClientAppState = {
  config: SiteConfig | null
  currentUser: UserSummary | null
  locale: Locale
  unreadMessageCount: number
}

type AppContextValue = ClientAppState & {
  authChecked: boolean
  isLogin: boolean
  setConfig: React.Dispatch<React.SetStateAction<SiteConfig | null>>
  setCurrentUser: React.Dispatch<React.SetStateAction<UserSummary | null>>
  setUnreadMessageCount: React.Dispatch<React.SetStateAction<number>>
}

const AppContext = React.createContext<AppContextValue | null>(null)

export function AppProvider({
  initialState,
  children,
}: {
  initialState: ClientAppState
  children: React.ReactNode
}) {
  // 首屏状态全部由 root loader 在服务端算好后经 initialState 注入：
  // 站点配置、当前用户、未读消息数一次到位，客户端不再重复拉取。
  // 之所以能这么做，是因为登录凭据是 HttpOnly Cookie，SSR 请求天然带着它，
  // 服务端拿到的用户态和浏览器自己请求的结果一致。
  const [config, setConfig] = React.useState(initialState.config)
  const [currentUser, setCurrentUser] = React.useState(initialState.currentUser)
  const [unreadMessageCount, setUnreadMessageCount] = React.useState(
    initialState.unreadMessageCount
  )

  const value = React.useMemo<AppContextValue>(
    () => ({
      config,
      currentUser,
      // 鉴权结论在 SSR 阶段就已确定，客户端不存在“尚未检查”的中间态，
      // 因此恒为 true；登录/登出由 setCurrentUser 直接改状态。
      authChecked: true,
      locale: initialState.locale,
      unreadMessageCount,
      isLogin: Boolean(currentUser),
      setConfig,
      setCurrentUser,
      setUnreadMessageCount,
    }),
    [config, currentUser, initialState.locale, unreadMessageCount]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppState() {
  const value = React.useContext(AppContext)

  if (!value) {
    throw new Error("useAppState must be used within AppProvider")
  }

  return value
}

export function useAppConfig() {
  return useAppState().config
}

export function useCurrentUser() {
  return useAppState().currentUser
}

export function useUnreadMessageCount() {
  return useAppState().unreadMessageCount
}

export function useSetUnreadMessageCount() {
  return useAppState().setUnreadMessageCount
}

export function useIsLogin() {
  return useAppState().isLogin
}

export function useAuthChecked() {
  return useAppState().authChecked
}

export function useAppLocale() {
  return useAppState().locale
}
