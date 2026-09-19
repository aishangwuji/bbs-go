"use client"

import * as React from "react"
import Link from "@/components/common/link"
import { usePathname, useRouter } from "@/lib/router/navigation"
import {
  ChevronRight,
  Flag,
  LogIn,
  MessageCircle,
  ThumbsUp,
  Trash2,
} from "lucide-react"

import { UserAvatar } from "@/components/common/avatar"
import { UserHoverCard } from "@/components/user/user-hover-card"
import {
  ConfirmDialog,
  type ConfirmDialogState,
} from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import {
  HtmlImagePreview,
  PreviewableImage,
} from "@/components/common/image-preview"
import { LoadMoreButton } from "@/components/common/load-more"
import { UserReportDialog } from "@/components/common/user-report-dialog"
import {
  TextEditor,
  type TextEditorRef,
} from "@/components/comment/text-editor"
import { Signature } from "@/components/common/signature"
import { CommentPager } from "@/components/comment/comment-pager"
import { apiFetch, toFormData } from "@/lib/api/client"
import type {
  Comment,
  CommentPageData,
  EntityId,
  ImageInfo,
  PageData,
} from "@/lib/api/types"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"
import { userHasPermission } from "@/lib/auth/roles"
import { prettyDate } from "@/lib/format"
import { useI18n } from "@/lib/i18n/provider"
import { useAppConfig, useCurrentUser } from "@/components/app/app-provider"
import { buildSigninHref, toast, useToastActions } from "@/lib/toast"
import { cn } from "@/lib/utils"

type EntityType = "topic" | "article" | "comment" | string

type ReplyValue = {
  content: string
  imageList: ImageInfo[]
}

function imageSrc(image: ImageInfo) {
  return image.url || image.preview || ""
}

function commentContent(comment: Comment, size: "normal" | "small" = "normal") {
  if (!comment.content) {
    return null
  }

  const className = cn(
    "content mb-0 whitespace-pre-wrap text-foreground",
    size === "normal"
      ? "mt-2.5 text-[15px] leading-7"
      : "mt-1.5 text-sm leading-6"
  )

  if (comment.contentType === "text") {
    return <div className={className}>{comment.content}</div>
  }

  return <HtmlImagePreview html={comment.content} className={className} />
}

// CommentSignature 楼层个性签名
// 数据来源：后端 BuildUserInfo 已用 lute+bluemonday 白名单渲染为 signatureHtml（防 XSS）
// 安全：此处渲染的是服务端消毒后的 HTML，前端不再二次解析 Markdown
// 视觉：.bbs-signature 负责虚线分隔 + 限高 + 褪色，避免签名喧宾夺主
function CommentSignature({ html }: { html?: string }) {
  if (!html) {
    return null
  }
  return <Signature html={html} />
}

function CommentImages({
  images,
  size = "normal",
}: {
  images?: ImageInfo[]
  size?: "normal" | "small" | "quote"
}) {
  if (!images?.length) {
    return null
  }

  const imageClass =
    size === "normal"
      ? "h-[72px] w-[72px]"
      : size === "small"
        ? "h-[62px] w-[62px]"
        : "h-[50px] w-[50px]"

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        size === "quote" ? "mt-1" : size === "normal" ? "mt-2.5" : "mt-1.5"
      )}
    >
      {images.map((image, index) => (
        <PreviewableImage
          key={`${imageSrc(image)}-${index}`}
          src={imageSrc(image)}
          previewSrcList={images.map(imageSrc)}
          initialIndex={index}
          alt=""
          className={cn(
            imageClass,
            "cursor-pointer object-cover transition-all duration-500 ease-out hover:scale-[1.04]"
          )}
        />
      ))}
    </div>
  )
}

function useCommentActions() {
  const { t } = useI18n()
  const { catchError, msgSignIn } = useToastActions()
  const currentUser = useCurrentUser()

  return {
    t,
    currentUser,
    catchError,
    msgSignIn,
  }
}

