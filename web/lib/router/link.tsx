import type * as React from "react"
import { Link as RouterLink } from "react-router"

export type PrefetchOption = "none" | "intent" | "render" | "viewport"

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string
  prefetch?: boolean | PrefetchOption
}

export default function Link({ href, prefetch = "intent", ...props }: LinkProps) {
  if (/^(https?:)?\/\//.test(href) || href.startsWith("mailto:")) {
    return <a href={href} {...props} />
  }

  const routerPrefetch: PrefetchOption =
    typeof prefetch === "boolean" ? (prefetch ? "intent" : "none") : prefetch

  return <RouterLink to={href} prefetch={routerPrefetch} {...props} />
}
