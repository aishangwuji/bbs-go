"use client"

import { useSyncExternalStore } from "react"
import { CheckIcon, GlobeIcon, LanguagesIcon } from "lucide-react"

import { useAppConfig } from "@/components/app/app-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  clearStoredLocale,
  getBrowserLocale,
  normalizeLocale,
  readStoredLocale,
} from "@/app/route-helpers/locale"
import type { Locale } from "@/lib/i18n"
import { useI18n } from "@/lib/i18n/provider"

const languageOptions: Array<{
  value: Locale
  label: string
}> = [
  { value: "en-US", label: "English" },
  { value: "zh-CN", label: "中文" },
  { value: "de-DE", label: "Deutsch" },
  { value: "fr-FR", label: "Français" },
  { value: "ja-JP", label: "日本語" },
  { value: "ko-KR", label: "한국어" },
  { value: "ru-RU", label: "Русский" },
]

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()
  const config = useAppConfig()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const activeLocale = mounted ? locale : "en-US"
  // “跟随浏览器”模式 = 无任何手动选择残留（localStorage 双 key 皆空）；
  // 未挂载时不下结论，避免 SSR 与首屏 hydration 不一致。
  const isAuto = mounted && readStoredLocale() === null

  function selectAuto() {
    clearStoredLocale()
    // 清掉后立即按浏览器重算并生效，不等下次 effect，菜单关闭时语言已经切对。
    // 兜底用站点默认语言（与 SSR 裁决的最后一级一致）。
    setLocale?.(getBrowserLocale(normalizeLocale(config?.language)))
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild aria-label={t("dashboard.header.language")}>
        <Button variant="outline" size="sm">
          <LanguagesIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 min-w-40">
        <DropdownMenuItem onSelect={selectAuto}>
          <GlobeIcon />
          {t("dashboard.header.followSystem")}
          <CheckIcon
            className={
              isAuto ? "ml-auto size-4 opacity-100" : "ml-auto size-4 opacity-0"
            }
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={activeLocale}
          onValueChange={(value) => setLocale?.(value as Locale)}
        >
          {languageOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <LanguagesIcon />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
