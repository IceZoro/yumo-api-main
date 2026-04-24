package service

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png" // 注册 PNG 解码器
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "golang.org/x/image/webp" // 注册 WebP 解码器
)

const (
	imageUploadSubDir = "uploads/images"
	jpegQuality       = 85
	imageExpireDays   = 90
)

// GetUploadDir 获取上传根目录
// 可通过环境变量 UPLOAD_DIR 配置，默认为程序工作目录下的 ./uploads
func GetUploadDir() string {
	if d := os.Getenv("UPLOAD_DIR"); d != "" {
		return d
	}
	return "uploads"
}

// getImageStorageDir 返回指定用户当月的存储目录（绝对路径）
func getImageStorageDir(userID int) string {
	month := time.Now().Format("2006-01")
	return filepath.Join(GetUploadDir(), "images", strconv.Itoa(userID), month)
}

// ensureDir 确保目录存在
func ensureDir(dir string) error {
	return os.MkdirAll(dir, 0755)
}

// compressToJPEG 将任意格式图片数据解码后以 JPEG quality=85 重新编码
// 若解码失败则回退：原样写入 dst（不阻断流程）
func compressToJPEG(src []byte, dst io.Writer) error {
	img, _, err := image.Decode(bytes.NewReader(src))
	if err != nil {
		// 解码失败 → 原样写出
		_, werr := dst.Write(src)
		return werr
	}
	return jpeg.Encode(dst, img, &jpeg.Options{Quality: jpegQuality})
}

// saveBytes 将字节压缩为 JPEG 并写入磁盘，返回 (filePath, publicURL, error)
// filePath: 磁盘绝对路径；publicURL: 可对外访问的 HTTP 路径
func saveBytes(data []byte, userID int) (string, string, error) {
	dir := getImageStorageDir(userID)
	if err := ensureDir(dir); err != nil {
		return "", "", fmt.Errorf("failed to create upload dir: %w", err)
	}

	filename := uuid.New().String() + ".jpg"
	filePath := filepath.Join(dir, filename)

	f, err := os.Create(filePath)
	if err != nil {
		return "", "", fmt.Errorf("failed to create image file: %w", err)
	}
	defer f.Close()

	if err := compressToJPEG(data, f); err != nil {
		os.Remove(filePath)
		return "", "", fmt.Errorf("failed to compress/write image: %w", err)
	}

	// 构造可访问 URL（相对路径，由 Gin Static 提供服务）
	month := time.Now().Format("2006-01")
	publicURL := fmt.Sprintf("/uploads/images/%d/%s/%s", userID, month, filename)
	return filePath, publicURL, nil
}

// SaveImageFromURL 下载外部图片 URL，压缩后保存到本地磁盘
func SaveImageFromURL(srcURL string, userID int) (filePath, publicURL string, err error) {
	resp, err := http.Get(srcURL) //nolint:gosec
	if err != nil {
		return "", "", fmt.Errorf("failed to download image: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("download image: HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("failed to read image body: %w", err)
	}

	return saveBytes(data, userID)
}

// SaveImageFromBase64 解码 base64 图片数据（支持带 data-url 前缀），压缩后保存
func SaveImageFromBase64(b64 string, userID int) (filePath, publicURL string, err error) {
	// 去除 data:image/xxx;base64, 前缀
	if idx := strings.Index(b64, ","); idx != -1 {
		b64 = b64[idx+1:]
	}
	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", "", fmt.Errorf("failed to decode base64: %w", err)
	}
	return saveBytes(data, userID)
}

// ImageExpireAt 返回 90 天后的过期时间
func ImageExpireAt() time.Time {
	return time.Now().AddDate(0, 0, imageExpireDays)
}
