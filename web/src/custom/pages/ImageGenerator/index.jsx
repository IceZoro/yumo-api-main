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

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select, Toast, Modal, Spin } from '@douyinfe/semi-ui';
import { API, showError } from '@/helpers';
import { fetchTokenKey } from '@/helpers/token';
import {
  Sparkles,
  Wand2,
  ImagePlus,
  ChevronDown,
  Settings2,
  ArrowUp,
  X,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  ZoomIn,
  Trash2,
  Images,
  RefreshCw,
} from 'lucide-react';
import './ImageGenerator.css';

// 模式标签
const MODE_TABS = [
  { key: 'image', label: '图片生成' },
  { key: 'video', label: '视频生成' },
  { key: 'avatar', label: '数字人' },
  { key: 'motion', label: '动作模仿' },
];

// 生图端点类型
const IMAGE_ENDPOINT_TYPE = 'image-generation';

// 风格分类
const STYLE_CATEGORIES = [
  '全部', '摄影写真', '电商营销', '动漫游戏', '风格插画',
  '平面设计', '建筑及室内设计', '创意玩法', '文创周边', '小说推文',
];

// 比例预设
const RATIO_PRESETS = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];

// 图片质量
const QUALITY_OPTIONS = [
  { value: '720p', label: '720P' },
  { value: '1080p', label: '1080P' },
  { value: 'hd2k', label: '高清 2K' },
  { value: 'uhd3k', label: '超清 3K' },
];

// 不同质量等级下各比例的基准短边尺寸
const QUALITY_BASE_SIZE = {
  '720p': 540,
  '1080p': 1080,
  'hd2k': 1440,
  'uhd3k': 2160,
};

// 生图模式
const GEN_MODES = [
  { value: 'single', label: '单图模式' },
  { value: 'group', label: '组图模式' },
];

// 张数选项
const COUNT_OPTIONS = [1, 2, 3, 4];

// 灵感示例
const INSPIRATION_ITEMS = [
  {
    id: 1,
    url: 'https://picsum.photos/seed/inspire1/400/540',
    title: '上班了，别做牛马',
    model: '全能图片模型 V2',
  },
  {
    id: 2,
    url: 'https://picsum.photos/seed/inspire2/400/540',
    title: '圣诞节快乐',
    model: '风格插画',
  },
  {
    id: 3,
    url: 'https://picsum.photos/seed/inspire3/400/540',
    title: '大雪猫猫节气海报',
    model: '国潮风格插画',
  },
];

