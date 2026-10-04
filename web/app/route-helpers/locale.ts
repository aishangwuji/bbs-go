import {
  matchLocale,
  normalizeLocale as normalizeI18nLocale,
} from "@/lib/i18n"

import type { AppLocale } from "./types"

// 手动选择的持久化载体：localStorage（客户端即时生效）+ 同名 cookie（SSR 首屏可见）。
// cookie 值是外部输入，消费时必须经 matchLocale 白名单校验，非法值直接丢弃。
export const LOCALE_COOKIE_NAME = "bbsgo-locale"
const LOCALE_COOKIE_MAX_AGE = 31536000 // 1 年，与“手动选择长期有效”的语义一致
// localStorage 双 key：新 key 与历史遗留 key 并存，读时任一命中即有效，写时双写兼容旧版本。
export const LOCALE_STORAGE_KEY = "bbsgo-dashboard-locale"
export const LEGACY_LOCALE_STORAGE_KEY = "bbsgo-web-locale"

export function normalizeLocale(value: unknown): AppLocale {
  return normalizeI18nLocale(typeof value === "string" ? value : undefined)
}

export function getBrowserLocale(fallback: AppLocale): AppLocale {
  if (typeof navigator === "undefined") {
    return fallback
  }

  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language]
  for (const candidate of candidates) {
    const matched = matchLocale(candidate)
    if (matched) {
      return matched
    }
  }
  return fallback
}

// 解析 Accept-Language 请求头，按 q 权重降序返回语言范围候选。
// 例："fr-FR,fr;q=0.9,en;q=0.8" → ["fr-FR", "fr", "en"]。
// 畸形分段（空 range、非法 q）直接丢弃，不抛错——头部是外部输入，容错优先。
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return []
  return header
    .split(",")
    .map((part) => {
      const [range, ...params] = part.split(";")
      let q = 1
      for (const param of params) {
        const matched = param.trim().match(/^q=([0-9.]+)$/)
        if (matched) {
          const value = Number(matched[1])
          if (Number.isFinite(value)) q = value
        }
      }
      return { range: range.trim(), q }
    })
    .filter((item) => item.range !== "")
    .sort((a, b) => b.q - a.q)
    .map((item) => item.range)
}

function parseLocaleCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=")
    if (index < 0) continue
    if (part.slice(0, index).trim() !== LOCALE_COOKIE_NAME) continue
    try {
      return decodeURIComponent(part.slice(index + 1).trim())
    } catch {
      return null
    }
  }
  return null
}

// SSR 首屏语言裁决，优先级：用户手动选择（cookie）> 浏览器语言
// （Accept-Language）> 站点默认语言（管理员配置，最终兜底）。
// Reason: loader 在服务端拿不到 localStorage/navigator，只能用请求头还原
// 同样的优先级，保证首屏一次算对，不出现“先管理员语言后闪切”的割裂。
export function resolveRequestLocale(options: {
  cookieHeader?: string | null
  acceptLanguageHeader?: string | null
  siteLanguage?: unknown
}): AppLocale {
  const siteDefault = normalizeLocale(options.siteLanguage)
  const stored = parseLocaleCookie(options.cookieHeader)
  if (stored) {
    const matched = matchLocale(stored)
    if (matched) return matched
  }
  for (const candidate of parseAcceptLanguage(options.acceptLanguageHeader)) {
    const matched = matchLocale(candidate)
    if (matched) return matched
  }
  return siteDefault
}

export function buildLocaleCookie(value: AppLocale): string {
  return `${LOCALE_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`
}

// 读手动选择：任一存储 key 有白名单内的值即视为手动模式，否则为“跟随浏览器”模式。
// 注意仅在客户端调用（含 typeof window 守卫，SSR 误调直接返回 null）。
export function readStoredLocale(): AppLocale | null {
  if (typeof window === "undefined") return null
  const stored =
    window.localStorage.getItem(LOCALE_STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY)
  return stored ? matchLocale(stored) : null
}

// 清除手动选择回到跟随模式：localStorage 与 cookie 必须双清，
// 否则 SSR 仍会读到旧 cookie 造成“清掉了还闪回旧语言”。
export function clearStoredLocale() {
  window.localStorage.removeItem(LOCALE_STORAGE_KEY)
  window.localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY)
  document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`
}
