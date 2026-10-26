import path from "node:path"
import { reactRouter } from "@react-router/dev/vite"
import { defineConfig, loadEnv, type Plugin } from "vite"

function stripSpaRouteLoaders(): Plugin {
  // Vite 的模块 id 在 Windows 上也统一为正斜杠，若用 path.sep 拼字符串，
  // Windows 下永远匹配不到路由文件，SPA 模式会因 loader 导出直接构建失败。
  const appRoutesPattern = /[/\\]app[/\\]routes[/\\]/

  return {
    name: "bbsgo-strip-spa-route-loaders",
    enforce: "pre",
    transform(code, id) {
      if (
        process.env.BBSGO_WEB_SPA !== "true" ||
        !appRoutesPattern.test(id)
      ) {
        return null
      }

      const nextCode = code
        .replace(
          /^\s*export\s*\{\s*loader\s*\}\s*from\s*["'][^"']+["'];?\s*$/gm,
          ""
        )
        .replace(/\bexport\s+(async\s+function\s+loader\b)/g, "$1")
        .replace(/\bexport\s+(function\s+loader\b)/g, "$1")
        .replace(/\bexport\s+(const\s+loader\s*=)/g, "$1")

      return nextCode === code ? null : { code: nextCode, map: null }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "")
  const serverURL = env.BBSGO_SERVER_URL

  if (!serverURL) {
    throw new Error("BBSGO_SERVER_URL is required. Set it in web/.env.")
  }
  process.env.BBSGO_SERVER_URL = serverURL

  return {
    plugins: [stripSpaRouteLoaders(), reactRouter()],
    optimizeDeps: {
      include: ["md-editor-rt"],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname),
        "tailwindcss": path.resolve(
          __dirname,
          "node_modules/tailwindcss/index.css"
        ),
      },
    },
    server: {
      port: 3000,
      proxy: {
        "/api": serverURL,
        "/res": serverURL,
        "/sitemap.xml": serverURL,
      },
    },
  }
})
