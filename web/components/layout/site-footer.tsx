"use client"

import Link from "@/components/common/link"

import { useAppConfig, useAppLocale } from "@/components/app/app-provider"
import type { Locale } from "@/lib/i18n"
import { useI18n } from "@/lib/i18n/provider"

function localizedText(
  value: Record<string, string> | undefined,
  locale: Locale
) {
  if (!value) {
    return ""
  }

  return value[locale] || value["en-US"] || value["zh-CN"] || ""
}

function isInternalUrl(url: string | undefined) {
  return Boolean(url?.startsWith("/"))
}

export function SiteFooter() {
  const config = useAppConfig()
  const locale = useAppLocale()
  const { t } = useI18n()
  const links =
    config?.footerLinks?.filter(
      (item) => item.visible !== false && localizedText(item.text, locale)
    ) ?? []

  return (
    <section className="main">
      <div className="container">
        <footer className="footer">
          {links.length ? (
            <div className="footer-links">
              {links.map((item, index) => {
                const label = localizedText(item.text, locale)
                const key = `${item.url || "text"}-${index}`

                if (item.url && isInternalUrl(item.url)) {
                  return (
                    <Link
                      key={key}
                      href={item.url}
                      className="hover:text-foreground"
                    >
                      {label}
                    </Link>
                  )
                }

                if (item.url) {
                  return (
                    <a
                      key={key}
                      href={item.url}
                      target={item.openInNewWindow ? "_blank" : undefined}
                      rel={
                        item.openInNewWindow ? "noopener noreferrer" : undefined
                      }
                      className="hover:text-foreground"
                    >
                      {label}
                    </a>
                  )
                }

                return <span key={key}>{label}</span>
              })}
            </div>
          ) : null}
          {/* 去品牌化 2026-09-18：已移除 Powered by BBS-GO（原外链 https://bbs-go.com） */}
        </footer>
      </div>
    </section>
  )
}
