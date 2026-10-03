package services

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"sync"

	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/common/urls"

	"bbs-go/internal/models/constants"
	"bbs-go/internal/models/dto"
	"bbs-go/internal/pkg/bbsurls"
	"bbs-go/internal/pkg/imageutil"
	"bbs-go/internal/pkg/locales"
	"bbs-go/internal/pkg/respath"
	"bbs-go/internal/pkg/uploader"
)

var UploadService = newUploadService()

type uploadService struct {
	uploaderMap map[dto.UploadMethod]uploader.Uploader
	once        sync.Once
}

func newUploadService() *uploadService {
	return &uploadService{
		uploaderMap: make(map[dto.UploadMethod]uploader.Uploader),
	}
}

func (s *uploadService) putObject(key string, body io.Reader, opts *uploader.PutOptions) (string, error) {
	u, err := s.getUploader()
	if err != nil {
		return "", err
	}
	cfg := SysConfigService.GetUploadConfig()
	return u.PutObject(cfg, key, body, opts)
}

// PutObject 按 key 流式上传；opts 可设置 ContentType、ContentDisposition、ContentLength。
func (s *uploadService) PutObject(key string, body io.Reader, opts *uploader.PutOptions) (string, error) {
	return s.putObject(key, body, opts)
}

func (s *uploadService) ObjectURL(key string) string {
	cfg := SysConfigService.GetUploadConfig()
	if strs.IsBlank(string(cfg.EnableUploadMethod)) {
		cfg.EnableUploadMethod = dto.Local
	}

	switch cfg.EnableUploadMethod {
	case dto.AliyunOss:
		return bbsurls.UrlJoin(cfg.AliyunOss.Host, key)
	case dto.TencentCos:
		return fmt.Sprintf("https://%s.cos.%s.myqcloud.com/%s", cfg.TencentCos.Bucket, cfg.TencentCos.Region, key)
	case dto.AwsS3:
		return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", cfg.AwsS3.Bucket, cfg.AwsS3.Region, key)
	case dto.S3:
		return uploader.S3ObjectURL(cfg, key)
	default:
		return respath.UploadsURLPrefix + key
	}
}

// PutImage 上传图片（已有完整字节）；key 使用内容 MD5，供 CopyImage 等场景。
// Business Rule: 入库前先经 imageutil.NormalizeImage 统一尺寸（大图压到长边 1920），
// 小图/特殊格式原样透传；MD5 key 按处理后字节计算。
func (s *uploadService) PutImage(data []byte, contentType string) (string, error) {
	if int64(len(data)) > constants.UploadMaxBytes {
		return "", errors.New(locales.Getf("upload.image_too_large", constants.UploadMaxM))
	}
	data, contentType = imageutil.NormalizeImage(data, contentType)
	key := uploader.GenerateImageKey(data, contentType)
	opts := &uploader.PutOptions{ContentType: contentType, ContentLength: int64(len(data))}
	return s.putObject(key, bytes.NewReader(data), opts)
}

// PutImageStream 流式上传图片；全站图片入口的唯一可信收敛点。
// Reason: header.Size 不可信（chunked 时为 0、客户端可伪造），此处以 LimitReader
// 为准二次兜底，handler 的 header.Size 校验仅作快速失败。代价是请求期常驻一份
// 文件字节（上限 UploadMaxBytes=10MB 有界）：内存换确定性，必须解码才知道尺寸。
func (s *uploadService) PutImageStream(body io.Reader, contentLength int64, contentType string) (string, error) {
	var data []byte
	data, err := io.ReadAll(io.LimitReader(body, constants.UploadMaxBytes+1))
	if err != nil {
		return "", err
	}
	if int64(len(data)) > constants.UploadMaxBytes {
		return "", errors.New(locales.Getf("upload.image_too_large", constants.UploadMaxM))
	}
	data, contentType = imageutil.NormalizeImage(data, contentType)
	key := uploader.GenerateImageKeyByContentType(contentType)
	opts := &uploader.PutOptions{ContentType: contentType, ContentLength: int64(len(data))}
	return s.putObject(key, bytes.NewReader(data), opts)
}

func (s *uploadService) CopyImage(url string) (string, error) {
	u, err := s.getUploader()
	if err != nil {
		return "", err
	}
	u1 := urls.ParseUrl(url).GetURL()
	u2 := urls.ParseUrl(SysConfigService.GetBaseURL()).GetURL()
	if u1.Host == u2.Host {
		return url, nil
	}
	cfg := SysConfigService.GetUploadConfig()
	return u.CopyImage(cfg, url)
}

func (s *uploadService) getUploader() (uploader.Uploader, error) {
	s.once.Do(func() {
		s.uploaderMap[dto.Local] = &uploader.LocalUploader{}
		s.uploaderMap[dto.AliyunOss] = &uploader.AliyunOssUploader{}
		s.uploaderMap[dto.TencentCos] = &uploader.TencentCosUploader{}
		s.uploaderMap[dto.AwsS3] = &uploader.AwsS3Uploader{}
		s.uploaderMap[dto.S3] = &uploader.S3Uploader{}
	})
	cfg := SysConfigService.GetUploadConfig()

	if strs.IsBlank(string(cfg.EnableUploadMethod)) {
		cfg.EnableUploadMethod = dto.Local
	}

	u, ok := s.uploaderMap[cfg.EnableUploadMethod]
	if !ok {
		return nil, fmt.Errorf("error: Upload method: %s not found", cfg.EnableUploadMethod)
	}
	return u, nil
}
