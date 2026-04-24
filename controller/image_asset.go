package controller

import (
	"net/http"
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// CreateImageAssetRequest 保存图片资产请求体
type CreateImageAssetRequest struct {
	ImageURL string `json:"image_url" binding:"required"`
	Prompt   string `json:"prompt"`
	Model    string `json:"model"`
	Size     string `json:"size"`
	Quality  string `json:"quality"`
}

// CreateImageAsset POST /api/user/image-assets
// 下载图片URL、压缩存盘、写入数据库
func CreateImageAsset(c *gin.Context) {
	userID := c.GetInt("id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "unauthorized"})
		return
	}

	var req CreateImageAssetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	// 下载并压缩图片
	filePath, publicURL, err := service.SaveImageFromURL(req.ImageURL, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "图片保存失败: " + err.Error()})
		return
	}

	// 写入数据库
	asset := &model.ImageAsset{
		UserID:    userID,
		Prompt:    req.Prompt,
		Model:     req.Model,
		Size:      req.Size,
		Quality:   req.Quality,
		FilePath:  filePath,
		PublicURL: publicURL,
		Status:    "success",
		ExpireAt:  service.ImageExpireAt(),
	}
	if err := model.CreateImageAsset(asset); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "记录保存失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":         asset.ID,
			"public_url": publicURL,
			"expire_at":  asset.ExpireAt,
		},
	})
}

// GetImageAssets GET /api/user/image-assets?page=1&page_size=20
func GetImageAssets(c *gin.Context) {
	userID := c.GetInt("id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "unauthorized"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	assets, total, err := model.GetUserImageAssets(userID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items":     assets,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

// DeleteImageAsset DELETE /api/user/image-assets/:id
func DeleteImageAsset(c *gin.Context) {
	userID := c.GetInt("id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "unauthorized"})
		return
	}

	idStr := c.Param("id")
	idVal, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	assetID := uint(idVal)

	// 先查找，获取文件路径
	asset, err := model.GetImageAssetByID(assetID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "资产不存在"})
		return
	}

	// 删除磁盘文件（忽略不存在错误）
	if asset.FilePath != "" {
		_ = os.Remove(asset.FilePath)
	}

	// 软删除数据库记录
	if err := model.DeleteImageAssetByID(assetID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已删除"})
}
