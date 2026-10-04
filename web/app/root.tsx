import * as React from "react"
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteLoaderData,
  useRouteError,
} from "react-router"

import { AppProvider, useAppConfig } from "@/components/app/app-provider"
import { ErrorPage } from "@/components/common/error-page"
import {
  InstallRequiredFallback,
  isInstallRequiredRouteError,
} from "@/components/install/install-required-fallback"
import { LayoutChrome } from "@/components/layout/layout-chrome"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { apiFetch } from "@/lib/api/client"
import type { SiteConfig, UserSummary } from "@/lib/api/types"
import { I18nProvider } from "@/lib/i18n/provider"
import {
  getRenderableScriptInjections,
  getScriptInjectionElementId,
} from "@/lib/script-injections"
import { siteMeta } from "@/lib/seo"

import type { Route } from "./+types/root"
import { rootDataContext } from "./route-helpers/context"
import {
  buildLocaleCookie,
  getBrowserLocale,
  normalizeLocale,
  resolveRequestLocale,
} from "./route-helpers/locale"
import type { RootLoaderData } from "./route-helpers/types"

import "@/styles/globals.css"

const LOCALE_STORAGE_KEY = "bbsgo-dashboard-locale"
const LEGACY_LOCALE_STORAGE_KEY = "bbsgo-web-locale"

const GoogleOneTap = React.lazy(() =>
  import("@/components/auth/google-one-tap").then((module) => ({
    default: module.GoogleOneTap,
  }))
)

async function loadRootData(request: Request): Promise<RootLoaderData> {
  const requestOptions = { request } as NonNullable<
    Parameters<typeof apiFetch>[1]
  > & { request: Request }
  const [config, currentUser] = await Promise.all([
    apiFetch<SiteConfig>("/api/config/configs", requestOptions).catch(
      () => null
    ),
    apiFetch<UserSummary>("/api/user/current", requestOptions).catch(
      () => null
    ),
  ])

  return {
    config,
    currentUser,
    // 首屏语言按“手动选择 > 浏览器 > 站点默认”裁决：loader 读不到 localStorage，
    // 用 cookie 还原手动选择、用 Accept-Language 还原浏览器语言，
    // 只有两者都缺席才用管理员配置的站点默认语言兜底。
    locale: resolveRequestLocale({
      cookieHeader: request.headers.get("cookie"),
      acceptLanguageHeader: request.headers.get("accept-language"),
      siteLanguage: config?.language,
    }),
    unreadMessageCount: 0,
  }
}

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<RootLoaderData> {
  const getRootData = context.get(rootDataContext)
  if (getRootData) return getRootData()

  return loadRootData(request)
}

export function meta({ data }: Route.MetaArgs) {
  return siteMeta(data?.config)
}

export function Layout({ children }: { children: React.ReactNode }) {
  const rootData = useRouteLoaderData<typeof loader>("root")
  const scriptInjections = getRenderableScriptInjections(
    rootData?.config?.scriptInjections
  )
  // 页签图标跟随后台「站点设置 → 站点 Logo」，管理员换 Logo 后页签同步更新，零额外配置；
  // 未配置时回退到内置品牌图标。apple-touch-icon 用现成的 364px Logo（iOS 会自动缩放）。
  const faviconHref = rootData?.config?.siteLogo || "/favicon.svg"

  return (
    <html lang={rootData?.locale || "en-US"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <link rel="icon" href={faviconHref} />
        <link rel="apple-touch-icon" href="/logo364x364.png" />
        {scriptInjections.map((script) =>
          script.type === "external" ? (
            <script
              key={script.key}
              id={getScriptInjectionElementId(script.key)}
              data-bbsgo-script-injection="true"
              src={script.src}
              async={script.async}
              defer={script.defer}
              crossOrigin={script.crossOrigin}
            />
          ) : (
            <script
              key={script.key}
              id={getScriptInjectionElementId(script.key)}
              data-bbsgo-script-injection="true"
              dangerouslySetInnerHTML={{ __html: script.code }}
            />
          )
        )}
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

function GoogleOneTapGate() {
  const config = useAppConfig()
  const googleLogin = config?.loginConfig?.googleLogin

  if (!googleLogin?.enabled || !googleLogin.clientId) {
    return null
  }

  return (
    <React.Suspense fallback={null}>
      <GoogleOneTap />
    </React.Suspense>
  )
}

function RuntimeScriptInjections() {
  const config = useAppConfig()
  const scriptInjections = React.useMemo(
    () => getRenderableScriptInjections(config?.scriptInjections),
    [config?.scriptInjections]
  )

  React.useEffect(() => {
    const expectedIds = new Set(
      scriptInjections.map((script) => getScriptInjectionElementId(script.key))
    )

    document
      .querySelectorAll<HTMLScriptElement>(
        "script[data-bbsgo-script-injection]"
      )
      .forEach((element) => {
        if (!expectedIds.has(element.id)) element.remove()
      })

    for (const script of scriptInjections) {
      const id = getScriptInjectionElementId(script.key)
      if (document.getElementById(id)) continue

      const element = document.createElement("script")
      element.id = id
      element.dataset.bbsgoScriptInjection = "true"

      if (script.type === "external") {
        element.src = script.src
        element.async = script.async
        element.defer = script.defer
        if (script.crossOrigin) element.crossOrigin = script.crossOrigin
      } else {
        element.text = script.code
      }

      document.head.appendChild(element)
    }
  }, [scriptInjections])

  return null
}

export default function Root() {
  const loaderData = useLoaderData<typeof loader>()
  const [locale, setLocale] = React.useState(loaderData.locale)

  React.useEffect(() => {
    const storedLocale =
      window.localStorage.getItem(LOCALE_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY)
    setLocale(
      normalizeLocale(storedLocale || getBrowserLocale(loaderData.locale))
    )
  }, [loaderData.locale])

  React.useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const updateLocale = React.useCallback((nextLocale: typeof locale) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale)
    window.localStorage.setItem(LEGACY_LOCALE_STORAGE_KEY, nextLocale)
    // 同步写 cookie：下次 SSR（刷新/直连/分享链接）首屏即用手动选择，不回闪。
    document.cookie = buildLocaleCookie(nextLocale)
    setLocale(nextLocale)
  }, [])

  const appState = React.useMemo(
    () => ({ ...loaderData, locale }),
    [loaderData, locale]
  )

  return (
    <I18nProvider locale={locale} setLocale={updateLocale}>
      <AppProvider initialState={appState}>
        <ThemeProvider>
          <TooltipProvider>
            <RuntimeScriptInjections />
            <GoogleOneTapGate />
            <LayoutChrome>
              <Outlet />
            </LayoutChrome>
            <Toaster position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </AppProvider>
    </I18nProvider>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  const installRequired = isInstallRequiredRouteError(error)
  const statusCode = isRouteErrorResponse(error) ? error.status : 500
  const message =
    error instanceof Error
      ? error.message
      : isRouteErrorResponse(error)
        ? error.statusText
        : undefined

  return (
    <I18nProvider locale="en-US">
      <AppProvider
        initialState={{
          config: null,
          currentUser: null,
          locale: "en-US",
          unreadMessageCount: 0,
        }}
      >
        <ThemeProvider>
          <TooltipProvider>
            <LayoutChrome>
              {installRequired ? (
                <InstallRequiredFallback />
              ) : (
                <ErrorPage statusCode={statusCode} message={message} />
              )}
            </LayoutChrome>
            <Toaster position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </AppProvider>
    </I18nProvider>
  )
}
