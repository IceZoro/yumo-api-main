/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select, Toast } from '@douyinfe/semi-ui';
import { API, showError } from '@/helpers';
import { UserContext } from '@/context/User';
import {
  FolderOpen,
  Grid3X3,
  List,
  RefreshCw,
  Download,
  ZoomIn,
  Trash2,
  XCircle,
  Loader2,
  CheckCircle2,
  XCircle as XCircleFail,
  Clock,
  Search,
  Filter,
  Image as ImageIcon,
  Film,
  Heart,
} from 'lucide-react';
import './Asset.css';

const IMAGE_ENDPOINT_TYPE = 'image-generation';

const TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图像' },
  { value: 'video', label: '音视频' },
];

const Asset = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  // userLoaded: 用户状态已从后端/缓存加载完毕，避免 userId 异步变化导致读取错误 key
  const userLoaded = userState?.user !== undefined;
  const userId = userState?.user?.id || 'guest';
  const assetStorageKey = `ig_assets_${userId}`;
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [previewAsset, setPreviewAsset] = useState(null);
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  const [imageModels, setImageModels] = useState([]);

  // 加载任务列表（后端 + localStorage）
  const fetchAssets = useCallback(async () => {
    // 用户状态未就绪时不加载，避免用 guest key 读取空数据
    if (!userLoaded) return;
    setLoading(true);
    try {
      // 1. 从 localStorage 加载本地生成的资产
      let localAssets = [];
      try {
        const saved = localStorage.getItem(assetStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            localAssets = parsed
              .filter((a) => a.status === 'success' && a.imageUrl)
              .slice(0, 20)
              .map((a) => ({
                id: `local-${a.id}`,
                taskId: null,
                platform: 'image-generator',
                action: 'image-generation',
                model: a.model || '',
                status: a.status,
                progress: a.progress || '100%',
                resultUrl: a.imageUrl,
                failReason: a.error || '',
                createdAt: a.createdAt,
                finishedAt: a.finishedAt,
                prompt: a.prompt || '',
                raw: null,
                source: 'local',
              }));
          }
        }
      } catch (_) { /* ignore localStorage errors */ }

      // 2. 从后端加载任务资产
      let serverAssets = [];
      try {
        const res = await API.get('/api/task/self?p=1&page_size=100');
        const { success, data } = res.data;
        if (success) {
          const items = data?.items || data || [];
          serverAssets = items.map((task) => ({
            id: task.id,
            taskId: task.task_id,
            platform: task.platform,
            action: task.action,
            model: task.data ? (() => {
              try {
                const d = typeof task.data === 'string' ? JSON.parse(task.data) : task.data;
                return d.model || '';
              } catch { return ''; }
            })() : '',
            status: task.status,
            progress: task.progress,
            resultUrl: task.result_url,
            failReason: task.fail_reason,
            createdAt: task.created_at ? task.created_at * 1000 : task.submit_time * 1000,
            finishedAt: task.finish_time ? task.finish_time * 1000 : null,
            prompt: task.data ? (() => {
              try {
                const d = typeof task.data === 'string' ? JSON.parse(task.data) : task.data;
                return d.prompt || '';
              } catch { return ''; }
            })() : '',
            raw: task,
            source: 'server',
          }));
        }
      } catch (error) {
        console.error('Failed to fetch server assets:', error);
      }

      // 3. 合并：本地资产放在前面，去重（通过 imageUrl 或 prompt+createdAt）
      const serverUrls = new Set(serverAssets.map((a) => a.resultUrl).filter(Boolean));
      const dedupedLocal = localAssets.filter((a) => !serverUrls.has(a.resultUrl));
      const merged = [...dedupedLocal, ...serverAssets];

      // 4. 按 createdAt 降序排列，取前20条
      merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setAssets(merged.slice(0, 20));
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    }
    setLoading(false);
  }, [assetStorageKey, userLoaded]);

  // 加载生图模型列表（用于区分类型）
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await API.get('/api/pricing');
        const { success, data } = res.data;
        if (success && Array.isArray(data)) {
          const imgModels = data.filter(
            (model) =>
              model.supported_endpoint_types &&
              Array.isArray(model.supported_endpoint_types) &&
              model.supported_endpoint_types.includes(IMAGE_ENDPOINT_TYPE)
          );
          setImageModels(imgModels.map((m) => m.model_name));
        }
      } catch (_) {}
    };
    fetchModels();
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // 获取资产类型
  const getAssetType = (asset) => {
    if (asset.source === 'local') return 'image';
    if (asset.platform === 'suno') return 'audio';
    if (asset.platform === 'mj') return 'image';
    if (imageModels.includes(asset.model)) return 'image';
    if (asset.resultUrl && /\.(mp4|webm|mov)/i.test(asset.resultUrl)) return 'video';
    return 'image';
  };

  // 筛选资产
  const filteredAssets = assets.filter((asset) => {
    // 类型筛选
    const assetType = getAssetType(asset);
    if (typeFilter === 'image' && assetType !== 'image') return false;
    if (typeFilter === 'video' && assetType !== 'video' && assetType !== 'audio') return false;

    // 日期筛选
    if (dateStart) {
      const start = new Date(dateStart).getTime();
      if (asset.createdAt < start) return false;
    }
    if (dateEnd) {
      const end = new Date(dateEnd).getTime() + 86400000;
      if (asset.createdAt > end) return false;
    }

    // 搜索
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      if (
        !asset.prompt.toLowerCase().includes(kw) &&
        !asset.model.toLowerCase().includes(kw)
      ) return false;
    }

    return true;
  });

  // 获取状态展示
  const getStatusInfo = (status) => {
    switch (status) {
      case 'success':
        return { icon: <CheckCircle2 size={14} />, text: t('已完成'), cls: 'asset-status-success' };
      case 'failure':
        return { icon: <XCircleFail size={14} />, text: t('失败'), cls: 'asset-status-failure' };
      case 'submitted':
        return { icon: <Clock size={14} />, text: t('排队中'), cls: 'asset-status-pending' };
      case 'queued':
        return { icon: <Clock size={14} />, text: t('排队中'), cls: 'asset-status-pending' };
      case 'in_progress':
        return { icon: <Loader2 size={14} className='asset-spin' />, text: t('生成中'), cls: 'asset-status-progress' };
      default:
        return { icon: <Clock size={14} />, text: status || t('未知'), cls: 'asset-status-pending' };
    }
  };

  // 下载图片
  const handleDownload = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'asset.png';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedAssets.size === 0) {
      Toast.warning(t('请选择要删除的资产'));
      return;
    }
    setAssets((prev) => prev.filter((a) => !selectedAssets.has(a.id)));
    setSelectedAssets(new Set());
    Toast.success(t('已删除'));
  };

  // 切换选中
  const toggleSelect = (id) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString().slice(0, 5);
  };

  return (
    <div className='asset-page'>
      <div className='asset-container'>
        {/* 顶部筛选栏 */}
        <div className='asset-toolbar'>
          <div className='asset-toolbar-left'>
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: 120 }}
            >
              {TYPE_OPTIONS.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {t(opt.label)}
                </Select.Option>
              ))}
            </Select>

            <div className='asset-date-range'>
              <input
                type='date'
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className='asset-date-input'
                placeholder={t('开始日期')}
              />
              <span className='asset-date-arrow'>→</span>
              <input
                type='date'
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className='asset-date-input'
                placeholder={t('结束日期')}
              />
            </div>

            <label className='asset-fav-check'>
              <input
                type='checkbox'
                checked={favoritesOnly}
                onChange={(e) => setFavoritesOnly(e.target.checked)}
              />
              <span>{t('我的收藏')}</span>
            </label>
          </div>

          <div className='asset-toolbar-right'>
            <div className='asset-search'>
              <Search size={14} />
              <input
                type='text'
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder={t('搜索提示词或模型')}
                className='asset-search-input'
              />
            </div>

            <button className='asset-btn-icon' onClick={fetchAssets} title={t('刷新')}>
              <RefreshCw size={16} />
            </button>

            <div className='asset-view-toggle'>
              <button
                className={`asset-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                className={`asset-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List size={16} />
              </button>
            </div>

            {selectedAssets.size > 0 && (
              <Button
                type='danger'
                size='small'
                onClick={handleBatchDelete}
              >
                {t('删除')} ({selectedAssets.size})
              </Button>
            )}
          </div>
        </div>

        {/* 资产统计 */}
        <div className='asset-stats'>
          <span>{t('共')} {filteredAssets.length} {t('项')}</span>
          <span className='asset-stats-divider'>|</span>
          <span>{t('已完成')} {filteredAssets.filter(a => a.status === 'success').length}</span>
          <span className='asset-stats-divider'>|</span>
          <span>{t('生成中')} {filteredAssets.filter(a => a.status === 'in_progress' || a.status === 'queued').length}</span>
          <span className='asset-stats-divider'>|</span>
          <span>{t('失败')} {filteredAssets.filter(a => a.status === 'failure').length}</span>
        </div>

        {/* 资产内容 */}
        {loading ? (
          <div className='asset-loading'>
            <Loader2 size={32} className='asset-spin' />
            <span>{t('加载中...')}</span>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className='asset-empty'>
            <FolderOpen size={56} strokeWidth={1} />
            <span className='asset-empty-title'>{t('暂无数据')}</span>
            <span className='asset-empty-desc'>{t('前往创作页面生成您的第一个作品')}</span>
          </div>
        ) : viewMode === 'grid' ? (
          /* 网格视图 */
          <div className='asset-grid'>
            {filteredAssets.map((asset) => {
              const statusInfo = getStatusInfo(asset.status);
              const assetType = getAssetType(asset);
              return (
                <div
                  key={asset.id}
                  className={`asset-card ${selectedAssets.has(asset.id) ? 'selected' : ''}`}
                  onClick={() => toggleSelect(asset.id)}
                >
                  <div className='asset-card-thumb'>
                    {asset.status === 'success' && asset.resultUrl ? (
                      assetType === 'video' ? (
                        <div className='asset-card-video'>
                          <Film size={32} />
                          <span>Video</span>
                        </div>
                      ) : (
                        <img src={asset.resultUrl} alt={asset.prompt} />
                      )
                    ) : asset.status === 'failure' ? (
                      <div className='asset-card-error'>
                        <XCircleFail size={28} strokeWidth={1.5} />
                        <span>{asset.failReason || t('生成失败')}</span>
                      </div>
                    ) : (
                      <div className='asset-card-progress'>
                        <Loader2 size={28} className='asset-spin' />
                        <span>{asset.progress || '0%'}</span>
                      </div>
                    )}

                    {/* 选中标记 */}
                    <div className={`asset-card-check ${selectedAssets.has(asset.id) ? 'checked' : ''}`}>
                      <CheckCircle2 size={20} />
                    </div>

                    {/* 类型标签 */}
                    <div className='asset-card-type'>
                      {assetType === 'video' ? <Film size={12} /> : <ImageIcon size={12} />}
                    </div>

                    {/* 悬浮操作 */}
                    {asset.status === 'success' && asset.resultUrl && (
                      <div className='asset-card-overlay'>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }}
                          title={t('查看')}
                        >
                          <ZoomIn size={18} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(asset.resultUrl, `${asset.model}-${asset.id}.png`); }}
                          title={t('下载')}
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className='asset-card-info'>
                    <div className='asset-card-status'>
                      <span className={statusInfo.cls}>
                        {statusInfo.icon} {statusInfo.text}
                      </span>
                      <span className='asset-card-model'>{asset.model}</span>
                    </div>
                    <p className='asset-card-prompt'>{asset.prompt || '-'}</p>
                    <span className='asset-card-time'>{formatDate(asset.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 列表视图 */
          <div className='asset-list'>
            {filteredAssets.map((asset) => {
              const statusInfo = getStatusInfo(asset.status);
              const assetType = getAssetType(asset);
              return (
                <div
                  key={asset.id}
                  className={`asset-list-item ${selectedAssets.has(asset.id) ? 'selected' : ''}`}
                  onClick={() => toggleSelect(asset.id)}
                >
                  <div className={`asset-list-check ${selectedAssets.has(asset.id) ? 'checked' : ''}`}>
                    <CheckCircle2 size={18} />
                  </div>

                  <div className='asset-list-thumb'>
                    {asset.status === 'success' && asset.resultUrl ? (
                      assetType === 'video' ? (
                        <div className='asset-list-video'><Film size={20} /></div>
                      ) : (
                        <img src={asset.resultUrl} alt={asset.prompt} />
                      )
                    ) : (
                      <div className='asset-list-placeholder'>
                        {asset.status === 'failure' ? <XCircleFail size={20} /> : <Loader2 size={20} className='asset-spin' />}
                      </div>
                    )}
                  </div>

                  <div className='asset-list-info'>
                    <p className='asset-list-prompt'>{asset.prompt || '-'}</p>
                    <div className='asset-list-meta'>
                      <span className={`asset-list-status ${statusInfo.cls}`}>
                        {statusInfo.icon} {statusInfo.text}
                      </span>
                      <span className='asset-list-model'>{asset.model}</span>
                      <span className='asset-list-progress'>{asset.progress}</span>
                    </div>
                  </div>

                  <span className='asset-list-time'>{formatDate(asset.createdAt)}</span>

                  <div className='asset-list-actions'>
                    {asset.status === 'success' && asset.resultUrl && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }} title={t('查看')}>
                          <ZoomIn size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(asset.resultUrl, `${asset.model}-${asset.id}.png`); }} title={t('下载')}>
                          <Download size={16} />
                        </button>
                      </>
                    )}
                    <button className='asset-delete-btn' onClick={(e) => { e.stopPropagation(); setAssets(prev => prev.filter(a => a.id !== asset.id)); }} title={t('删除')}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 图片预览弹窗 */}
      {previewAsset && (
        <div className='asset-modal-overlay' onClick={() => setPreviewAsset(null)}>
          <div className='asset-preview-modal' onClick={(e) => e.stopPropagation()}>
            <div className='asset-preview-header'>
              <span className='asset-preview-model'>{previewAsset.model}</span>
              <div className='asset-preview-actions'>
                <button onClick={() => handleDownload(previewAsset.resultUrl, `${previewAsset.model}-${previewAsset.id}.png`)} title={t('下载')}>
                  <Download size={18} />
                </button>
                <button onClick={() => setPreviewAsset(null)}>
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            <div className='asset-preview-body'>
              <img src={previewAsset.resultUrl} alt={previewAsset.prompt} className='asset-preview-image' />
            </div>
            <div className='asset-preview-footer'>
              <p>{previewAsset.prompt}</p>
              <span>{formatDate(previewAsset.createdAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Asset;
