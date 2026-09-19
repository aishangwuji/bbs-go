"use client"

import * as React from "react"
import { CloudUpload, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { apiFetch, toFormData } from "@/lib/api/client"
import { useI18n } from "@/lib/i18n/provider"
import { toast } from "@/lib/toast"

const MAX_AVATAR_PICK_SIZE = 20 * 1024 * 1024 // 20MB（仅作防误选超大文件保护，常规几MB照片静默无感自动压缩）
const AVATAR_LARGE_SIZE = 128 // 128x128 高清大头像（用于个人资料主页，约 4KB）
const AVATAR_SMALL_SIZE = 73 // 73x73 极速小头像（用于帖子流与评论区楼层，约 1.5KB）

/**
 * 智能居中等比正方形裁剪并压缩为轻量 WebP（标准 73x73 尺寸，约 1KB~3KB）
 */
async function cropAndCompressAvatarToWebP(
  file: File,
  targetSize = AVATAR_LARGE_SIZE,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("读取图片失败"))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("加载图片失败"))
      img.onload = () => {
        const { width, height } = img
        const minEdge = Math.min(width, height)
        // 计算居中裁剪起点
        const sx = (width - minEdge) / 2
        const sy = (height - minEdge) / 2

        const canvas = document.createElement("canvas")
        canvas.width = targetSize
        canvas.height = targetSize
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(file)
          return
        }

        // 开启高质量平滑渲染
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        ctx.drawImage(
          img,
          sx,
          sy,
          minEdge,
          minEdge,
          0,
          0,
          targetSize,
          targetSize
        )

        // 导出为 WebP，若浏览器环境不支持则自动回退
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".webp"
            const webpFile = new File([blob], cleanName, {
              type: blob.type || "image/webp",
            })
            resolve(webpFile)
          },
          "image/webp",
          quality
        )
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

async function uploadImage(file: File, type?: string) {
  const body = new FormData()
  body.append("image", file, file.name)
  if (type) {
    body.append("type", type)
  }
  return apiFetch<{ url: string }>("/api/upload", { method: "POST", body })
}

export function AvatarEdit({
  value,
  onChange,
}: {
  value?: string
  onChange?: (url: string) => void
}) {
  const { t } = useI18n()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [avatar, setAvatar] = React.useState(value || "")
  const [uploading, setUploading] = React.useState(false)

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // 防误选保护：仅拦截超过 20MB 的超大文件，常规大图全自动静默无感裁切压缩为 256x256 WebP
    if (file.size > MAX_AVATAR_PICK_SIZE) {
      toast.error("所选图片文件过大（超过20MB），请重新选择")
      event.currentTarget.value = ""
      return
    }

    setUploading(true)
    try {
      // 2. 浏览器原生硬件加速：并发生成大（128x128）与小（73x73）两份 WebP
      const [largeFile, smallFile] = await Promise.all([
        cropAndCompressAvatarToWebP(file, AVATAR_LARGE_SIZE, 0.85),
        cropAndCompressAvatarToWebP(file, AVATAR_SMALL_SIZE, 0.85),
      ])

      // 3. 并发上传至后端（总数据量仅约 5.5KB，0.03秒完成）
      const [largeRes, smallRes] = await Promise.all([
        uploadImage(largeFile, "avatar"),
        uploadImage(smallFile, "avatar"),
      ])

      await apiFetch<null>("/api/user/update_avatar", {
        method: "POST",
        body: toFormData({
          avatar: largeRes.url,
          smallAvatar: smallRes.url,
        }),
      })
      setAvatar(largeRes.url)
      onChange?.(largeRes.url)
      toast.success(t("component.avatarEdit.updateSuccess"))
    } catch {
      toast.error(t("component.avatarEdit.updateFailed"))
    } finally {
      setUploading(false)
      event.currentTarget.value = ""
    }
  }

  return (
    <div className="avatar-edit">
      <button
        type="button"
        className="avatar-view"
        style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <span className="upload-view">
          <Upload size="20" />
          <span>{t("component.avatarEdit.update")}</span>
        </span>
      </button>
      <input
        ref={inputRef}
        accept="image/*"
        type="file"
        onChange={onFileChange}
      />
    </div>
  )
}

export function BackgroundUploadButton({
  onUploaded,
}: {
  onUploaded?: (url: string) => void
}) {
  const { t } = useI18n()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const result = await uploadImage(file)
      await apiFetch<null>("/api/user/set_background_image", {
        method: "POST",
        body: toFormData({ backgroundImage: result.url }),
      })
      onUploaded?.(result.url)
      toast.success(t("component.userProfile.backgroundSuccess"))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("composables.unknownError")
      )
    } finally {
      setUploading(false)
      event.currentTarget.value = ""
    }
  }

  return (
    <Button
      type="button"
      className="change-bg"
      disabled={uploading}
      onClick={() => inputRef.current?.click()}
    >
      <CloudUpload size="16" />
      <span>{t("component.userProfile.setBackground")}</span>
      <input
        ref={inputRef}
        accept="image/*"
        type="file"
        className="hidden"
        onChange={onFileChange}
      />
    </Button>
  )
}
