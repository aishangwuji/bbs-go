"use client"

import * as React from "react"
import Link from "@/components/common/link"
import type { Pagination } from "@/lib/api/types"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

export interface CommentPagerProps {
  pagination?: Pagination
  entityType?: string
  entityId?: number | string
  basePath?: string
  className?: string
  onPageChange?: (page: number) => void
}

export function CommentPager({
  pagination,
  entityId,
  basePath,
  className,
  onPageChange,
}: CommentPagerProps) {
  const { t } = useI18n()

  if (!pagination || pagination.totalPages <= 1) {
    return null
  }

  const rootPath = basePath || (entityId ? `/topic/${entityId}` : "")

  const getPageHref = (page: number) => {
    if (!rootPath) return `?page=${page}`
    return page === 1 ? rootPath : `${rootPath}?page=${page}`
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, page: number) => {
    if (onPageChange) {
      e.preventDefault()
      onPageChange(page)
    }
  }

  const prevText = t("common.pagination.prev") || "« 上一页"
  const nextText = t("common.pagination.next") || "下一页 »"

  return (
    <div className={cn("flex items-center justify-end py-2 select-none", className)}>
      <nav
        role="navigation"
        aria-label="pagination"
        className="flex flex-wrap items-center gap-1 text-xs font-medium"
      >
        {/* 上一页 */}
        {pagination.hasPrev ? (
          <Link
            href={getPageHref(pagination.prevPage)}
            rel="prev"
            aria-label="Previous page"
            className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
            onClick={(e) => handleClick(e, pagination.prevPage)}
          >
            {prevText}
          </Link>
        ) : null}

        {/* 第一页（当滑动窗口起始页大于 1 时） */}
        {pagination.pageList.length > 0 && pagination.pageList[0] > 1 ? (
          <>
            <Link
              href={getPageHref(1)}
              aria-label="Page 1"
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-background px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
              onClick={(e) => handleClick(e, 1)}
            >
              1
            </Link>
            {pagination.pageList[0] > 2 ? (
              <span className="inline-flex h-8 items-center px-1 text-muted-foreground">
                ...
              </span>
            ) : null}
          </>
        ) : null}

        {/* 中间页码列表 */}
        {pagination.pageList.map((p) =>
          p === pagination.currentPage ? (
            <span
              key={p}
              aria-current="page"
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-primary px-3 font-semibold text-primary-foreground shadow-xs"
            >
              {p}
            </span>
          ) : (
            <Link
              key={p}
              href={getPageHref(p)}
              aria-label={`Page ${p}`}
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-background px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
              onClick={(e) => handleClick(e, p)}
            >
              {p}
            </Link>
          )
        )}

        {/* 最后一页（当滑动窗口结束页小于总页数时） */}
        {pagination.pageList.length > 0 &&
        pagination.pageList[pagination.pageList.length - 1] <
          pagination.totalPages ? (
          <>
            {pagination.pageList[pagination.pageList.length - 1] <
            pagination.totalPages - 1 ? (
              <span className="inline-flex h-8 items-center px-1 text-muted-foreground">
                ...
              </span>
            ) : null}
            <Link
              href={getPageHref(pagination.totalPages)}
              aria-label={`Page ${pagination.totalPages}`}
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-background px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
              onClick={(e) => handleClick(e, pagination.totalPages)}
            >
              {pagination.totalPages}
            </Link>
          </>
        ) : null}

        {/* 下一页 */}
        {pagination.hasNext ? (
          <Link
            href={getPageHref(pagination.nextPage)}
            rel="next"
            aria-label="Next page"
            className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
            onClick={(e) => handleClick(e, pagination.nextPage)}
          >
            {nextText}
          </Link>
        ) : null}
      </nav>
    </div>
  )
}
