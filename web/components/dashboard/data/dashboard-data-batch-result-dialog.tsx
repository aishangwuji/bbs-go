"use client"

import { CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog"
import { msgSuccess } from "@/lib/toast"
import { cn } from "@/lib/utils"

import type { DashboardDataBatchResult } from "./dashboard-data-types"
import {
  dashboardDataRecordLabel,
  dashboardDataRowKey,
} from "./dashboard-data-utils"

// 批量结果汇总：逐条展示成功明细（如新密码）或失败原因，明细行支持一键复制全部
export function DashboardDataBatchResultDialog({
  result,
  summary,
  successText,
  copyLabel,
  copiedMessage,
  closeLabel,
  onClose,
}: {
  result: DashboardDataBatchResult | null
  summary: (ok: number, fail: number) => string
  successText: string
  copyLabel: string
  copiedMessage: string
  closeLabel: string
  onClose: () => void
}) {
  if (!result) return null
  const okCount = result.items.filter((item) => item.ok).length
  const failCount = result.items.length - okCount
  const detailLines = result.items.map((item) => {
    const label = dashboardDataRecordLabel(item.record)
    const detail = item.message || (item.ok ? successText : "")
    return detail ? `${label}：${detail}` : label
  })

  return (
    <DashboardDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={result.title}
      size="md"
      footer={
        <>
          {detailLines.length ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(detailLines.join("\n"))
                msgSuccess(copiedMessage)
              }}
            >
              <CopyIcon />
              {copyLabel}
            </Button>
          ) : null}
          <Button type="button" onClick={onClose}>
            {closeLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        {summary(okCount, failCount)}
      </p>
      <ul className="grid max-h-80 gap-1.5 overflow-y-auto">
        {result.items.map((item, index) => (
          <li
            key={dashboardDataRowKey(item.record, index)}
            className={cn(
              "flex items-baseline justify-between gap-3 rounded-md border px-3 py-2 text-sm",
              !item.ok && "border-destructive/30 bg-destructive/5"
            )}
          >
            <span className="min-w-0 truncate font-medium">
              {dashboardDataRecordLabel(item.record)}
            </span>
            <span
              className={cn(
                "shrink-0 font-mono text-xs",
                item.ok ? "text-muted-foreground" : "text-destructive"
              )}
            >
              {item.message || (item.ok ? successText : "")}
            </span>
          </li>
        ))}
      </ul>
    </DashboardDialog>
  )
}
