"use client"

import * as React from "react"
import { CloudUpload, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { apiFetch, toFormData } from "@/lib/api/client"
import { useI18n } from "@/lib/i18n/provider"
import { toast } from "@/lib/toast"

const MAX_AVATAR_FILE_SIZE = 200 * 1024 // 200KB

/**
 * 智能居中等比正方形裁剪并压缩为高清 WebP（标准 256x256 尺寸，约 8KB~15KB）
 */
async function cropAndCompressAvatarToWebP(
  file: File,
  targetSize = 256,
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

    // 1. 前端即时拦截：检查原始文件大小不能超过 200KB
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      toast.error(
        t("component.avatarEdit.sizeLimit") || "头像图片大小不能超过 200KB"
      )
      event.currentTarget.value = ""
      return
    }

    setUploading(true)
    try {
      // 2. 浏览器原生硬件加速：居中等比正方形裁剪并压缩为 256x256 WebP
      const processedFile = await cropAndCompressAvatarToWebP(file, 256, 0.85)

      const result = await uploadImage(processedFile, "avatar")
      await apiFetch<null>("/api/user/update_avatar", {
        method: "POST",
        body: toFormData({ avatar: result.url }),
      })
      setAvatar(result.url)
      onChange?.(result.url)
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
