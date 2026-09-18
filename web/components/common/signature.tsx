import { cn } from "@/lib/utils"

// Signature 个性签名展示组件（楼层/帖子通用）
// 安全：html 为服务端 lute+bluemonday 白名单消毒后的片段，前端直接 dangerouslySetInnerHTML
// 视觉：.bbs-signature 提供虚线分隔、褪色小字、max-height 限高，防止签名喧宾夺主
export function Signature({
  html,
  className,
}: {
  html?: string
  className?: string
}) {
  if (!html) {
    return null
  }
  return (
    <div
      className={cn("bbs-signature", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
