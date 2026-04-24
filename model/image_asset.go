package model

import (
	"context"
	"os"
	"time"

	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

// ImageAsset 用户生成图片资产记录
type ImageAsset struct {
	ID        uint           `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID    int            `json:"user_id" gorm:"index;not null"`
	Prompt    string         `json:"prompt" gorm:"type:text"`
	Model     string         `json:"model" gorm:"type:varchar(128)"`
	Size      string         `json:"size" gorm:"type:varchar(32)"`
	Quality   string         `json:"quality" gorm:"type:varchar(16)"`
	FilePath  string         `json:"file_path" gorm:"type:varchar(512)"`  // 磁盘相对路径
	PublicURL string         `json:"public_url" gorm:"type:varchar(512)"` // 对外访问 URL
	Status    string         `json:"status" gorm:"type:varchar(16);default:'success'"`
	ExpireAt  time.Time      `json:"expire_at" gorm:"index"` // 90 天后过期
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// CreateImageAsset 插入一条图片资产记录
func CreateImageAsset(asset *ImageAsset) error {
	return DB.Create(asset).Error
}

// GetUserImageAssets 分页获取用户的图片资产（按创建时间倒序）
func GetUserImageAssets(userID int, page, pageSize int) ([]ImageAsset, int64, error) {
	var assets []ImageAsset
	var total int64

	query := DB.Model(&ImageAsset{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&assets).Error; err != nil {
		return nil, 0, err
	}
	return assets, total, nil
}

// GetImageAssetByID 根据 ID 获取资产（需校验 userID 防止越权）
func GetImageAssetByID(id uint, userID int) (*ImageAsset, error) {
	var asset ImageAsset
	if err := DB.Where("id = ? AND user_id = ?", id, userID).First(&asset).Error; err != nil {
		return nil, err
	}
	return &asset, nil
}

// DeleteImageAssetByID 软删除数据库记录（物理删除文件由 service 层负责）
func DeleteImageAssetByID(id uint, userID int) error {
	return DB.Where("id = ? AND user_id = ?", id, userID).Delete(&ImageAsset{}).Error
}

// DeleteExpiredImageAssets 清理已过期的图片资产（硬删除记录 + 删除磁盘文件）
// 返回删除的记录数
func DeleteExpiredImageAssets() (int, error) {
	var assets []ImageAsset
	if err := DB.Unscoped().Where("expire_at < ? AND expire_at > ?", time.Now(), time.Time{}).Find(&assets).Error; err != nil {
		return 0, err
	}
	if len(assets) == 0 {
		return 0, nil
	}

	ctx := context.Background()
	deleted := 0
	for _, asset := range assets {
		// 删除磁盘文件
		if asset.FilePath != "" {
			if err := os.Remove(asset.FilePath); err != nil && !os.IsNotExist(err) {
				logger.LogWarn(ctx, "failed to remove image file: "+asset.FilePath+" err: "+err.Error())
			}
		}
		// 硬删除数据库记录
		if err := DB.Unscoped().Delete(&asset).Error; err != nil {
			logger.LogWarn(ctx, "failed to delete image asset record: "+err.Error())
			continue
		}
		deleted++
	}
	return deleted, nil
}
