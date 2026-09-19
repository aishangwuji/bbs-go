import {
  matchLocale,
  normalizeLocale as normalizeI18nLocale,
} from "@/lib/i18n"

import type { AppLocale } from "./types"

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
