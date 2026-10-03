// Package imageutil 上传图片统一归一化（后端集中处理）。
//
// Business Rule: 全站图片入口（话题/评论/文章配图、后台站点设置、第三方登录头像拉取）
// 最终都收敛到 UploadService.PutImage/PutImageStream 或 uploader.download，
// 在此集中处理一次即可兜底全部调用方（含绕过前端的 curl/脚本直调接口），
// 前端 canvas 压缩仅作上行加速的体验优化，不可替代本层。
//
// Reason: 选择标准库 + golang.org/x/image（本就间接依赖，转正为直接依赖即可），
// 不引入 imaging/libvips 等新库：纯 Go 无 CGO，Docker/交叉编译零负担；
// 代价是无 WebP 编码器、无 EXIF 自动摆正（见 NormalizeImage 的透传策略与注释）。
package imageutil

import (
	"bytes"
	"image"
	_ "image/gif" // 仅注册解码；GIF 动图为保动画全文件透传，不做缩放
	"image/jpeg"
	_ "image/jpeg"
	"image/png"
	_ "image/png"
	"strings"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // 仅注册解码；无标准编码器，超限 WebP 透传
)

const (
	// MaxLongEdge 归一化后长边上限：1920 覆盖 1080p 与移动端高清屏展示，
	// 落盘 JPEG 约 200~500KB，兼顾清晰度与存储/CDN 成本。
	MaxLongEdge = 1920
	// JpegQuality 大图重编码质量：82 是体积与观感的常用拐点，
	// 85 以上体积陡增而观感几乎不变，75 以下文字边缘易糊。
	JpegQuality = 82
	// MaxPixels 解码像素上限：超过则跳过解码直接透传。
	// 防 decompression-bomb 常驻内存；原文件仍受 UploadMaxBytes 约束，存储侧有界。
	MaxPixels = 40_000_000
)

// NormalizeImage 将上传图片归一化为合理尺寸，返回落盘字节与 Content-Type。
// 策略（fail-open：凡不能安全处理的，一律原样透传，保持今日行为不中断业务）：
//   - 空字节返回原样；SVG（含 svg 标识）原样透传（矢量无需栅格化）；
//   - 解码失败（如 ico/bmp 等非常见格式）原样透传；
//   - GIF 动图原样透传（逐帧缩放会破坏动画）；WebP 原样透传（标准库无编码器，
//     且 WebP 本就高效，超限极为罕见）；
//   - 长边 <= MaxLongEdge 原字节返回（小图零画质损失、零 CPU 开销）；
//   - 仅当长边超限时等比缩放并按原格式重编码（JPEG q82 / PNG 默认压缩）。
//
// Business Rule: 本函数不做大小上限拒绝，调用方负责用 UploadMaxBytes 截断/拒绝。
func NormalizeImage(data []byte, contentType string) ([]byte, string) {
	ct := strings.TrimSpace(contentType)
	if ct == "" {
		ct = "image/jpeg"
	}
	if len(data) == 0 {
		return data, ct
	}
	// SVG 是文本矢量，image.Decode 无法处理，先行透传。
	if strings.Contains(strings.ToLower(ct), "svg") {
		return data, ct
	}

	// 先只读头判定尺寸：超大像素直接透传，避免 Decode 常驻数百 MB。
	if cfg, format, err := image.DecodeConfig(bytes.NewReader(data)); err == nil {
		if format == "gif" || format == "webp" {
			return data, ct
		}
		if int64(cfg.Width)*int64(cfg.Height) > MaxPixels {
			return data, ct
		}
	}

	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		// 非常见格式（如 ico/bmp）：保持今日直存行为，不断业务。
		return data, ct
	}
	if format == "gif" || format == "webp" {
		return data, ct
	}

	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= 0 || h <= 0 {
		return data, ct
	}
	longEdge := w
	if h > w {
		longEdge = h
	}
	if longEdge <= MaxLongEdge {
		return data, ct
	}

	// 等比缩放：CatmullRom 在纯 Go 算法中画质较好，4K 图约几十毫秒，可接受。
	scale := float64(MaxLongEdge) / float64(longEdge)
	dstW := int(float64(w) * scale)
	dstH := int(float64(h) * scale)
	if dstW <= 0 || dstH <= 0 {
		return data, ct
	}
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, bounds, draw.Over, nil)

	var buf bytes.Buffer
	switch format {
	case "png":
		if err := png.Encode(&buf, dst); err != nil {
			return data, ct
		}
		return buf.Bytes(), "image/png"
	default:
		// jpeg 及其他可解码格式统一落为 JPEG（体积最优、兼容性最好）。
		if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: JpegQuality}); err != nil {
			return data, ct
		}
		return buf.Bytes(), "image/jpeg"
	}
}
