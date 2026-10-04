"use client"

import { Button } from "@/components/ui/button"

import type { DashboardDataBatchAction } from "./dashboard-data-types"

// 批量操作栏：仅在有勾选时出现（count>0），按钮来自各页 config.batchActions（已按权限过滤）
export function DashboardDataBatchBar({
  count,
  selectedLabel,
  clearLabel,
  actions,
  running,
  onRun,
  onClear,
}: {
  count: number
  selectedLabel: string
  clearLabel: string
  actions: DashboardDataBatchAction[]
  running: boolean
  onRun: (action: DashboardDataBatchAction) => void
  onClear: () => void
}) {
  if (count === 0 || actions.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-[var(--dashboard-panel)] px-3 py-2 text-sm shadow-xs">
      <span className="font-medium">{selectedLabel}</span>
      {actions.map((action) => (
        <Button
          key={action.label}
          type="button"
          size="sm"
          variant="outline"
          disabled={running}
          onClick={() => onRun(action)}
        >
          {action.label}
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={running}
        onClick={onClear}
      >
        {clearLabel}
      </Button>
    </div>
  )
}
