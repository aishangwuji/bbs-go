"use client"

import * as React from "react"
import { Eye, X, ArrowRightLeft } from "lucide-react"

import { useSpaceView } from "@/components/user/space-view-context"
import { Button } from "@/components/ui/button"

// PreviewTipsBar 个人空间视角预览提示条（参考 Bilibili 空间体验）
// 仅在空间号主主动开启预览模式（isMocking 为 true）时渲染
export function PreviewTipsBar() {
  const { previewMode, isMocking, setPreviewMode } = useSpaceView()

  if (!isMocking || !previewMode) {
    return null
  }

  const isFans = previewMode === "fans"
  const roleName = isFans ? "粉丝" : "访客"
  const alternateRole = isFans ? "visitor" : "fans"
  const alternateRoleName = isFans ? "访客视角" : "粉丝视角"

  return (
    <div className="relative z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-950 backdrop-blur-sm dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 animate-pulse" />
        <span>
          当前正处于预览模式：<strong>这是我的空间在{roleName}眼中的样子</strong>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPreviewMode(alternateRole)}
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 underline-offset-4 hover:underline dark:text-amber-300"
        >
          <ArrowRightLeft className="h-3 w-3" />
          切换为{alternateRoleName}
        </button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setPreviewMode(null)}
          className="h-7 border-amber-500/40 bg-background/80 px-2.5 text-xs text-foreground hover:bg-amber-500/20"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          关闭预览
        </Button>
      </div>
    </div>
  )
}
