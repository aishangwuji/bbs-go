import { useLoaderData } from "react-router"

import { EmptyState } from "@/components/common/empty-state"
import { WidgetCard } from "@/components/common/widget-card"
import { useAppConfig } from "@/components/app/app-provider"
import { apiFetch } from "@/lib/api/client"
import type { FriendLink } from "@/lib/api/misc"
import { useI18n } from "@/lib/i18n/provider"
import { localizedTitle, pageMeta, rootDataFromMatches } from "@/lib/seo"
import { useDocumentTitle } from "@/lib/use-document-title"

function normalizeLinks(data: FriendLink[] | null | undefined) {
  return Array.isArray(data) ? data : []
}

function getFaviconUrl(linkUrl: string | undefined): string | null {
  if (!linkUrl) return null
  try {
    const url = new URL(linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`)
    const host = url.hostname
    if (!host || host === "localhost" || host === "127.0.0.1") return null
    // Google S2 实时获取，不存储；sz=32 清晰且轻量，支持多域名
    // 备选：https://icon.horse/icon/${host} 或 https://t2.gstatic.com/faviconV2?url=${encodeURIComponent(linkUrl)}&size=32
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`
  } catch {
    return null
  }
}

function FaviconImg({ url, title }: { url?: string; title?: string }) {
  const src = getFaviconUrl(url)
  if (!src) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
        {(title || "?").slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="size-8 shrink-0 rounded-md border bg-white object-contain p-0.5"
      onError={(e) => {
        // 失败回退为首字母占位，避免破图
        const target = e.currentTarget
        target.style.display = "none"
        const fallback = target.nextElementSibling as HTMLElement | null
        if (fallback) fallback.style.display = "flex"
      }}
    />
  )
}

export async function loader({ request }: { request: Request }) {
  return apiFetch<FriendLink[] | null>("/api/link/list", { request })
    .then(normalizeLinks)
    .catch(() => [])
}

export async function clientLoader() {
  return apiFetch<FriendLink[] | null>("/api/link/list")
    .then(normalizeLinks)
    .catch(() => [])
}

export function meta({
  location,
  matches,
}: {
  location: { pathname: string }
  matches: Array<{ data?: unknown; loaderData?: unknown }>
}) {
  const rootData = rootDataFromMatches(matches)
  return pageMeta(
    rootData?.config,
    localizedTitle(rootData?.locale, "Links", "友情链接"),
    { canonicalPath: location.pathname }
  )
}

export default function LinksRoute() {
  const links = useLoaderData<typeof loader>()
  const { t } = useI18n()
  useDocumentTitle(t("pages.links.title"), { appendSiteTitle: false })
  const config = useAppConfig()
  const showFavicon = config?.linkPageConfig?.showFavicon !== false

  return (
    <section className="main">
      <div className="container">
        <WidgetCard title={t("pages.links.title")}>
          {links.length ? (
            <ul className="links grid gap-3 px-[15px] py-4 sm:grid-cols-2">
              {links.map((link) => (
                <li
                  key={link.id}
                  className="link group flex gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  {showFavicon ? (
                    <div className="relative shrink-0">
                      <FaviconImg url={link.url} title={link.title} />
                      <span
                        className="hidden size-8 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground"
                        style={{ display: "none" }}
                      >
                        {(link.title || "?").slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <a
                      href={link.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="link-title line-clamp-1 text-sm font-medium hover:underline"
                      title={link.title}
                    >
                      {link.title}
                    </a>
                    {link.summary ? (
                      <p className="link-summary mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {link.summary}
                      </p>
                    ) : (
                      <p className="mt-1 truncate text-xs text-muted-foreground/70">
                        {link.url}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("common.noData")} />
          )}
        </WidgetCard>
      </div>
    </section>
  )
}
