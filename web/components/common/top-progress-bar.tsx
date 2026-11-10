"use client"

import * as React from "react"
import { useNavigation } from "react-router"

export function TopProgressBar() {
  const navigation = useNavigation()
  const isNavigating = navigation.state !== "idle"

  const [progress, setProgress] = React.useState(0)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    let timer: NodeJS.Timeout
    let finishTimer: NodeJS.Timeout

    if (isNavigating) {
      setVisible(true)
      setProgress(20)

      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) {
            return prev
          }
          const step = Math.max(1, (85 - prev) * 0.15)
          return Math.min(85, prev + step)
        })
      }, 150)
    } else {
      // 导航完成：先冲到 100%，随后淡出重置
      setProgress(100)
      finishTimer = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
    }

    return () => {
      clearInterval(timer)
      clearTimeout(finishTimer)
    }
  }, [isNavigating])

  if (!visible && progress === 0) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[99999] h-[2.5px] w-full"
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] transition-all ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          transitionDuration: progress === 100 ? "200ms" : "300ms",
        }}
      >
        {/* 右边缘发光光点 */}
        <div className="absolute right-0 top-[-2px] h-[6px] w-[80px] -rotate-2 transform rounded-full bg-primary/70 blur-[3px]" />
      </div>
    </div>
  )
}
