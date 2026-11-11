import { createServer } from "node:http"
import { createReadStream, existsSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createRequestListener } from "@react-router/node"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env")
if (existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

const clientDir = path.join(root, "build/client")
const serverBuildPath = path.join(root, "build/server/index.js")
const port = Number(process.env.PORT || 3000)
const serverURL =
  process.env.BBSGO_SERVER_URL ||
  process.env.SERVER_URL
if (!serverURL) {
  throw new Error("BBSGO_SERVER_URL is required. Set it in web/.env.")
}

const build = await import(pathToFileURL(serverBuildPath).href)
const frameworkRequestListener = createRequestListener({
  build,
  mode: process.env.NODE_ENV || "production",
})

function contentType(file) {
  if (file.endsWith(".js")) return "text/javascript"
  if (file.endsWith(".css")) return "text/css"
  if (file.endsWith(".svg")) return "image/svg+xml"
  if (file.endsWith(".png")) return "image/png"
  if (file.endsWith(".ico")) return "image/x-icon"
  if (file.endsWith(".json")) return "application/json"
  return "application/octet-stream"
}

function resolveStaticFile(pathname) {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    return null
  }

  const filePath = path.resolve(clientDir, `.${decodedPath}`)
  const relativePath = path.relative(clientDir, filePath)
  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    relativePath === ""
  ) {
    return null
  }

  try {
    const stat = statSync(filePath)
    return stat.isFile() ? { filePath, size: stat.size } : null
  } catch {
    return null
  }
}

// 缓存分级：/assets/ 下全部是 Vite 产物，文件名带 8 位内容哈希，
// 内容一变文件名就变，所以可以永久缓存（immutable 让浏览器连条件请求都省掉）；
// 根级文件（favicon / logo / robots.txt）文件名不带哈希，只能短缓存，
// 否则管理员换 Logo 后老访客一年都看不到新图。
// 之前这里完全没设 Cache-Control，Cloudflare 会回落到默认的 max-age=14400，
// 边缘节点每一轮都要跨洋回源取几十个 2KB 的 chunk。
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
const SHORT_CACHE = "public, max-age=3600"
const HTML_CACHE = "no-cache"

function cacheControlFor(pathname) {
  return pathname.startsWith("/assets/") ? IMMUTABLE_CACHE : SHORT_CACHE
}

function shouldProxyToServer(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/res/") ||
    pathname === "/sitemap.xml"
  )
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`)

  if (shouldProxyToServer(url.pathname)) {
    try {
      const upstream = new URL(`${url.pathname}${url.search}`, serverURL)
      const proxyHeaders = new Headers()
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string" || Array.isArray(v)) {
          const lk = k.toLowerCase()
          if (lk !== "connection" && lk !== "keep-alive" && lk !== "host") {
            if (Array.isArray(v)) {
              for (const item of v) proxyHeaders.append(k, item)
            } else {
              proxyHeaders.set(k, v)
            }
          }
        }
      }
      proxyHeaders.set("host", upstream.host)

      const response = await fetch(upstream, {
        method: req.method,
        headers: proxyHeaders,
        body:
          req.method === "GET" || req.method === "HEAD" ? undefined : req,
        duplex: "half",
        signal: AbortSignal.timeout(30000),
      })

      res.statusCode = response.status
      response.headers.forEach((value, key) => {
        if (key === "content-encoding" || key === "content-length") {
          return
        }
        res.setHeader(key, value)
      })
      if (response.body) {
        for await (const chunk of response.body) {
          res.write(chunk)
        }
      }
      res.end()
    } catch (error) {
      res.statusCode = 502
      res.end(error instanceof Error ? error.message : String(error))
    }
    return
  }

  const staticFile = url.pathname === "/" ? null : resolveStaticFile(url.pathname)

  if (staticFile) {
    res.setHeader("Content-Type", contentType(staticFile.filePath))
    res.setHeader("Cache-Control", cacheControlFor(url.pathname))
    // 显式给出长度：Cloudflare 与浏览器都能据此判断完整性，也避免 chunked 编码开销
    res.setHeader("Content-Length", String(staticFile.size))
    if (req.method === "HEAD") {
      res.end()
      return
    }
    createReadStream(staticFile.filePath)
      .on("error", (error) => {
        if (!res.headersSent) {
          res.statusCode = 500
        }
        res.end(error instanceof Error ? error.message : String(error))
      })
      .pipe(res)
    return
  }

  // SSR 出来的 HTML 必须每次回源校验：里面嵌着当前登录用户的资料与脚本注入配置，
  // 一旦被中间层缓存就会串号。这里显式声明，不依赖 Cloudflare 的默认判断。
  res.setHeader("Cache-Control", HTML_CACHE)

  try {
    await frameworkRequestListener(req, res)
  } catch (error) {
    res.statusCode = 500
    res.end(error instanceof Error ? error.stack : String(error))
  }
}).listen(port, () => {
  console.log(`web SSR server listening on http://localhost:${port}`)
})
