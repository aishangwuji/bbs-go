import i18next, { createInstance, type i18n as I18nextInstance } from "i18next"
import { initReactI18next } from "react-i18next"

import deDE from "./messages/de-DE"
import enUS from "./messages/en-US"
import frFR from "./messages/fr-FR"
import jaJP from "./messages/ja-JP"
import koKR from "./messages/ko-KR"
import ruRU from "./messages/ru-RU"
import zhCN from "./messages/zh-CN"

export type Locale =
  | "en-US"
  | "zh-CN"
  | "de-DE"
  | "fr-FR"
  | "ja-JP"
  | "ko-KR"
  | "ru-RU"
export type TFunction = (key: string, params?: Record<string, string | number>) => string

export const messages = {
  "en-US": enUS,
  "zh-CN": zhCN,
  "de-DE": deDE,
  "fr-FR": frFR,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "ru-RU": ruRU,
} as const

export const supportedLocales = Object.keys(messages) as Locale[]

const resources = {
  "en-US": { translation: enUS },
  "zh-CN": { translation: zhCN },
  "de-DE": { translation: deDE },
  "fr-FR": { translation: frFR },
  "ja-JP": { translation: jaJP },
  "ko-KR": { translation: koKR },
  "ru-RU": { translation: ruRU },
}

const i18nextOptions = {
  fallbackLng: "en-US",
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
  react: {
    useSuspense: false,
  },
  resources,
  returnNull: false,
  initAsync: false,
} as const

// 主语言前缀：浏览器或站点配置可能只给出 "de"、"zh" 等，回退到受支持的完整区域码
const localeByPrefix: Record<string, Locale> = {
  en: "en-US",
  zh: "zh-CN",
  de: "de-DE",
  fr: "fr-FR",
  ja: "ja-JP",
  ko: "ko-KR",
  ru: "ru-RU",
}

// matchLocale 精确或按主语言前缀匹配受支持语言；不匹配返回 null。
// 与 normalizeLocale 分离的原因：浏览器语言探测需要「逐个候选尝试且不落入默认值」。
export function matchLocale(value: string | undefined | null): Locale | null {
  if (!value) {
    return null
  }
  if (Object.prototype.hasOwnProperty.call(messages, value)) {
    return value as Locale
  }
  const base = value.toLowerCase().split(/[-_]/)[0]
  return localeByPrefix[base] ?? null
}

export function normalizeLocale(value: string | undefined | null): Locale {
  return matchLocale(value) ?? "en-US"
}

export function createI18nextInstance(locale: Locale = "en-US"): I18nextInstance {
  const instance = createInstance()
  void instance.use(initReactI18next).init({
    ...i18nextOptions,
    lng: locale,
  })
  return instance
}

export function createT(locale: Locale): TFunction {
  const fixedT = createI18nextInstance(locale).getFixedT(locale)

  return (key, params) => {
    const value = fixedT(key, params)
    if (typeof value !== "string" || value === "") {
      return key
    }

    return value
  }
}

export const i18n = i18next
void i18n.use(initReactI18next).init({
  ...i18nextOptions,
  lng: "en-US",
})