const ImageGenerator = () => {
  const { t } = useTranslation();
  const [activeMode, setActiveMode] = useState('image');
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [imageModels, setImageModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [selectedStyleCategory, setSelectedStyleCategory] = useState('全部');
  const [selectedStyleModel, setSelectedStyleModel] = useState(null);
  const [showParamsModal, setShowParamsModal] = useState(false);
  const [genMode, setGenMode] = useState('single');
  const [quality, setQuality] = useState('1080p');
  const [ratio, setRatio] = useState('3:4');
  const [customWidth, setCustomWidth] = useState('816');
  const [customHeight, setCustomHeight] = useState('1088');
  const [count, setCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceImage, setReferenceImage] = useState(null); // { url: base64/data-url, name: filename }
  const refImageInputRef = useRef(null);

  // 生成资产列表 - 从 localStorage 初始化，保留所有状态记录
  const [assets, setAssets] = useState(() => {
    try {
      const saved = localStorage.getItem('ig_assets');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showAssets, setShowAssets] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const pollTimerRef = useRef(null);

  // 同步 assets 到 localStorage（保留所有记录，最多100条）
  useEffect(() => {
    try {
      const toSave = assets.slice(0, 100);
      localStorage.setItem('ig_assets', JSON.stringify(toSave));
    } catch { /* localStorage 满了就忽略 */ }
  }, [assets]);

  // 模式切换
  const handleModeSwitch = (key) => {
    if (key !== 'image') {
      Toast.info(t('功能开发中，敬请期待'));
      return;
    }
    setActiveMode(key);
  };

  // 加载生图模型列表
  const fetchImageModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const res = await API.get('/api/pricing');
      const { success, data } = res.data;
      if (success && Array.isArray(data)) {
        // 筛选支持 image-generation 端点的模型
        const imgModels = data.filter(
          (model) =>
            model.supported_endpoint_types &&
            Array.isArray(model.supported_endpoint_types) &&
            model.supported_endpoint_types.includes(IMAGE_ENDPOINT_TYPE)
        );
        setImageModels(imgModels);
        // 默认选中第一个模型
        if (imgModels.length > 0 && !selectedModel) {
          setSelectedModel(imgModels[0].model_name);
        }
        // 如果当前选中的模型不在列表中，自动切换到第一个可用模型
        if (imgModels.length > 0 && selectedModel) {
          const modelNames = imgModels.map((m) => m.model_name);
          if (!modelNames.includes(selectedModel)) {
            setSelectedModel(imgModels[0].model_name);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch image models:', error);
    }
    setModelsLoading(false);
  }, [selectedModel]);

  useEffect(() => {
    fetchImageModels();
  }, []);

  // 将比例字符串转换为 size 格式，根据质量等级动态计算
  const ratioToSize = (ratioStr, qualityLevel) => {
    const q = qualityLevel || quality;
    const base = QUALITY_BASE_SIZE[q] || 1080;
    // 解析比例
    const [rw, rh] = ratioStr.split(':').map(Number);
    if (!rw || !rh) return `${base}x${base}`;
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const g = gcd(rw, rh);
    const sw = rw / g;
    const sh = rh / g;
    // 以长边为 base 计算宽高
    let w, h;
    if (sw >= sh) {
      w = base;
      h = Math.round(base * sh / sw);
    } else {
      h = base;
      w = Math.round(base * sw / sh);
    }
    // 确保 8 的倍数（部分模型要求）
    w = Math.round(w / 8) * 8;
    h = Math.round(h / 8) * 8;
    return `${w}x${h}`;
  };

  // 辅助：根据当前比例和质量计算宽高
  const computeSize = (ratioStr, qualityLevel) => {
    const sizeStr = ratioToSize(ratioStr, qualityLevel);
    const [w, h] = sizeStr.split('x').map(Number);
    return { w, h };
  };

  // 切换比例时更新 customWidth/customHeight
  const handleRatioChange = (newRatio) => {
    setRatio(newRatio);
    const { w, h } = computeSize(newRatio, quality);
    setCustomWidth(String(w));
    setCustomHeight(String(h));
  };

  // 切换质量时更新 customWidth/customHeight
  const handleQualityChange = (newQuality) => {
    setQuality(newQuality);
    const { w, h } = computeSize(ratio, newQuality);
    setCustomWidth(String(w));
    setCustomHeight(String(h));
  };

  // 初始化 customWidth/customHeight
  useEffect(() => {
    const { w, h } = computeSize(ratio, quality);
    setCustomWidth(String(w));
    setCustomHeight(String(h));
  }, []);

  // 获取状态图标和文本
  const getStatusInfo = (status) => {
    switch (status) {
      case 'success':
        return { icon: <CheckCircle2 size={14} />, text: t('已完成'), cls: 'ig-status-success' };
      case 'failure':
        return { icon: <XCircle size={14} />, text: t('失败'), cls: 'ig-status-failure' };
      case 'submitted':
        return { icon: <Clock size={14} />, text: t('排队中'), cls: 'ig-status-pending' };
      case 'queued':
        return { icon: <Clock size={14} />, text: t('排队中'), cls: 'ig-status-pending' };
      case 'in_progress':
        return { icon: <Loader2 size={14} className='ig-spin' />, text: t('生成中'), cls: 'ig-status-progress' };
      default:
        return { icon: <Clock size={14} />, text: status || t('未知'), cls: 'ig-status-pending' };
    }
  };

  // 轮询任务状态
  const pollTaskStatus = useCallback((taskId, assetId) => {
    let attempts = 0;
    const maxAttempts = 120; // 最多轮询 120 次，每次 5s = 10 分钟
    const poll = async () => {
      attempts++;
      try {
        const res = await API.get(`/v1/video/generations/${taskId}`);
        const data = res.data;
        const status = data.status;

        setAssets((prev) =>
          prev.map((a) => {
            if (a.id !== assetId) return a;
            const updated = { ...a, status };
            if (status === 'success' || status === 'completed') {
              updated.status = 'success';
              updated.progress = '100%';
              // 从 result_url 或 data 中获取图片 URL
              if (data.result_url) {
                updated.imageUrl = data.result_url;
              } else if (data.data?.result_url) {
                updated.imageUrl = data.data.result_url;
              } else if (Array.isArray(data.data?.images) && data.data.images.length > 0) {
                updated.imageUrl = data.data.images[0].url;
              }
              updated.finishedAt = Date.now();
            } else if (status === 'failed' || status === 'failure') {
              updated.status = 'failure';
              updated.error = data.error?.message || data.fail_reason || t('生成失败');
              updated.finishedAt = Date.now();
            } else {
              updated.progress = data.progress || updated.progress;
            }
            return updated;
          })
        );

        // 如果任务还没完成，继续轮询
        if (status !== 'success' && status !== 'completed' && status !== 'failed' && status !== 'failure' && attempts < maxAttempts) {
          pollTimerRef.current = setTimeout(poll, 5000);
        }
      } catch (err) {
        console.error('Poll task error:', err);
        if (attempts < maxAttempts) {
          pollTimerRef.current = setTimeout(poll, 5000);
        }
      }
    };
    poll();
  }, []);

  // 生成
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      Toast.warning(t('请输入提示词'));
      return;
    }
    if (!selectedModel) {
      Toast.warning(t('请选择模型'));
      return;
    }

    setIsGenerating(true);
    setShowAssets(true);

    const assetId = Date.now();
    const newAsset = {
      id: assetId,
      prompt,
      model: selectedModel,
      status: 'in_progress',
      progress: '0%',
      imageUrl: null,
      error: null,
      createdAt: Date.now(),
      finishedAt: null,
    };

    setAssets((prev) => [newAsset, ...prev]);

    try {
      // 获取用户令牌
      let tokenKey = '';
      try {
        const tokenRes = await API.get('/api/token/?p=1&size=10');
        const { success: tokenSuccess, data: tokenData } = tokenRes.data;
        if (tokenSuccess) {
          const tokenItems = Array.isArray(tokenData) ? tokenData : tokenData?.items || [];
          const activeToken = tokenItems.find((t) => t.status === 1);
          if (activeToken) {
            tokenKey = await fetchTokenKey(activeToken.id);
          }
        }
      } catch (_) {
        // ignore
      }

      if (!tokenKey) {
        setAssets((prev) =>
          prev.map((a) =>
            a.id === assetId
              ? { ...a, status: 'failure', error: t('没有可用的API令牌，请先在令牌管理中创建'), finishedAt: Date.now() }
              : a
          )
        );
        setIsGenerating(false);
        return;
      }

      const authHeaders = { Authorization: `Bearer sk-${tokenKey}` };

      // 判断模型类型：Gemini 系列走 chat completions，其他走 images/generations
      const isGeminiImageModel = selectedModel.startsWith('gemini-');
      let data;

      if (isGeminiImageModel) {
        // Gemini 模型通过 chat completions 生图
        // 构建 content 数组：文本 + 参考图（如有）
        const contentParts = [];
        contentParts.push({ type: 'text', text: prompt });
        if (referenceImage) {
          // 提取 base64 数据和 mime type
          const refMatch = referenceImage.url.match(/^data:(image\/[^;]+);base64,(.+)$/);
          if (refMatch) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: referenceImage.url },
            });
          }
        }
        const chatRequestBody = {
          model: selectedModel,
          messages: [
            { role: 'user', content: contentParts.length === 1 && contentParts[0].type === 'text' ? prompt : contentParts },
          ],
        };
        const res = await API.post('/v1/chat/completions', chatRequestBody, {
          headers: authHeaders,
        });
        data = res.data;
        console.log('[ImageGenerator] Chat API response:', JSON.stringify(data)?.slice(0, 800));

        // 从 chat completions 响应中提取图片
        // Gemini 返回的图片可能在 content 中作为 inline_data 或 base64
        const choice = data.choices?.[0];
        if (choice) {
          const content = choice.message?.content || '';
          // 尝试提取 base64 图片数据 (data:image/xxx;base64,...)
          const base64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
          if (base64Match) {
            setAssets((prev) =>
              prev.map((a) =>
                a.id === assetId
                  ? { ...a, status: 'success', progress: '100%', imageUrl: base64Match[0], finishedAt: Date.now() }
                  : a
              )
            );
            Toast.success(t('图像生成成功'));
          } else if (data.error) {
            setAssets((prev) =>
              prev.map((a) =>
                a.id === assetId
                  ? { ...a, status: 'failure', error: data.error.message || t('生成失败'), finishedAt: Date.now() }
                  : a
              )
            );
            showError(data.error.message || t('图像生成失败'));
          } else {
            // Gemini 可能返回文本描述而非图片，或者图片以其他格式内嵌
            // 尝试找 markdown 图片链接
            const mdImageMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
            const imageUrl = mdImageMatch ? mdImageMatch[1] : null;
            if (imageUrl) {
              setAssets((prev) =>
                prev.map((a) =>
                  a.id === assetId
                    ? { ...a, status: 'success', progress: '100%', imageUrl, finishedAt: Date.now() }
                    : a
                )
              );
              Toast.success(t('图像生成成功'));
            } else {
              // 没有图片，可能是纯文本响应
              setAssets((prev) =>
                prev.map((a) =>
                  a.id === assetId
                    ? { ...a, status: 'failure', error: t('模型未返回图片，可能不支持图像生成'), finishedAt: Date.now() }
                    : a
                )
              );
            }
          }
        } else if (data.error) {
          setAssets((prev) =>
            prev.map((a) =>
              a.id === assetId
                ? { ...a, status: 'failure', error: data.error.message || t('生成失败'), finishedAt: Date.now() }
                : a
            )
          );
          showError(data.error.message || t('图像生成失败'));
        } else {
          setAssets((prev) =>
            prev.map((a) =>
              a.id === assetId
                ? { ...a, status: 'failure', error: t('未获取到图片结果'), finishedAt: Date.now() }
                : a
            )
          );
        }
      } else {
        // 非 Gemini 模型走标准 /v1/images/generations
        const size = ratioToSize(ratio);
        const requestBody = {
          model: selectedModel,
          prompt: prompt,
          n: count,
          size: size,
          quality: ['hd2k', 'uhd3k'].includes(quality) ? 'hd' : 'standard',
          response_format: 'url',
        };
        // 参考图：通过 image 字段传递 base64（Edits API 兼容）
        if (referenceImage) {
          requestBody.image = referenceImage.url;
        }

        const res = await API.post('/v1/images/generations', requestBody, {
          headers: authHeaders,
        });
        data = res.data;
        console.log('[ImageGenerator] Image API response:', JSON.stringify(data)?.slice(0, 500));

        // 检查是否是异步任务（返回 task_id）
        if (data.id && data.status && data.status !== 'completed') {
          // 异步任务模式
          setAssets((prev) =>
            prev.map((a) =>
              a.id === assetId ? { ...a, taskId: data.id, status: data.status } : a
            )
          );
          pollTaskStatus(data.id, assetId);
        } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          // 同步返回模式 (OpenAI 格式: { data: [{url: ...}] })
          const imageItem = data.data[0];
          const imageUrl = imageItem.url || imageItem.b64_json;
          setAssets((prev) =>
            prev.map((a) =>
              a.id === assetId
                ? { ...a, status: 'success', progress: '100%', imageUrl, finishedAt: Date.now() }
                : a
            )
          );
          Toast.success(t('图像生成成功'));
        } else if (data.error) {
          setAssets((prev) =>
            prev.map((a) =>
              a.id === assetId
                ? { ...a, status: 'failure', error: data.error.message || t('生成失败'), finishedAt: Date.now() }
                : a
            )
          );
          showError(data.error.message || t('图像生成失败'));
        } else {
          // 尝试多种格式解析
          let imageUrl = null;
          if (Array.isArray(data?.data) && data.data[0]) {
            imageUrl = data.data[0].url || data.data[0].b64_json;
          }
          if (!imageUrl && data.result_url) {
            imageUrl = data.result_url;
          }
          if (!imageUrl && Array.isArray(data?.images) && data.images[0]) {
            imageUrl = data.images[0].url || data.images[0];
          }
          if (!imageUrl && (data.output || data.url)) {
            imageUrl = data.output || data.url;
          }

          if (imageUrl) {
            setAssets((prev) =>
              prev.map((a) =>
                a.id === assetId
                  ? { ...a, status: 'success', progress: '100%', imageUrl, finishedAt: Date.now() }
                  : a
              )
            );
            Toast.success(t('图像生成成功'));
          } else {
            console.warn('[ImageGenerator] Unrecognized response format:', data);
            setAssets((prev) =>
              prev.map((a) =>
                a.id === assetId
                  ? { ...a, status: 'failure', error: t('未获取到图片结果，请查看控制台日志'), finishedAt: Date.now() }
                  : a
              )
            );
          }
        }
      }
    } catch (error) {
      const errMsg = error?.response?.data?.error?.message || error?.message || t('请求失败');
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? { ...a, status: 'failure', error: errMsg, finishedAt: Date.now() }
            : a
        )
      );
      showError(errMsg);
    }

    setIsGenerating(false);
  }, [prompt, selectedModel, count, ratio, quality, pollTaskStatus, t]);

  // 做同款
  const handleMakeSame = (item) => {
    setPrompt(item.title);
    Toast.info(t('已加载提示词'));
  };

  // 参考图片处理
  const handleRefImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Toast.warning(t('请选择图片文件'));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      Toast.warning(t('图片大小不能超过20MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setReferenceImage({ url: ev.target.result, name: file.name });
    };
    reader.readAsDataURL(file);
    // 重置 input 以便可以重复选择同一文件
    e.target.value = '';
  };

  const handleRemoveRefImage = () => {
    setReferenceImage(null);
  };

  // 删除资产
  const handleDeleteAsset = (assetId) => {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
  };

  // 清除已完成/失败的资产
  const handleClearFinished = () => {
    setAssets((prev) => prev.filter((a) => a.status === 'in_progress' || a.status === 'queued' || a.status === 'submitted'));
  };

  // 下载图片
  const handleDownload = async (url, filename) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'generated-image.png';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      Toast.error(t('下载失败'));
    }
  };

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  // 获取比例显示文本
  const getRatioText = () => {
    return `${ratio} | ${count}张`;
  };

  return (
    <div className='ig-page'>
      <div className='ig-container'>
        {/* 页面标题区 */}
        <div className='ig-hero'>
          <h1 className='ig-hero-title'>{t('图片创作')}</h1>
          <p className='ig-hero-subtitle'>{t('百变风格 超多模型供你选择')}</p>
        </div>

      {/* 生成面板 */}
      <div className='ig-panel'>
        {/* 模式切换标签 */}
        <div className='ig-mode-tabs'>
          {MODE_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`ig-mode-tab ${activeMode === tab.key ? 'active' : ''} ${tab.key !== 'image' ? 'disabled' : ''}`}
              onClick={() => handleModeSwitch(tab.key)}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>

        {/* 提示词输入 */}
        <div className='ig-prompt-area'>
          <textarea
            className='ig-prompt-input'
            placeholder={t('输入图片生成的提示词，例如：浩瀚的银河中一艘宇宙飞船驶过')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
          {/* 参考图预览 */}
          {referenceImage && (
            <div className='ig-ref-image-preview'>
              <img src={referenceImage.url} alt={referenceImage.name} className='ig-ref-image-thumb' />
              <div className='ig-ref-image-info'>
                <span className='ig-ref-image-name'>{referenceImage.name}</span>
                <span className='ig-ref-image-label'>{t('参考图')}</span>
              </div>
              <button className='ig-ref-image-remove' onClick={handleRemoveRefImage} title={t('移除参考图')}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* 操作栏 */}
        <div className='ig-toolbar'>
          <div className='ig-toolbar-left'>
            {/* 风格模型按钮 */}
            <button
              className='ig-btn-style-model'
              onClick={() => setShowStyleModal(true)}
            >
              <Sparkles size={16} />
              <span>{selectedStyleModel ? selectedStyleModel.model_name : t('风格模型')}</span>
            </button>

            {/* +图片按钮 / 参考图 */}
            <input
              type='file'
              accept='image/*'
              ref={refImageInputRef}
              style={{ display: 'none' }}
              onChange={handleRefImageSelect}
            />
            <button
              className={`ig-btn-add-image ${referenceImage ? 'has-image' : ''}`}
              onClick={() => refImageInputRef.current?.click()}
            >
              <ImagePlus size={16} />
              <span>{referenceImage ? t('参考图') : t('图片')}</span>
            </button>

            {/* 模型选择 */}
            <Select
              value={selectedModel || undefined}
              onChange={setSelectedModel}
              className='ig-model-select'
              style={{ width: 200 }}
              loading={modelsLoading}
              placeholder={modelsLoading ? t('加载中...') : t('选择模型')}
            >
              {imageModels.map((model) => (
                <Select.Option key={model.model_name} value={model.model_name}>
                  {model.model_name}
                </Select.Option>
              ))}
            </Select>
            <button
              className='ig-btn-refresh-models'
              onClick={fetchImageModels}
              title={t('刷新模型列表')}
              disabled={modelsLoading}
            >
              <RefreshCw size={14} className={modelsLoading ? 'ig-spin' : ''} />
            </button>

            {/* 比例/张数 */}
            <button
              className='ig-btn-ratio'
              onClick={() => setShowParamsModal(true)}
            >
              <span>{getRatioText()}</span>
              <ChevronDown size={14} />
            </button>

            {/* 设置按钮 */}
            <button className='ig-btn-settings'>
              <Settings2 size={18} />
            </button>
          </div>

          <div className='ig-toolbar-right'>
            {/* 生成按钮 */}
            <button
              className={`ig-btn-generate ${!prompt.trim() ? 'disabled' : ''}`}
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
            >
              {isGenerating ? (
                <span className='ig-generating-text'>{t('生成中...')}</span>
              ) : (
                <>
                  <span>{t('生成')}</span>
                  <ArrowUp size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ====== 最近生成展示区（始终显示，在灵感区上方） ======*/}
      {assets.length > 0 && (
        <div className='ig-recent-section'>
          <div className='ig-recent-header'>
            <h3>{t('最近生成')}</h3>
            <button className='ig-btn-more' onClick={() => setShowAssets(true)}>{t('查看全部')}</button>
          </div>
          <div className='ig-recent-grid'>
            {assets
              .slice(0, 6)
              .map((asset) => (
                <div key={asset.id} className='ig-recent-card'>
                  {asset.status === 'success' && asset.imageUrl ? (
                    <>
                      <img
                        src={asset.imageUrl.startsWith('data:') ? asset.imageUrl : asset.imageUrl}
                        alt={asset.prompt}
                        className='ig-recent-image'
                        onClick={() => setPreviewImage(asset)}
                      />
                      <div className='ig-recent-overlay'>
                        <button className='ig-recent-action' onClick={() => setPreviewImage(asset)} title={t('查看大图')}>
                          <ZoomIn size={16} />
                        </button>
                        <button className='ig-recent-action' onClick={() => handleDownload(asset.imageUrl, `${asset.model}-${asset.id}.png`)} title={t('下载')}>
                          <Download size={16} />
                        </button>
                      </div>
                    </>
                  ) : asset.status === 'failure' ? (
                    <div className='ig-recent-failed'>
                      <XCircle size={28} strokeWidth={1.5} />
                      <span>{asset.error || t('生成失败')}</span>
                    </div>
                  ) : (
                    <div className='ig-recent-loading'>
                      <Loader2 size={32} className='ig-spin' />
                      <span>{t('生成中...')}</span>
                      {asset.progress && <span className='ig-recent-progress'>{asset.progress}</span>}
                    </div>
                  )}
                  <div className='ig-recent-info'>
                    <span className='ig-recent-model'>{asset.model}</span>
                    <span className='ig-recent-prompt'>{asset.prompt?.length > 30 ? asset.prompt.slice(0, 30) + '...' : asset.prompt}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 灵感示例区 */}
      <div className='ig-inspiration'>
        <div className='ig-inspiration-header'>
          <h3>{t('来试试一键做同款')}</h3>
          <button className='ig-btn-more'>{t('查看更多')}</button>
        </div>
        <div className='ig-inspiration-grid'>
          {INSPIRATION_ITEMS.map((item) => (
            <div key={item.id} className='ig-inspiration-card'>
              <div className='ig-inspiration-img-wrap'>
                <img src={item.url} alt={item.title} className='ig-inspiration-img' />
                <div className='ig-inspiration-overlay'>
                  <button
                    className='ig-btn-makesame'
                    onClick={() => handleMakeSame(item)}
                  >
                    {t('做同款')}
                  </button>
                </div>
              </div>
              <div className='ig-inspiration-info'>
                <span className='ig-inspiration-model'>{item.model}</span>
                <span className='ig-inspiration-title'>{item.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ====== 我的资产面板 ====== */}
      {showAssets && (
        <div className='ig-assets-panel'>
          <div className='ig-assets-header'>
            <div className='ig-assets-header-left'>
              <Images size={18} />
              <h3>{t('我的生成')}</h3>
              <span className='ig-assets-count'>{assets.length}</span>
            </div>
            <div className='ig-assets-header-right'>
              {assets.some((a) => a.status === 'success' || a.status === 'failure') && (
                <button className='ig-btn-clear' onClick={handleClearFinished}>
                  {t('清除已完成')}
                </button>
              )}
              <button className='ig-btn-close-assets' onClick={() => setShowAssets(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div className='ig-assets-list'>
            {assets.length === 0 ? (
              <div className='ig-assets-empty'>
                <Images size={40} strokeWidth={1} />
                <span>{t('暂无生成记录')}</span>
              </div>
            ) : (
              assets.map((asset) => {
                const statusInfo = getStatusInfo(asset.status);
                return (
                  <div key={asset.id} className='ig-asset-card'>
                    {/* 缩略图/进度区域 */}
                    <div className='ig-asset-thumb'>
                      {asset.status === 'success' && asset.imageUrl ? (
                        <img
                          src={asset.imageUrl.startsWith('data:') ? asset.imageUrl : asset.imageUrl}
                          alt={asset.prompt}
                          className='ig-asset-image'
                          onClick={() => setPreviewImage(asset)}
                        />
                      ) : asset.status === 'failure' ? (
                        <div className='ig-asset-failed'>
                          <XCircle size={28} strokeWidth={1.5} />
                          <span>{asset.error || t('生成失败')}</span>
                        </div>
                      ) : (
                        <div className='ig-asset-loading'>
                          <Loader2 size={28} className='ig-spin' />
                          <span>{asset.progress || '0%'}</span>
                        </div>
                      )}
                    </div>

                    {/* 信息区域 */}
                    <div className='ig-asset-info'>
                      <div className='ig-asset-meta'>
                        <span className={`ig-asset-status ${statusInfo.cls}`}>
                          {statusInfo.icon}
                          {statusInfo.text}
                        </span>
                        <span className='ig-asset-model'>{asset.model}</span>
                      </div>
                      <p className='ig-asset-prompt'>{asset.prompt}</p>
                      <div className='ig-asset-time'>
                        <span>{new Date(asset.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className='ig-asset-actions'>
                      {asset.status === 'success' && asset.imageUrl && (
                        <>
                          <button
                            className='ig-asset-action-btn'
                            onClick={() => setPreviewImage(asset)}
                            title={t('查看大图')}
                          >
                            <ZoomIn size={16} />
                          </button>
                          <button
                            className='ig-asset-action-btn'
                            onClick={() => handleDownload(asset.imageUrl, `${asset.model}-${asset.id}.png`)}
                            title={t('下载')}
                          >
                            <Download size={16} />
                          </button>
                        </>
                      )}
                      <button
                        className='ig-asset-action-btn ig-asset-delete-btn'
                        onClick={() => handleDeleteAsset(asset.id)}
                        title={t('删除')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ====== 图片预览弹窗 ====== */}
      {previewImage && (
        <div className='ig-modal-overlay' onClick={() => setPreviewImage(null)}>
          <div className='ig-preview-modal' onClick={(e) => e.stopPropagation()}>
            <div className='ig-preview-header'>
              <span className='ig-preview-model'>{previewImage.model}</span>
              <div className='ig-preview-actions'>
                <button
                  className='ig-asset-action-btn'
                  onClick={() => handleDownload(previewImage.imageUrl, `${previewImage.model}-${previewImage.id}.png`)}
                  title={t('下载')}
                >
                  <Download size={18} />
                </button>
                <button className='ig-preview-close' onClick={() => setPreviewImage(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className='ig-preview-body'>
              <img
                src={previewImage.imageUrl.startsWith('data:') ? previewImage.imageUrl : previewImage.imageUrl}
                alt={previewImage.prompt}
                className='ig-preview-image'
              />
            </div>
            <div className='ig-preview-footer'>
              <p>{previewImage.prompt}</p>
            </div>
          </div>
        </div>
      )}

      {/* ====== 风格模型弹窗 ====== */}
      {showStyleModal && (
        <div className='ig-modal-overlay' onClick={() => setShowStyleModal(false)}>
          <div className='ig-style-modal' onClick={(e) => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <div className='ig-style-modal-header'>
              <div className='ig-style-modal-tabs'>
                <button className='ig-style-tab active'>{t('广场')}</button>
                <button className='ig-style-tab'>{t('我的收藏')}</button>
                <button className='ig-style-tab'>{t('最近使用')}</button>
              </div>
              <div className='ig-style-modal-search'>
                <Search size={16} />
                <input
                  type='text'
                  placeholder={t('输入模型名称、作者、标签搜索')}
                  className='ig-style-search-input'
                />
              </div>
              <button
                className='ig-style-modal-close'
                onClick={() => setShowStyleModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* 分类筛选 */}
            <div className='ig-style-categories'>
              {STYLE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`ig-category-btn ${selectedStyleCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedStyleCategory(cat)}
                >
                  {t(cat)}
                </button>
              ))}
            </div>

            {/* 模型网格 */}
            <div className='ig-style-grid'>
              {imageModels.length > 0 ? imageModels.map((model) => (
                <div
                  key={model.model_name}
                  className={`ig-style-card ${selectedStyleModel?.model_name === model.model_name ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedStyleModel(model);
                    setSelectedModel(model.model_name);
                    setShowStyleModal(false);
                    Toast.success(t('已选择') + ' ' + model.model_name);
                  }}
                >
                  <div className='ig-style-card-thumb'>
                    <img
                      src={model.icon || `https://picsum.photos/seed/${encodeURIComponent(model.model_name)}/300/200`}
                      alt={model.model_name}
                    />
                    {model.quota_type === 1 && <span className='ig-style-card-tag'>{'按次'}</span>}
                  </div>
                  <div className='ig-style-card-info'>
                    <span className='ig-style-card-name'>{model.model_name}</span>
                    <span className='ig-style-card-desc'>{model.description || model.vendor_name || ''}</span>
                  </div>
                </div>
              )) : (
                <div className='ig-style-empty'>
                  <span>{modelsLoading ? t('加载中...') : t('暂无可用的生图模型')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== 参数设置弹窗 ====== */}
      {showParamsModal && (
        <div className='ig-modal-overlay' onClick={() => setShowParamsModal(false)}>
          <div className='ig-params-modal' onClick={(e) => e.stopPropagation()}>
            {/* 生图模式 */}
            <div className='ig-params-section'>
              <label className='ig-params-label'>{t('生图模式')}</label>
              <div className='ig-params-options'>
                {GEN_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    className={`ig-params-option ${genMode === mode.value ? 'active' : ''}`}
                    onClick={() => setGenMode(mode.value)}
                  >
                    {t(mode.label)}
                  </button>
                ))}
              </div>
            </div>

            {/* 图像质量 */}
            <div className='ig-params-section'>
              <label className='ig-params-label'>{t('图像质量')}</label>
              <div className='ig-params-options'>
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.value}
                    className={`ig-params-option ${quality === q.value ? 'active' : ''}`}
                    onClick={() => handleQualityChange(q.value)}
                  >
                    {t(q.label)}
                  </button>
                ))}
              </div>
            </div>

            {/* 图片尺寸 */}
            <div className='ig-params-section'>
              <label className='ig-params-label'>{t('图片尺寸')}</label>
              <div className='ig-ratio-grid'>
                {RATIO_PRESETS.map((r) => (
                  <button
                    key={r}
                    className={`ig-ratio-btn ${ratio === r ? 'active' : ''}`}
                    onClick={() => handleRatioChange(r)}
                  >
                    <span className='ig-ratio-label'>{r}</span>
                    <span className='ig-ratio-size'>{ratioToSize(r)}</span>
                  </button>
                ))}
              </div>
              <div className='ig-custom-size'>
                <div className='ig-size-input-group'>
                  <label>W</label>
                  <input
                    type='number'
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    className='ig-size-input'
                  />
                </div>
                <div className='ig-size-input-group'>
                  <label>H</label>
                  <input
                    type='number'
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    className='ig-size-input'
                  />
                </div>
              </div>
            </div>

            {/* 张数 */}
            <div className='ig-params-section'>
              <label className='ig-params-label'>{t('图片张数')}</label>
              <div className='ig-params-options'>
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    className={`ig-params-option ${count === n ? 'active' : ''}`}
                    onClick={() => setCount(n)}
                  >
                    {n}张{n === 4 ? ' ✦' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* 确认按钮 */}
            <div className='ig-params-confirm'>
              <Button
                type='primary'
                onClick={() => setShowParamsModal(false)}
                block
              >
                {t('确认')}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default ImageGenerator;
