"use client"

import * as React from "react"
import { DashboardPagination } from "@/components/dashboard/pagination-controls"
import { useI18n } from "@/lib/i18n/provider"
import type { AdminRecord } from "@/lib/api/admin"

export type DashboardDataFeedListProps<T extends AdminRecord = AdminRecord> = {
  records: T[]
  loading: boolean
  page: number
  pageCount: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor?: (item: T, index: number) => string | number
  emptyText?: string
  loadingText?: string
  className?: string
  listClassName?: string
}

export function DashboardDataFeedList<T extends AdminRecord = AdminRecord>({
  records,
  loading,
  page,
  pageCount,
  total,
  limit,
  onPageChange,
  onLimitChange,
  renderItem,
  keyExtractor,
  emptyText,
  loadingText,
  className = "flex flex-col gap-4",
  listClassName = "overflow-hidden rounded-lg border bg-[var(--dashboard-panel)] shadow-xs divide-y",
}: DashboardDataFeedListProps<T>) {
  const { t } = useI18n()
  const resolvedEmptyText = emptyText ?? t("common.noData")
  const resolvedLoadingText = loadingText ?? t("dashboard.loading")

  return (
    <div className={className}>
      <section className={listClassName} aria-busy={loading}>
        {loading && records.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            {resolvedLoadingText}
          </div>
        ) : records.length ? (
          records.map((item, index) => {
            const key = keyExtractor
              ? keyExtractor(item, index)
              : String(item.id ?? index)
            return (
              <React.Fragment key={key}>
                {renderItem(item, index)}
              </React.Fragment>
            )
          })
        ) : (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            {resolvedEmptyText}
          </div>
        )}
      </section>

      <DashboardPagination
        page={page}
        pageCount={pageCount}
        total={total}
        limit={limit}
        loading={loading}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    </div>
  )
}