function CommentInput({
  entityType,
  entityId,
  onCreated,
}: {
  entityType: EntityType
  entityId: EntityId
  onCreated: (comment: Comment) => void
}) {
  const { t } = useI18n()
  const { catchError } = useToastActions()
  const editorRef = React.useRef<TextEditorRef>(null)
  const [content, setContent] = React.useState("")
  const [imageList, setImageList] = React.useState<ImageInfo[]>([])
  const [sending, setSending] = React.useState(false)
  const lastClickTimeRef = React.useRef(0)

  async function create() {
    const now = Date.now()
    if (now - lastClickTimeRef.current < 500) {
      return
    }
    lastClickTimeRef.current = now

    if (!content) {
      toast.error(t("component.comment.input.pleaseInput"))
      return
    }
    if (sending) {
      return
    }

    setSending(true)
    try {
      const data = await apiFetch<Comment>("/api/comment/create", {
        method: "POST",
        body: toFormData({
          entityType,
          entityId,
          content,
          imageList: imageList.length ? JSON.stringify(imageList) : "",
        }),
      })
      onCreated(data)
      editorRef.current?.reset()
      setContent("")
      setImageList([])
      toast.success(t("component.comment.input.publishSuccess"))
    } catch (error) {
      catchError(error)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="my-2.5 bg-background">
      <div className="relative box-border overflow-hidden p-0">
        <TextEditor
          ref={editorRef}
          content={content}
          imageList={imageList}
          height={90}
          focusHeight={120}
          disabled={sending}
          onContentChange={setContent}
          onImageListChange={setImageList}
          onSubmit={() => void create()}
        />
      </div>
    </div>
  )
}

function InlineReplyEditor({
  value,
  onChange,
  onSubmit,
}: {
  value: ReplyValue
  onChange: (value: ReplyValue) => void
  onSubmit: () => void
}) {
  const editorRef = React.useRef<TextEditorRef>(null)

  React.useEffect(() => {
    window.setTimeout(() => editorRef.current?.focus(), 100)
  }, [])

  return (
    <TextEditor
      ref={editorRef}
      content={value.content}
      imageList={value.imageList}
      height={80}
      onContentChange={(content) => onChange({ ...value, content })}
      onImageListChange={(imageList) => onChange({ ...value, imageList })}
      onSubmit={onSubmit}
    />
  )
}

function CommentSubList({
  commentId,
  data,
  onReply,
}: {
  commentId: number
  data: PageData<Comment>
  onReply: (comment: Comment) => void
}) {
  const { t, currentUser, catchError, msgSignIn } = useCommentActions()
  const [replies, setReplies] = React.useState(data)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [replyQuoteId, setReplyQuoteId] = React.useState(0)
  const [replyValue, setReplyValue] = React.useState<ReplyValue>({
    content: "",
    imageList: [],
  })
  const [reportComment, setReportComment] = React.useState<Comment | null>(null)
  const [confirmState, setConfirmState] =
    React.useState<ConfirmDialogState>(null)

  async function loadMore() {
    if (loadingMore || !replies.hasMore) {
      return
    }
    setLoadingMore(true)
    try {
      const ret = await apiFetch<PageData<Comment>>("/api/comment/replies", {
        params: { commentId, cursor: replies.cursor || "" },
      })
      setReplies((current) => ({
        cursor: ret.cursor,
        hasMore: ret.hasMore,
        results: [...(current.results || []), ...(ret.results || [])],
      }))
    } catch (error) {
      catchError(error)
    } finally {
      setLoadingMore(false)
    }
  }

  async function toggleLike(comment: Comment) {
    try {
      if (comment.liked) {
        await apiFetch<null>("/api/like/unlike", {
          method: "POST",
          body: toFormData({ entityType: "comment", entityId: comment.id }),
        })
        setReplies((current) => ({
          ...current,
          results: current.results.map((item) =>
            item.id === comment.id
              ? {
                  ...item,
                  liked: false,
                  likeCount: Math.max(0, (item.likeCount || 0) - 1),
                }
              : item
          ),
        }))
      } else {
        await apiFetch<null>("/api/like/like", {
          method: "POST",
          body: toFormData({ entityType: "comment", entityId: comment.id }),
        })
        setReplies((current) => ({
          ...current,
          results: current.results.map((item) =>
            item.id === comment.id
              ? {
                  ...item,
                  liked: true,
                  likeCount: (item.likeCount || 0) + 1,
                }
              : item
          ),
        }))
      }
    } catch (error) {
      catchError(error)
    }
  }

  function switchShowReply(comment: Comment) {
    if (!currentUser) {
      msgSignIn()
      return
    }
    if (replyQuoteId === comment.id) {
      setReplyQuoteId(0)
      setReplyValue({ content: "", imageList: [] })
    } else {
      setReplyQuoteId(comment.id)
    }
  }

  async function submitReply() {
    try {
      const ret = await apiFetch<Comment>("/api/comment/create", {
        method: "POST",
        body: toFormData({
          entityType: "comment",
          entityId: commentId,
          quoteId: replyQuoteId,
          content: replyValue.content,
          imageList: replyValue.imageList.length
            ? JSON.stringify(replyValue.imageList)
            : "",
        }),
      })
      setReplyQuoteId(0)
      setReplyValue({ content: "", imageList: [] })
      onReply(ret)
    } catch (error) {
      catchError(error)
    }
  }

  async function deleteReply(comment: Comment) {
    try {
      await apiFetch<null>(`/api/comment/delete/${comment.id}`, {
        method: "POST",
      })
      setReplies((current) => ({
        ...current,
        results: current.results.filter((item) => item.id !== comment.id),
      }))
      toast.success(t("component.comment.deleteSuccess"))
    } catch (error) {
      catchError(error)
    }
  }

  function confirmDeleteReply(comment: Comment) {
    setConfirmState({
      description: t("component.comment.deleteConfirm"),
      confirmText: t("component.comment.subList.delete"),
      onConfirm: () => {
        void deleteReply(comment)
      },
    })
  }

  function showReport(comment: Comment) {
    if (!currentUser) {
      msgSignIn()
      return
    }
    setReportComment(comment)
  }

  return (
    <>
      <div className="mt-2.5 text-sm">
        {replies.results.map((comment) => (
          <div key={comment.id} className="flex py-2">
            <div>
              <UserHoverCard user={comment.user}>
                <UserAvatar user={comment.user} size={24} />
              </UserHoverCard>
            </div>
            <div className="ml-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <UserHoverCard user={comment.user}>
                    <Link
                      href={`/user/${comment.user.id}`}
                      className="truncate text-sm text-foreground hover:text-primary"
                    >
                      {comment.user.nickname ||
                        comment.user.username ||
                        comment.user.id}
                    </Link>
                  </UserHoverCard>
                  {comment.quote ? (
                    <>
                      &nbsp;
                      <span className="text-muted-foreground">
                        {t("component.comment.subList.replyTo")}
                      </span>
                      &nbsp;
                      <UserHoverCard user={comment.quote.user}>
                        <Link
                          href={`/user/${comment.quote.user.id}`}
                          className="text-sm text-foreground hover:text-primary"
                        >
                          {comment.quote.user.nickname ||
                            comment.quote.user.username ||
                            comment.quote.user.id}
                        </Link>
                      </UserHoverCard>
                    </>
                  ) : null}
                </div>
                {comment.createTime ? (
                  <time className="text-xs text-muted-foreground">
                    {prettyDate(comment.createTime, t)}
                  </time>
                ) : null}
              </div>
              <div>
                {commentContent(comment, "small")}
                <CommentImages images={comment.imageList} size="small" />
                {comment.quote ? (
                  <div className="relative my-1.5 box-border rounded border border-border bg-muted px-3 py-1 text-muted-foreground">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-2 right-0.5 text-3xl leading-none font-bold text-muted-foreground"
                    >
                      ”
                    </span>
                    <HtmlImagePreview
                      className="content my-1 text-muted-foreground"
                      html={comment.quote.content || ""}
                    />
                    <CommentImages
                      images={comment.quote.imageList}
                      size="quote"
                    />
                  </div>
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 text-xs text-muted-foreground select-none hover:text-primary",
                    comment.liked && "font-medium text-primary"
                  )}
                  onClick={() => void toggleLike(comment)}
                >
                  <ThumbsUp className="h-3 w-3" />
                  <span>
                    {comment.liked
                      ? t("component.comment.subList.liked")
                      : t("component.comment.subList.like")}
                  </span>
                  {comment.likeCount && comment.likeCount > 0 ? (
                    <span>{comment.likeCount}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 text-xs text-muted-foreground select-none hover:text-primary",
                    replyQuoteId === comment.id && "font-medium text-primary"
                  )}
                  onClick={() => switchShowReply(comment)}
                >
                  <MessageCircle className="h-3 w-3" />
                  <span>
                    {replyQuoteId === comment.id
                      ? t("component.comment.subList.cancelReply")
                      : t("component.comment.subList.reply")}
                  </span>
                </button>
                {currentUser?.id === comment.user.id ||
                userHasPermission(
                  currentUser,
                  PERMISSIONS.DASHBOARD_COMMENT_DELETE
                ) ? (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground select-none hover:text-destructive"
                    onClick={() => confirmDeleteReply(comment)}
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{t("component.comment.subList.delete")}</span>
                  </button>
                ) : null}
                {currentUser?.id !== comment.user.id ? (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground select-none hover:text-destructive"
                    onClick={() => showReport(comment)}
                  >
                    <Flag className="h-3 w-3" />
                    <span>{t("component.comment.subList.report")}</span>
                  </button>
                ) : null}
              </div>
              {replyQuoteId === comment.id ? (
                <div className="mt-2.5">
                  <InlineReplyEditor
                    value={replyValue}
                    onChange={setReplyValue}
                    onSubmit={() => void submitReply()}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {replies.hasMore === true ? (
          <div className="my-2.5 ml-[30px]">
            <button
              type="button"
              className="flex items-center text-[13px] text-foreground hover:text-primary"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              <span>{t("component.comment.subList.loadMore")}</span>
              <ChevronRight className="h-[13px] w-[13px] rotate-90" />
            </button>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        state={confirmState}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null)
        }}
      />
      <UserReportDialog
        open={Boolean(reportComment)}
        dataId={reportComment?.id || 0}
        dataType="comment"
        onOpenChange={(open) => {
          if (!open) setReportComment(null)
        }}
      />
    </>
  )
}

function CommentItem({
  comment,
  acceptedCommentId,
  allowAcceptAnswer,
  entityType,
  entityId,
  onChanged,
  onDeleted,
}: {
  comment: Comment
  acceptedCommentId: number
  allowAcceptAnswer: boolean
  entityType: EntityType
  entityId: EntityId
  onChanged: (comment: Comment) => void
  onDeleted: (comment: Comment) => void
}) {
  const { t, currentUser, catchError, msgSignIn } = useCommentActions()
  const canDeleteComment =
    currentUser?.id === comment.user.id ||
    userHasPermission(currentUser, PERMISSIONS.DASHBOARD_COMMENT_DELETE)
  const [replyCommentId, setReplyCommentId] = React.useState(0)
  const [replyValue, setReplyValue] = React.useState<ReplyValue>({
    content: "",
    imageList: [],
  })
  const [reportOpen, setReportOpen] = React.useState(false)
  const [confirmState, setConfirmState] =
    React.useState<ConfirmDialogState>(null)
  const isAccepted = acceptedCommentId === comment.id

  async function toggleLike() {
    try {
      if (comment.liked) {
        await apiFetch<null>("/api/like/unlike", {
          method: "POST",
          body: toFormData({ entityType: "comment", entityId: comment.id }),
        })
        onChanged({
          ...comment,
          liked: false,
          likeCount: Math.max(0, (comment.likeCount || 0) - 1),
        })
      } else {
        await apiFetch<null>("/api/like/like", {
          method: "POST",
          body: toFormData({ entityType: "comment", entityId: comment.id }),
        })
        onChanged({
          ...comment,
          liked: true,
          likeCount: (comment.likeCount || 0) + 1,
        })
      }
    } catch (error) {
      catchError(error)
    }
  }

  function switchShowReply() {
    if (!currentUser) {
      msgSignIn()
      return
    }
    if (replyCommentId === comment.id) {
      setReplyCommentId(0)
      setReplyValue({ content: "", imageList: [] })
    } else {
      setReplyCommentId(comment.id)
    }
  }

  async function submitReply(parent: Comment) {
    try {
      const ret = await apiFetch<Comment>("/api/comment/create", {
        method: "POST",
        body: toFormData({
          entityType: "comment",
          entityId: parent.id,
          content: replyValue.content,
          imageList: replyValue.imageList.length
            ? JSON.stringify(replyValue.imageList)
            : "",
        }),
      })
      setReplyCommentId(0)
      setReplyValue({ content: "", imageList: [] })
      onChanged(appendReply(parent, ret))
      toast.success(t("component.comment.list.publishSuccess"))
    } catch (error) {
      catchError(error)
    }
  }

  async function acceptAnswer() {
    try {
      await apiFetch<null>(`/api/topic/accept_answer/${entityId}`, {
        method: "POST",
        body: toFormData({ commentId: comment.id }),
      })
      toast.success(t("component.comment.list.acceptSuccess"))
      onChanged({ ...comment, accepted: true } as Comment)
    } catch (error) {
      catchError(error)
    }
  }

  async function unacceptAnswer() {
    try {
      await apiFetch<null>(`/api/topic/unaccept_answer/${entityId}`, {
        method: "POST",
      })
      toast.success(t("component.comment.list.unacceptSuccess"))
      onChanged({ ...comment, accepted: false } as Comment)
    } catch (error) {
      catchError(error)
    }
  }

  async function deleteComment() {
    try {
      await apiFetch<null>(`/api/comment/delete/${comment.id}`, {
        method: "POST",
      })
      toast.success(t("component.comment.deleteSuccess"))
      onDeleted(comment)
    } catch (error) {
      catchError(error)
    }
  }

  function confirmDeleteComment() {
    setConfirmState({
      description: t("component.comment.deleteConfirm"),
      confirmText: t("component.comment.list.delete"),
      onConfirm: () => {
        void deleteComment()
      },
    })
  }

  function showReport() {
    if (!currentUser) {
      msgSignIn()
      return
    }
    setReportOpen(true)
  }

  return (
    <>
      <div
        id={`comment-${comment.floor || comment.id}`}
        className={cn(
          "relative flex py-2.5 scroll-mt-24 rounded-sm transition-colors duration-500",
          isAccepted
            ? "mb-2 rounded-lg border border-primary/20 bg-primary/[0.06] p-3"
            : "border-b border-border last:border-b-0"
        )}
      >
        {comment.floor ? (
          <span
            id={`${comment.floor}`}
            className="pointer-events-none absolute -top-24"
            aria-hidden="true"
          />
        ) : null}
        <div>
          <UserHoverCard user={comment.user}>
            <UserAvatar user={comment.user} size={30} />
          </UserHoverCard>
        </div>
        <div className="ml-2.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <UserHoverCard user={comment.user}>
                <Link
                  href={`/user/${comment.user.id}`}
                  className="truncate text-[15px] text-foreground hover:text-primary"
                >
                  {comment.user.nickname ||
                    comment.user.username ||
                    comment.user.id}
                </Link>
              </UserHoverCard>
              {isAccepted ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-primary">
                  {t("component.comment.list.acceptedAnswer")}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5">
              {comment.createTime ? (
                <time className="text-[13px] text-muted-foreground">
                  {prettyDate(comment.createTime, t)}
                </time>
              ) : null}
              {comment.ipLocation ? (
                <span className="text-[13px] text-muted-foreground">
                  {t("component.comment.list.ipLocation")}
                  {comment.ipLocation}
                </span>
              ) : null}
              {comment.floor ? (
                <a
                  href={`#comment-${comment.floor}`}
                  className="rounded bg-muted/70 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
                  title={`第 ${comment.floor} 楼`}
                >
                  #{comment.floor}
                </a>
              ) : null}
            </div>
          </div>
          <div>
            {commentContent(comment)}
            <CommentImages images={comment.imageList} />
          </div>
          {/* 楼层签名：正文之后、操作栏之前，与正文视觉隔离 */}
          <CommentSignature html={comment.user?.signatureHtml} />
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              className={cn(
                "flex items-center gap-1 text-[13px] text-muted-foreground select-none hover:text-primary",
                comment.liked && "font-medium text-primary"
              )}
              onClick={() => void toggleLike()}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              <span>
                {comment.liked
                  ? t("component.comment.list.liked")
                  : t("component.comment.list.like")}
              </span>
              {comment.likeCount && comment.likeCount > 0 ? (
                <span>{comment.likeCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1 text-[13px] text-muted-foreground select-none hover:text-primary",
                replyCommentId === comment.id && "font-medium text-primary"
              )}
              onClick={switchShowReply}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>
                {replyCommentId === comment.id
                  ? t("component.comment.list.cancelReply")
                  : t("component.comment.list.reply")}
              </span>
            </button>
            {allowAcceptAnswer && entityType === "topic" ? (
              <button
                type="button"
                className="flex items-center gap-1 text-[13px] text-muted-foreground select-none hover:text-primary"
                onClick={() =>
                  isAccepted ? void unacceptAnswer() : void acceptAnswer()
                }
              >
                <span>
                  {isAccepted
                    ? t("component.comment.list.unacceptAnswer")
                    : t("component.comment.list.acceptAnswer")}
                </span>
              </button>
            ) : null}
            {canDeleteComment ? (
              <button
                type="button"
                className="flex items-center gap-1 text-[13px] text-muted-foreground select-none hover:text-destructive"
                onClick={confirmDeleteComment}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t("component.comment.list.delete")}</span>
              </button>
            ) : null}
            {currentUser?.id !== comment.user.id ? (
              <button
                type="button"
                className="flex items-center gap-1 text-[13px] text-muted-foreground select-none hover:text-destructive"
                onClick={showReport}
              >
                <Flag className="h-3.5 w-3.5" />
                <span>{t("component.comment.list.report")}</span>
              </button>
            ) : null}
          </div>
          {replyCommentId === comment.id ? (
            <div className="mt-2.5">
              <InlineReplyEditor
                value={replyValue}
                onChange={setReplyValue}
                onSubmit={() => void submitReply(comment)}
              />
            </div>
          ) : null}
          {comment.replies?.results?.length ? (
            <CommentSubList
              key={`${comment.id}-${comment.replies.results.length}-${comment.replies.cursor || ""}`}
              commentId={comment.id}
              data={comment.replies}
              onReply={(reply) => onChanged(appendReply(comment, reply))}
            />
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        state={confirmState}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null)
        }}
      />
      <UserReportDialog
        open={reportOpen}
        dataId={comment.id}
        dataType="comment"
        onOpenChange={setReportOpen}
      />
    </>
  )
}

function appendReply(parent: Comment, reply: Comment): Comment {
  if (parent.replies?.results) {
    return {
      ...parent,
      replies: {
        ...parent.replies,
        results: [...parent.replies.results, reply],
      },
    }
  }

  return {
    ...parent,
    replies: {
      cursor: "",
      hasMore: false,
      results: [reply],
    },
  }
}

export function CommentSection({
  entityType,
  entityId,
  commentCount,
  title,
  acceptedCommentId = 0,
  allowAcceptAnswer = false,
  initialData,
  onCreated,
}: {
  entityType: EntityType
  entityId: EntityId
  commentCount?: number
  title?: string
  acceptedCommentId?: number
  allowAcceptAnswer?: boolean
  initialData?: CommentPageData
  onCreated?: (comment: Comment) => void
}) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const config = useAppConfig()
  const currentUser = useCurrentUser()
  const [pageData, setPageData] = React.useState<CommentPageData>(
    initialData || { cursor: "", hasMore: false, results: [] }
  )
  const [displayCommentCount, setDisplayCommentCount] = React.useState(
    commentCount || 0
  )
  const [loading, setLoading] = React.useState(false)
  const [currentAcceptedCommentId, setCurrentAcceptedCommentId] =
    React.useState(acceptedCommentId || 0)

  React.useEffect(() => {
    if (initialData) {
      setPageData(initialData)
    }
  }, [initialData])

  React.useEffect(() => {
    if (commentCount !== undefined) {
      setDisplayCommentCount(commentCount)
    }
  }, [commentCount])

  // 楼层锚点定位（支持 #12 或 #comment-12 格式直达并短暂高亮闪烁）
  React.useEffect(() => {
    if (typeof window === "undefined" || !pageData.results?.length) return
    const hash = window.location.hash
    if (!hash) return
    const rawId = hash.replace(/^#/, "")
    const target =
      document.getElementById(`comment-${rawId}`) ||
      document.getElementById(rawId)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" })
      target.classList.add("bg-primary/[0.08]")
      const timer = window.setTimeout(() => {
        target.classList.remove("bg-primary/[0.08]")
      }, 2000)
      return () => window.clearTimeout(timer)
    }
  }, [pageData.results])

  const isNeedEmailVerify =
    Boolean(config?.createCommentEmailVerified) &&
    Boolean(currentUser) &&
    !currentUser?.emailVerified

  async function loadMore() {
    if (loading || !pageData.hasMore) {
      return
    }
    setLoading(true)
    try {
      const ret = await apiFetch<PageData<Comment>>("/api/comment/comments", {
        params: {
          entityType,
          entityId,
          cursor: pageData.cursor || "",
        },
      })
      setPageData((current) => ({
        cursor: ret.cursor,
        hasMore: ret.hasMore,
        results: [...(current.results || []), ...(ret.results || [])],
      }))
    } finally {
      setLoading(false)
    }
  }

  function onCommentCreated(comment: Comment) {
    const lastItem =
      pageData.results && pageData.results.length > 0
        ? pageData.results[pageData.results.length - 1]
        : null
    const fallbackFloor = lastItem?.floor
      ? lastItem.floor + 1
      : (pageData.pagination?.totalCount || 0) + 1

    const commentWithFloor: Comment = {
      ...comment,
      floor: comment.floor || fallbackFloor,
    }

    setDisplayCommentCount((c) => c + 1)

    const pagination = pageData.pagination
    if (pagination && pagination.totalPages > 1) {
      const isLastPage = pagination.currentPage === pagination.totalPages
      const isCurrentPageFull =
        (pageData.results?.length || 0) >= (pagination.pageSize || 10)

      // 用户不在最后一页，或者当前页已满需要产生新的一页：
      // 跳转到评论所在的最后一页，由锚点自动平滑滚动并高亮
      if (!isLastPage || isCurrentPageFull) {
        const total = (pagination.totalCount || 0) + 1
        const newTotalPages = Math.ceil(total / (pagination.pageSize || 10))
        const rootPath = pathname || (entityId ? `/topic/${entityId}` : "")
        const targetUrl = `${rootPath}?page=${newTotalPages}#comment-${commentWithFloor.floor}`
        router.push(targetUrl)
        onCreated?.(commentWithFloor)
        return
      }
    }

    // 单页模式，或在最后一页且未满：按一二三四五六七正序追加至列表末尾
    setPageData((current) => ({
      ...current,
      results: [...(current.results || []), commentWithFloor],
      pagination: current.pagination
        ? {
            ...current.pagination,
            totalCount: (current.pagination.totalCount || 0) + 1,
          }
        : undefined,
    }))

    // 触发平滑滚动到底部并短暂高亮刚发表的楼层
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        const target =
          document.getElementById(`comment-${commentWithFloor.floor}`) ||
          document.getElementById(`comment-${commentWithFloor.id}`)
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" })
          target.classList.add("bg-primary/[0.08]")
          window.setTimeout(() => {
            target.classList.remove("bg-primary/[0.08]")
          }, 2000)
        }
      })
    }

    onCreated?.(commentWithFloor)
  }

  function updateComment(comment: Comment) {
    if ((comment as Comment & { accepted?: boolean }).accepted === true) {
      setCurrentAcceptedCommentId(comment.id)
    } else if (
      (comment as Comment & { accepted?: boolean }).accepted === false
    ) {
      setCurrentAcceptedCommentId(0)
    }

    setPageData((current) => ({
      ...current,
      results: current.results.map((item) =>
        item.id === comment.id
          ? ({ ...comment, accepted: undefined } as Comment)
          : item
      ),
    }))
  }

  function deleteComment(comment: Comment) {
    if (currentAcceptedCommentId === comment.id) {
      setCurrentAcceptedCommentId(0)
    }
    setDisplayCommentCount((c) => Math.max(0, c - 1))
    setPageData((current) => ({
      ...current,
      results: current.results.filter((item) => item.id !== comment.id),
      pagination: current.pagination
        ? {
            ...current.pagination,
            totalCount: Math.max(0, (current.pagination.totalCount || 0) - 1),
          }
        : undefined,
    }))
  }

  return (
    <section id="JComment" className="rounded-lg bg-background p-4">
      <div className="flex text-base font-medium text-foreground">
        <span>{title || t("component.comment.title")}</span>
        {displayCommentCount > 0 ? (
          <span>&nbsp;{displayCommentCount}</span>
        ) : null}
      </div>

      {currentUser ? (
        isNeedEmailVerify ? (
          <div className="relative my-2.5 box-border overflow-hidden rounded-[3px] border border-border p-2.5">
            <div className="rounded-[3px] px-2.5 text-muted-foreground">
              {t("component.comment.emailVerifyPrompt")}
              <Link
                href="/user/profile/account"
                className="mx-2.5 text-foreground hover:text-primary"
              >
                {t("component.comment.accountSettingsLink")}
              </Link>
              {t("component.comment.emailVerifyAction")}
            </div>
          </div>
        ) : (
          <CommentInput
            entityType={entityType}
            entityId={entityId}
            onCreated={onCommentCreated}
          />
        )
      ) : (
        <Link
          href={buildSigninHref(pathname || "/")}
          className="my-3 flex cursor-pointer items-center gap-2 rounded-lg border border-primary/40 bg-primary/[0.1] px-3 py-3 transition-colors hover:bg-primary/[0.15]"
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <LogIn className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {t("component.comment.loginLink")}
            </p>
          </div>
        </Link>
      )}

      {/* 顶部独立分页器（对齐 NodeSeek 双向布局） */}
      {pageData.pagination && pageData.pagination.totalPages > 1 ? (
        <CommentPager
          pagination={pageData.pagination}
          entityId={entityId}
          entityType={entityType}
          className="mb-2 border-b border-border pb-2"
        />
      ) : null}

      <div className="text-[15px]">
        {pageData.results?.length ? (
          pageData.results.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              acceptedCommentId={currentAcceptedCommentId}
              allowAcceptAnswer={allowAcceptAnswer}
              entityType={entityType}
              entityId={entityId}
              onChanged={updateComment}
              onDeleted={deleteComment}
            />
          ))
        ) : pageData.hasMore ? null : (
          <EmptyState title={t("common.noData")} className="min-h-36" />
        )}

        {/* 底部独立分页器（若无分页元数据则回退至既有 LoadMoreButton） */}
        {pageData.pagination && pageData.pagination.totalPages > 1 ? (
          <CommentPager
            pagination={pageData.pagination}
            entityId={entityId}
            entityType={entityType}
            className="pt-3"
          />
        ) : (
          <LoadMoreButton
            loading={loading}
            hasMore={pageData.hasMore}
            labels={{
              loadMore: t("common.loadMore.loadMore"),
              noMore: t("common.loadMore.noMore"),
            }}
            onClick={() => void loadMore()}
          />
        )}
      </div>
    </section>
  )
}
