import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const webRoot = resolve(import.meta.dirname, "..")
const repoRoot = resolve(webRoot, "..")

const read = (...parts) => readFileSync(resolve(...parts), "utf8")
const routeSource = read(webRoot, "app/routes/dashboard.settings.tsx")
const googleSource = read(repoRoot, "internal/pkg/google/google.go")
const githubSource = read(repoRoot, "internal/pkg/github/github.go")
const oidcSource = read(repoRoot, "internal/handlers/api/oidc_handlers.go")

// 前端展示的回调地址必须与后端发起授权时使用的 redirect_uri 完全一致，
// 因此直接从 Go 常量里取值，避免两边各写一份字符串后慢慢漂移。
function goStringConst(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`))
  assert.ok(match, `Go constant ${name} should exist`)
  return match[1]
}

const backendPaths = {
  googleLogin: goStringConst(googleSource, "CallbackPathLogin"),
  googleBind: goStringConst(googleSource, "CallbackPathBind"),
  githubLogin: goStringConst(githubSource, "AuthorizationCallbackURL"),
  oidc: goStringConst(oidcSource, "oidcCallbackPath"),
}

for (const [name, path] of Object.entries(backendPaths)) {
  assert.ok(path.startsWith("/user/signin/callback/"), `${name} should be a callback path`)
  assert.ok(
    routeSource.includes(`"${path}"`),
    `dashboard settings should display the ${name} callback path (${path})`
  )
}

// 前端常量必须集中定义，且按 provider 渲染，而不是散落硬编码。
const pathsStart = routeSource.indexOf("const OAUTH_CALLBACK_PATHS")
const pathsEnd = routeSource.indexOf("const OIDC_CALLBACK_PATH", pathsStart)
assert.ok(pathsStart >= 0 && pathsEnd > pathsStart, "callback paths should be declared in one place")
const pathsBlock = routeSource.slice(pathsStart, pathsEnd)
assert.ok(
  pathsBlock.includes("googleLogin:") && pathsBlock.includes("githubLogin:"),
  "both OAuth providers should be covered"
)
assert.ok(
  routeSource.includes("buildCallbackUrl(siteBase, paths.login)"),
  "login callback should be rendered for both providers"
)
assert.ok(
  routeSource.includes("buildCallbackUrl(siteBase, paths.bind)"),
  "Google bind callback should be rendered"
)
assert.ok(
  routeSource.includes("buildCallbackUrl(siteBase, OIDC_CALLBACK_PATH)"),
  "OIDC callback should be rendered"
)
assert.ok(
  routeSource.includes("useSiteBase(settings.baseURL)"),
  "callback URLs should derive from the system-configured site base URL"
)
assert.doesNotMatch(
  routeSource,
  /Register the callback URL shown in the release notes/,
  "OIDC hint should no longer point at release notes"
)

// 所有语言都要有回调地址相关字段与提示，缺失时会退化成显示 i18n key。
const locales = ["zh-CN", "en-US", "de-DE", "fr-FR", "ja-JP", "ko-KR", "ru-RU"]
const requiredKeys = [
  "callbackUrl:",
  "callbackUrlBind:",
  "callbackUrlBindTip:",
  "callbackUrlTip: {",
  "callbackCopied:",
  "callbackCopyFailed:",
  "copy:",
  "copied:",
  "issuerTip:",
]
for (const locale of locales) {
  const source = read(webRoot, "lib/i18n/messages", `${locale}.ts`)
  const start = source.indexOf("      login: {")
  assert.ok(start >= 0, `${locale} should have a login section`)
  const section = source.slice(start, source.indexOf("      upload: {", start))
  for (const key of requiredKeys) {
    assert.ok(section.includes(key), `${locale} login section should define ${key}`)
  }
}

console.log("dashboard oauth callback url tests passed")
