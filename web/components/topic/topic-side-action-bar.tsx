"use client"

import { ArrowUp } from "lucide-react"

import { useTopicActions } from "@/components/topic/topic-action-context"

// 侧边悬浮栏
// 话题详情正文底部已内联提供点赞/评论/收藏（TopicDetailActions），
// 浮动栏再放一份属重复操作，故只保留「回到顶部」这一页面独有的快捷入口。
export function TopicSideActionBar() {
  const { scrollToTop } = useTopicActions()

  return (
    <div className="fixed top-75 -ml-14.5 max-[1300px]:hidden">
      <div className="action-list flex flex-col">
        <button
          type="button"
          className="action"
          aria-label="top"
          onClick={scrollToTop}
        >
          <ArrowUp className="size-6 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
