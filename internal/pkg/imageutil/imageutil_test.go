package imageutil

import (
	"bytes"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"testing"
)

// solidImage 生成纯色测试图，避免引入外部 fixture 文件。
func solidImage(w, h int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.NRGBA{R: 200, G: 100, B: 50, A: 255})
		}
	}
	return img
}

func encodeJPEG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func decodeSize(t *testing.T, data []byte) (int, int) {
	t.Helper()
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	return cfg.Width, cfg.Height
}

// 大图（3000x2000）应被压到长边 1920，且体积显著缩小。
func TestNormalizeImageDownscalesLargeJPEG(t *testing.T) {
	raw := encodeJPEG(t, solidImage(3000, 2000))

	out, ct := NormalizeImage(raw, "image/jpeg")
	if ct != "image/jpeg" {
		t.Fatalf("expected image/jpeg, got %s", ct)
	}
	w, h := decodeSize(t, out)
	if w != 1920 || h != 1280 {
		t.Fatalf("expected 1920x1280, got %dx%d", w, h)
	}
	if len(out) >= len(raw) {
		t.Fatalf("expected smaller output, raw=%d out=%d", len(raw), len(out))
	}
}

// 小图（800x600）必须字节级透传：零画质损失、零 CPU 开销。
func TestNormalizeImagePassesThroughSmallImage(t *testing.T) {
	raw := encodeJPEG(t, solidImage(800, 600))

	out, ct := NormalizeImage(raw, "image/jpeg")
	if ct != "image/jpeg" {
		t.Fatalf("expected image/jpeg, got %s", ct)
	}
	if !bytes.Equal(out, raw) {
		t.Fatalf("expected byte-identical passthrough, raw=%d out=%d", len(raw), len(out))
	}
}

// PNG 大图按原格式重编码，Content-Type 保持 image/png。
func TestNormalizeImageKeepsPNGFormat(t *testing.T) {
	var buf bytes.Buffer
	if err := png.Encode(&buf, solidImage(2500, 1000)); err != nil {
		t.Fatal(err)
	}

	out, ct := NormalizeImage(buf.Bytes(), "image/png")
	if ct != "image/png" {
		t.Fatalf("expected image/png, got %s", ct)
	}
	w, h := decodeSize(t, out)
	if w != 1920 {
		t.Fatalf("expected width 1920, got %d (h=%d)", w, h)
	}
}

// GIF 动图原样透传（保护动画），SVG 原样透传，坏字节原样透传（fail-open 不中断业务）。
func TestNormalizeImagePassesThroughSpecialCases(t *testing.T) {
	var gifBuf bytes.Buffer
	if err := gif.Encode(&gifBuf, solidImage(64, 64), nil); err != nil {
		t.Fatal(err)
	}
	if out, _ := NormalizeImage(gifBuf.Bytes(), "image/gif"); !bytes.Equal(out, gifBuf.Bytes()) {
		t.Fatal("gif should pass through untouched")
	}

	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>`)
	if out, ct := NormalizeImage(svg, "image/svg+xml"); !bytes.Equal(out, svg) || ct != "image/svg+xml" {
		t.Fatal("svg should pass through untouched")
	}

	broken := []byte("not-an-image-at-all")
	if out, _ := NormalizeImage(broken, "image/jpeg"); !bytes.Equal(out, broken) {
		t.Fatal("undecodable bytes should pass through untouched")
	}

	if out, ct := NormalizeImage(nil, ""); len(out) != 0 || ct != "image/jpeg" {
		t.Fatalf("empty input should return empty with default ct, got ct=%s", ct)
	}
}
