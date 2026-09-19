import * as React from "react"
import { useLoaderData } from "react-router"
import { ExternalLink, Handshake, Info, Mail, Sparkles } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { apiFetch } from "@/lib/api/client"
import type { FriendLink } from "@/lib/api/misc"
import { useI18n } from "@/lib/i18n/provider"
import { localizedTitle, pageMeta, rootDataFromMatches } from "@/lib/seo"
import { useDocumentTitle } from "@/lib/use-document-title"
import { Button } from "@/components/ui/button"

function normalizeLinks(data: FriendLink[] | null | undefined): FriendLink[] {
  return Array.isArray(data) ? data : []
}

/**
 * 从 URL 中提取合法的主机名（用于拉取高清晰度 Favicon 图标）
 */
function getHostname(linkUrl?: string): string | null {
  if (!linkUrl) return null
  try {
    const formatted = linkUrl.startsWith("http://") || linkUrl.startsWith("https://")
      ? linkUrl
      : `https://${linkUrl}`
    const url = new URL(formatted)
    const host = url.hostname
    if (!host || host === "localhost" || host === "127.0.0.1") return null
    return host
  } catch {
    return null
  }
}

/**
 * 单个提供商/友链卡片（四阶梯容灾防护与微交互）
 */
function ProviderCard({ link }: { link: FriendLink }) {
  const host = React.useMemo(() => getHostname(link.url), [link.url])
  const [imgFailed, setImgFailed] = React.useState(false)

  // 计算首选图片源：若后台配置了 logo 则优先使用；否则使用 Google S2 的 64px 高清 Favicon
  const imgSrc = React.useMemo(() => {
    if (link.logo && link.logo.trim() !== "") {
      return link.logo
    }
    if (host) {
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
    }
    return null
  }, [link.logo, host])

  const titleText = link.title || host || "合作伙伴"
  const tooltipText = link.summary ? `${titleText} - ${link.summary}` : titleText

  return (
    <a
      href={link.url || "#"}
      target="_blank"
      rel="noreferrer noopener"
      title={tooltipText}
      className="provider group relative flex h-[72px] items-center justify-center overflow-hidden rounded-xl border border-amber-300/40 bg-white/80 p-2 text-center shadow-2xs backdrop-blur-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:bg-white hover:shadow-md dark:border-amber-500/20 dark:bg-neutral-900/60 dark:hover:border-amber-400/50 dark:hover:bg-neutral-900"
    >
      {imgSrc && !imgFailed ? (
        <img
          src={imgSrc}
          alt={titleText}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="max-h-11 max-w-[88%] object-contain transition-transform duration-200 group-hover:scale-105 filter drop-shadow-2xs"
          onError={() => setImgFailed(true)}
        />
      ) : (
        /* 平滑降级：首字母徽章 + 网站名称精简文本，保证不破图且视觉整洁 */
        <div className="flex w-full items-center justify-center gap-2 px-1">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-xs font-semibold text-amber-700 dark:bg-amber-400/20 dark:text-amber-300">
            {titleText.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate text-xs font-medium text-foreground/85 group-hover:text-amber-600 dark:group-hover:text-amber-400">
            {titleText}
          </span>
        </div>
      )}
    </a>
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

  const [showApplyGuide, setShowApplyGuide] = React.useState(false)

  return (
    <section className="main py-6">
      <div className="container max-w-6xl">
        {/* NodeSeek 风格结构化卡片与微金环境光容器 */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-[#fff9c2]/45 via-[#fffae0]/25 to-[#ffc010]/20 p-5 shadow-xs backdrop-blur-sm dark:border-amber-500/25 dark:from-amber-950/25 dark:via-neutral-900/80 dark:to-yellow-950/25 sm:p-7">
          {/* 装饰性微金环境光 */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-amber-400/10 blur-3xl dark:bg-amber-500/10" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 size-64 rounded-full bg-yellow-400/10 blur-3xl dark:bg-yellow-500/10" />

          {/* 头部区：标题、副标与数据指标 */}
          <div className="relative mb-6 flex flex-col justify-between gap-4 border-b border-amber-200/50 pb-5 dark:border-amber-500/15 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 shadow-2xs dark:bg-amber-400/20 dark:text-amber-300">
                  <Handshake className="size-5" />
                </span>
                <h1 className="text-xl font-bold tracking-tight text-amber-950 dark:text-amber-100 sm:text-2xl">
                  {t("pages.links.title") || "合作伙伴与友情链接"}
                </h1>
                <span className="hidden items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300 md:inline-flex">
                  <Sparkles className="size-3" />
                  Premium Partners
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 sm:text-sm">
                开放互联、携手共建。汇聚前沿科技、开发者生态与优质行业站点。
              </p>
            </div>

            {/* 统计指标与申请入口 */}
            <div className="flex items-center gap-3">
              <span className="rounded-lg border border-amber-300/40 bg-white/60 px-3 py-1.5 text-xs font-medium text-neutral-700 backdrop-blur-xs dark:border-amber-500/20 dark:bg-neutral-900/60 dark:text-neutral-300">
                已收录 <strong className="font-semibold text-amber-700 dark:text-amber-400">{links.length}</strong> 个伙伴
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowApplyGuide((prev) => !prev)}
                className="border-amber-300/50 bg-white/70 text-xs text-amber-900 hover:bg-amber-100/60 dark:border-amber-500/30 dark:bg-neutral-900/70 dark:text-amber-200 dark:hover:bg-neutral-800"
              >
                <Info className="mr-1 size-3.5" />
                {showApplyGuide ? "收起申请规范" : "申请友链"}
              </Button>
            </div>
          </div>

          {/* 友链申请指引折叠面板 */}
          {showApplyGuide && (
            <div className="relative mb-6 rounded-xl border border-amber-300/50 bg-amber-50/60 p-4 text-xs leading-relaxed text-amber-950 backdrop-blur-xs transition-all dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-100">
                <ExternalLink className="size-4" /> 友情链接及商务合作申请要求
              </div>
              <ul className="list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
                <li>
                  <strong>站点要求</strong>：网站稳定运营 3 个月以上，内容健康合规、无恶意广告或欺诈行为。
                </li>
                <li>
                  <strong>收录互惠</strong>：在申请前请先在贵站显著位置添加本站友链（名称：<strong>NodeSeek / BBS-Go</strong>，网址：<code>https://bbs.originagent.cn</code>）。
                </li>
                <li>
                  <strong>Logo 规范</strong>：欢迎提供透明背景的矢量 SVG 或高清 PNG Logo，我们将呈现最佳的徽标墙展示效果。
                </li>
              </ul>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/60 pt-3 text-xs text-neutral-600 dark:border-amber-500/20 dark:text-neutral-400">
                <span>如需定制赞助商席位或快速收录，请通过站内私信或邮件联系。</span>
                <a
                  href="mailto:admin@originagent.cn"
                  className="inline-flex items-center gap-1 font-medium text-amber-700 hover:underline dark:text-amber-400"
                >
                  <Mail className="size-3.5" /> 联系管理员 (admin@originagent.cn)
                </a>
              </div>
            </div>
          )}

          {/* 核心提供商网格：CSS Grid 流式自适应 (NodeSeek 风格徽标墙) */}
          {links.length > 0 ? (
            <div className="provider-grid-container grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(135px,1fr))] sm:gap-3.5">
              {links.map((link) => (
                <ProviderCard key={link.id} link={link} />
              ))}
            </div>
          ) : (
            <div className="py-12">
              <EmptyState title={t("common.noData") || "暂无友情链接"} />
            </div>
          )}

          {/* 底部微转化 CTA 条 */}
          <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-amber-200/40 pt-4 text-xs text-neutral-600 dark:border-amber-500/15 dark:text-neutral-400 sm:flex-row">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              伙伴状态实时健康监控中，排名不分先后。
            </span>
            <span className="text-muted-foreground/80">
              期待与更多优质创作者与开发者同行
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
