package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const imageCleanupInterval = 24 * time.Hour

var imageCleanupOnce sync.Once

// StartImageAssetCleanupTask 启动每日定时清理过期图片资产任务
// 仅在 master 节点执行
func StartImageAssetCleanupTask() {
	imageCleanupOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), "image asset cleanup task started")
			// 启动时先跑一次
			runImageAssetCleanupOnce()
			ticker := time.NewTicker(imageCleanupInterval)
			defer ticker.Stop()
			for range ticker.C {
				runImageAssetCleanupOnce()
			}
		})
	})
}

func runImageAssetCleanupOnce() {
	ctx := context.Background()
	n, err := model.DeleteExpiredImageAssets()
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("image asset cleanup failed: %v", err))
		return
	}
	if n > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("image asset cleanup: deleted %d expired assets", n))
	}
}
