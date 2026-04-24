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

import React, { useState, useCallback, useEffect, useRef, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select, Toast, Modal, Spin } from '@douyinfe/semi-ui';
import { API, showError } from '@/helpers';
import { UserContext } from '@/context/User';
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
  ShieldAlert,
  AlertCircle,
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

// 尺寸预设：每种比例对应两档质量的固定标准分辨率
// standard = 720p 基准（短边 720），hd = 1.5K 基准（短边 1080）
const SIZE_PRESETS = [
  { ratio: '1:1',  standard: '720x720',   hd: '1440x1440' },
  { ratio: '4:3',  standard: '960x720',   hd: '1440x1080' },
  { ratio: '3:4',  standard: '720x960',   hd: '1080x1440' },
  { ratio: '16:9', standard: '1280x720',  hd: '1920x1080' },
  { ratio: '9:16', standard: '720x1280',  hd: '1080x1920' },
  { ratio: '3:2',  standard: '1080x720',  hd: '1620x1080' },
  { ratio: '2:3',  standard: '720x1080',  hd: '1080x1620' },
  { ratio: '21:9', standard: '1680x720',  hd: '2520x1080' },
];

// 兼容旧代码：比例字符串列表
const RATIO_PRESETS = SIZE_PRESETS.map((p) => p.ratio);

// 图片质量（保留供后续扩展）
const QUALITY_OPTIONS = [
  { value: 'standard', label: '标准' },
  { value: 'hd',       label: '高清 HD' },
];

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

const PREF_KEY = 'ig_prefs';
const loadPref = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; } };
const savePref = (patch) => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...loadPref(), ...patch })); } catch {} };

const ImageGenerator = () => {
  const { t } = useTranslation();
  const [activeMode, setActiveMode] = useState('image');
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [imageModels, setImageModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [selectedStyleCategory, setSelectedStyleCategory] = useState(loadPref().styleCategory || '全部');
  const [selectedStyleModel, setSelectedStyleModel] = useState(null);
  const [showParamsModal, setShowParamsModal] = useState(false);
  const [genMode, setGenMode] = useState('single');
  const [quality, setQuality] = useState(loadPref().quality || 'standard');
  const [ratio, setRatio] = useState(loadPref().ratio || '1:1');
  // customWidth/customHeight: 当用户手动输入时，不再跟随比例预设
  // null 表示“未手动输入，跟随比例预设”
  const [customWidth, setCustomWidth] = useState(null);
  const [customHeight, setCustomHeight] = useState(null);
  const [count, setCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceImage, setReferenceImage] = useState(null); // { url: base64/data-url, name: filename }
  const refImageInputRef = useRef(null);

  // 获取当前用户ID，用于localStorage隔离
  // userLoaded: 用户状态是否已从后端/缓存加载完毕（避免初始化时 userId 为 'guest' 导致数据丢失）
  const [userState] = useContext(UserContext);
  const userLoaded = userState?.user !== undefined;
  const userId = userState?.user?.id || 'guest';
  const assetStorageKey = `ig_assets_${userId}`;

  // 资产数据兼容处理：将 localStorage 中缺字段的旧数据补全默认字段
  const normalizeAsset = (a) => ({
    id: a.id ?? Date.now(),
    prompt: a.prompt ?? '',
    model: a.model ?? '',
    status: a.status ?? 'failure',
    progress: a.progress ?? '0%',
    taskId: a.taskId ?? null,
    imageUrl: a.imageUrl ?? null,
    expireAt: a.expireAt ?? null,
    serverId: a.serverId ?? null,
    fromServer: a.fromServer ?? false,
    error: a.error ?? null,
    createdAt: a.createdAt ?? Date.now(),
    finishedAt: a.finishedAt ?? null,
  });

  // 生成资产列表 - 初始加载时尝试优先读取已登录用户的资产键，防止用 guest 键覆盖真实数据
  const [assets, setAssets] = useState(() => {
    try {
      // 先尝试从 localStorage 中找到已登录用户的真实 ID
      let effectiveKey = assetStorageKey;
      try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const userObj = JSON.parse(userRaw);
          const realId = userObj?.id || userObj?.user?.id;
          if (realId && realId !== 'guest') {
            effectiveKey = `ig_assets_${realId}`;
          }
        }
      } catch { /* 解析失败则用默认 key */ }
      const saved = localStorage.getItem(effectiveKey);
      return saved ? JSON.parse(saved).map(normalizeAsset) : [];
    } catch { return []; }
  });
  const [showAssets, setShowAssets] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  // 用 Map 存储多个任务的轮询定时器，key 为 assetId
  const pollTimersRef = useRef(new Map());

  // 同步 assets 到 localStorage（保留所有记录，最多100条）
  // 仅在 userLoaded 后才写入，避免将空数组写入真实用户的 key
  useEffect(() => {
    if (!userLoaded) return;
    try {
      const toSave = assets.slice(0, 100);
      localStorage.setItem(assetStorageKey, JSON.stringify(toSave));
    } catch { /* localStorage 满了就忽略 */ }
  }, [assets, assetStorageKey, userLoaded]);

  // 当用户ID变化时，重新加载该用户的资产，并停止旧的轮询
  // 仅在 userLoaded 后响应，避免加载中状态误触发清空
  useEffect(() => {
    if (!userLoaded) return;
    // 停止所有旧轮询
    pollTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    pollTimersRef.current.clear();
    try {
      // 加载当前用户的已有资产
      const savedRaw = localStorage.getItem(assetStorageKey);
      const savedAssets = savedRaw ? JSON.parse(savedRaw).map(normalizeAsset) : [];

      // 迁移：如果 guest key 下有资产（用户登录前生成的），合并到当前用户 key
      if (userId !== 'guest') {
        const guestKey = 'ig_assets_guest';
        const guestRaw = localStorage.getItem(guestKey);
        if (guestRaw) {
          try {
            const guestAssets = JSON.parse(guestRaw).map(normalizeAsset);
            if (guestAssets.length > 0) {
              // 合并：guest 资产放前面（更新），去重（以 id 为准）
              const existingIds = new Set(savedAssets.map((a) => a.id));
              const toMigrate = guestAssets.filter((a) => !existingIds.has(a.id));
              const merged = [...toMigrate, ...savedAssets].slice(0, 100);
              localStorage.removeItem(guestKey);
              setAssets(merged);
              return;
            }
          } catch { /* guest 数据损坏，忽略 */ }
          localStorage.removeItem(guestKey);
        }
      }

      setAssets(savedAssets);
    } catch { setAssets([]); }

    // 登录用户：从服务器拉取历史记录，合并到本地列表
    if (userId !== 'guest') {
      API.get('/api/user/image-assets?page=1&page_size=50')
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data?.data?.items)) {
            const serverAssets = res.data.data.items.map((item) => ({
              id: item.id,
              prompt: item.prompt || '',
              model: item.model || '',
              status: 'success',
              progress: '100%',
              taskId: null,
              imageUrl: item.public_url,
              expireAt: item.expire_at,
              serverId: item.id,
              error: null,
              createdAt: new Date(item.created_at).getTime(),
              finishedAt: new Date(item.created_at).getTime(),
              fromServer: true,
            }));
            setAssets((prev) => {
              // 以本地列表为主（包含未完成的任务），服务器记录归并到末尾（去重）
              const localIds = new Set(prev.filter((a) => !a.fromServer).map((a) => a.id));
              const serverOnly = serverAssets.filter((a) => !localIds.has(a.id));
              return [...prev.filter((a) => !a.fromServer), ...serverOnly].slice(0, 100);
            });
          }
        })
        .catch((e) => console.warn('[ImageGenerator] 拉取服务器记录失败:', e?.message));
    }
  }, [assetStorageKey, userLoaded]);

  // 模式切换
  const handleModeSwitch = (key) => {
    if (key !== 'image') {
      Toast.info(t('功能开发中，敬请期待'));
      return;
    }
    setActiveMode(key);
  };

  // 加载生图模型列表
  const fetchImageModels = useCallback(async (forceRefresh = false) => {
    setModelsLoading(true);
    try {
      // 强制刷新时加时间戳参数，绕过后端 1 分钟内存缓存
      const url = forceRefresh ? `/api/pricing?_t=${Date.now()}` : '/api/pricing';
      const res = await API.get(url, forceRefresh ? { disableDuplicate: true } : undefined);
      const { success, data } = res.data;
      if (success && Array.isArray(data)) {
        // 筛选条件：tags 字段包含 "image" 标签，或 supported_endpoint_types 包含 image-generation（兼容旧配置）
        const imgModels = data.filter((model) => {
          // 检查 tags 字段（逗号/空格分隔的字符串）
          if (model.tags && typeof model.tags === 'string') {
            const tagList = model.tags.split(/[,\s]+/).map((t) => t.trim().toLowerCase());
            if (tagList.some((tag) => tag === 'image' || tag.startsWith('image'))) {
              return true;
            }
          }
          // 兼容旧配置：检查 supported_endpoint_types
          if (
            model.supported_endpoint_types &&
            Array.isArray(model.supported_endpoint_types) &&
            model.supported_endpoint_types.includes(IMAGE_ENDPOINT_TYPE)
          ) {
            return true;
          }
          return false;
        });
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
        if (forceRefresh) {
          Toast.success(t('模型列表已刷新'));
        }
      }
    } catch (error) {
      console.error('Failed to fetch image models:', error);
      if (forceRefresh) {
        Toast.error(t('刷新失败，请稍后重试'));
      }
    }
    setModelsLoading(false);
  }, [selectedModel, t]);

  useEffect(() => {
    fetchImageModels();
  }, []);

  // 根据比例和质量获取标准尺寸字符串
  const ratioToSize = (ratioStr, qualityLevel) => {
    const q = qualityLevel || quality;
    const preset = SIZE_PRESETS.find((p) => p.ratio === ratioStr);
    if (!preset) return '720x720';
    return preset[q] || preset['standard'];
  };

  // 计算当前实际发送的尺寸：手动输入优先，否则用比例+质量预设
  const getEffectiveSize = () => {
    if (customWidth && customHeight) {
      return `${customWidth}x${customHeight}`;
    }
    return ratioToSize(ratio, quality);
  };

  // 切换比例时：清除手动尺寸输入，存偏好
  const handleRatioChange = (newRatio) => {
    setRatio(newRatio);
    setCustomWidth(null);
    setCustomHeight(null);
    savePref({ ratio: newRatio });
  };

  // 切换质量时：存偏好，清除手动尺寸（让尺寸跟随质量变化）
  const handleQualityChange = (newQuality) => {
    setQuality(newQuality);
    setCustomWidth(null);
    setCustomHeight(null);
    savePref({ quality: newQuality });
  };

  // 手动输入尺寸时：清除比例选中状态
  const handleCustomWidthChange = (val) => {
    setCustomWidth(val);
    if (val) setRatio('');
  };
  const handleCustomHeightChange = (val) => {
    setCustomHeight(val);
    if (val) setRatio('');
  };

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

  // 轮询任务状态（支持多任务并行轮询）
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

        const isTerminal = status === 'success' || status === 'completed' || status === 'failed' || status === 'failure';
        if (isTerminal) {
          // 任务完成，清理该任务的轮询记录
          pollTimersRef.current.delete(assetId);
        } else if (attempts < maxAttempts) {
          // 继续轮询
          const timerId = setTimeout(poll, 5000);
          pollTimersRef.current.set(assetId, timerId);
        } else {
          // 超出最大次数，标记为超时失败
          setAssets((prev) =>
            prev.map((a) =>
              a.id === assetId && (a.status === 'in_progress' || a.status === 'queued' || a.status === 'submitted')
                ? { ...a, status: 'failure', error: t('轮询超时，请刷新页面查看最终状态'), finishedAt: Date.now() }
                : a
            )
          );
          pollTimersRef.current.delete(assetId);
        }
      } catch (err) {
        console.error('Poll task error:', err);
        if (attempts < maxAttempts) {
          const timerId = setTimeout(poll, 5000);
          pollTimersRef.current.set(assetId, timerId);
        } else {
          pollTimersRef.current.delete(assetId);
        }
      }
    };
    // 如果已有该任务的轮询，先停止旧的
    if (pollTimersRef.current.has(assetId)) {
      clearTimeout(pollTimersRef.current.get(assetId));
    }
    poll();
  }, [t]);

  // 页面加载/用户切换时，自动恢复未完成任务的轮询
  // pollTaskStatusRef 用于在 useEffect 中安全引用最新的 pollTaskStatus
  const pollTaskStatusRef = useRef(null);
  pollTaskStatusRef.current = pollTaskStatus;

  useEffect(() => {
    const pendingStatuses = ['in_progress', 'queued', 'submitted'];
    const pendingAssets = assets.filter(
      (a) => pendingStatuses.includes(a.status) && a.taskId && !pollTimersRef.current.has(a.id)
    );
    pendingAssets.forEach((a) => {
      console.log(`[ImageGenerator] 恢复任务轮询: assetId=${a.id}, taskId=${a.taskId}`);
      pollTaskStatusRef.current(a.taskId, a.id);
    });
    // 只在 assetStorageKey 变化（用户切换）时执行，不跟随 assets 变化（避免死循环）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetStorageKey]);

  // 识别内容安全/平台限制类错误
  const isContentPolicyError = (msg) => {
    if (!msg) return false;
    const lower = String(msg).toLowerCase();
    return (
      lower.includes('safety') ||
      lower.includes('content policy') ||
      lower.includes('content_policy') ||
      lower.includes('no images were generated') ||
      lower.includes('moderation') ||
      lower.includes('violat') ||
      lower.includes('inappropriate') ||
      lower.includes('harmful') ||
      lower.includes('blocked') ||
      lower.includes('content filter') ||
      lower.includes('rejected') ||
      lower.includes('内容审核') ||
      lower.includes('安全审查') ||
      lower.includes('违规') ||
      lower.includes('不合适')
    );
  };

  // 识别 token 超限类错误
  const isTokenLimitError = (msg) => {
    if (!msg) return false;
    const lower = String(msg).toLowerCase();
    return (
      lower.includes('token over limit') ||
      lower.includes('context length') ||
      lower.includes('context_length_exceeded') ||
      lower.includes('maximum context') ||
      lower.includes('too many tokens') ||
      lower.includes('max_tokens') ||
      lower.includes('token limit') ||
      lower.includes('over limit') ||
      lower.includes('超过最大长度') ||
      lower.includes('上下文过长') ||
      lower.includes('token超限')
    );
  };

  // 获取失败类型和提示信息
  const getFailureHint = (msg) => {
    if (isContentPolicyError(msg)) {
      return { type: 'policy', hint: t('提示词可能触发内容安全策略，请修改后重试') };
    }
    if (isTokenLimitError(msg)) {
      return { type: 'token', hint: t('提示词过长导致 token 超限，请简化描述后重试') };
    }
    return { type: 'error', hint: null };
  };

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
      taskId: null,
      imageUrl: null,
      error: null,
      createdAt: Date.now(),
      finishedAt: null,
    };

    setAssets((prev) => [newAsset, ...prev]);

    // 假进度条：在同步请求期间模拟进度增长，让用户知道任务在进行
    // 进度曲线：0 -> 30%(5s) -> 60%(15s) -> 80%(30s) -> 90%(60s) ，请求完成后立即跳到 100%
    let fakeProgress = 0;
    const fakeProgressTimer = { id: null };
    const FAKE_PROGRESS_STEPS = [
      { target: 30, delay: 5000 },
      { target: 60, delay: 15000 },
      { target: 80, delay: 30000 },
      { target: 90, delay: 60000 },
    ];
    let stepIdx = 0;
    const advanceFakeProgress = () => {
      if (stepIdx >= FAKE_PROGRESS_STEPS.length) return;
      const step = FAKE_PROGRESS_STEPS[stepIdx++];
      fakeProgressTimer.id = setTimeout(() => {
        fakeProgress = step.target;
        setAssets((prev) =>
          prev.map((a) =>
            a.id === assetId && a.status === 'in_progress'
              ? { ...a, progress: `${fakeProgress}%` }
              : a
          )
        );
        advanceFakeProgress();
      }, step.delay);
    };
    advanceFakeProgress();
    const stopFakeProgress = () => {
      if (fakeProgressTimer.id) clearTimeout(fakeProgressTimer.id);
    };

    // 辅助函数：提取错误信息（展开多种格式）
    const extractErrMsg = (err, fallback) => {
      // axios 错误：HTTP 错误状态码对应的响应体
      const respData = err?.response?.data;
      if (respData) {
        const msg = respData?.error?.message || respData?.message || respData?.msg || respData?.detail;
        if (msg) return String(msg);
        // 如果是字符串直接返回
        if (typeof respData === 'string') return respData;
      }
      // 超时识别
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        return t('请求超时，请检查网络或稍后重试');
      }
      return err?.message || fallback || t('请求失败');
    };

    // 辅助函数：从响应体中提取图片 URL（支持多种格式）
    const extractImageUrl = (d) => {
      if (!d) return null;
      if (Array.isArray(d.data) && d.data.length > 0) {
        return d.data[0]?.url || d.data[0]?.b64_json || null;
      }
      return d.result_url || d.url || d.output ||
        (Array.isArray(d.images) && d.images.length > 0 ? (d.images[0]?.url || d.images[0]) : null) ||
        null;
    };

    // 辅助函数：将资产更新为失败状态
    const markFailure = (msg) => {
      stopFakeProgress();
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, status: 'failure', error: msg, finishedAt: Date.now() } : a
        )
      );
    };

    // 辅助函数：将图片 URL 保存到服务器，返回服务器内部 URL（失败时回退用原 URL）
    const saveImageToServer = async (imageUrl) => {
      if (userId === 'guest') return imageUrl; // 未登录不保存
      try {
        const res = await API.post('/api/user/image-assets', {
          image_url: imageUrl,
          prompt,
          model: selectedModel,
          size: getEffectiveSize(),
          quality,
        });
        if (res.data?.success && res.data?.data?.public_url) {
          return { url: res.data.data.public_url, expireAt: res.data.data.expire_at, serverId: res.data.data.id };
        }
      } catch (e) {
        console.warn('[ImageGenerator] 保存图片到服务器失败:', e?.message);
      }
      return { url: imageUrl, expireAt: null, serverId: null };
    };

    // 辅助函数：将资产更新为成功状态
    const markSuccess = async (imageUrl) => {
      stopFakeProgress();
      // 异步保存到服务器，获取持久化 URL 和过期时间
      const { url: finalUrl, expireAt, serverId } = await saveImageToServer(imageUrl);
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? { ...a, status: 'success', progress: '100%', imageUrl: finalUrl, expireAt, serverId, finishedAt: Date.now() }
            : a
        )
      );
      Toast.success(t('图像生成成功'));
    };

    try {
      // 获取用户令牌
      let tokenKey = '';
      try {
        const tokenRes = await API.get('/api/token/?p=1&size=10', { timeout: 10000 });
        const { success: tokenSuccess, data: tokenData } = tokenRes.data;
        if (tokenSuccess) {
          const tokenItems = Array.isArray(tokenData) ? tokenData : tokenData?.items || [];
          const activeToken = tokenItems.find((t) => t.status === 1);
          if (activeToken) {
            tokenKey = await fetchTokenKey(activeToken.id);
          }
        }
      } catch (tokenErr) {
        console.warn('[ImageGenerator] 获取令牌失败:', tokenErr?.message);
      }

      if (!tokenKey) {
        markFailure(t('没有可用的API令牌，请先在令牌管理中创建'));
        setIsGenerating(false);
        return;
      }

      const authHeaders = { Authorization: `Bearer sk-${tokenKey}` };
      // 生图最长等待 120s，应对模型较慢的情况
      const REQUEST_TIMEOUT = 120000;

      // 判断请求方式：优先检查模型是否配置了 image-generation 端点类型
      // 有 image-generation 端点 → 走 /v1/images/generations（标准生图 API）
      // 没有 → fallback 到 /v1/chat/completions（兆容 Gemini 等通过对话形式返回图片的模型）
      const selectedModelInfo = imageModels.find((m) => m.model_name === selectedModel);
      const hasImageGenerationEndpoint =
        selectedModelInfo?.supported_endpoint_types &&
        Array.isArray(selectedModelInfo.supported_endpoint_types) &&
        selectedModelInfo.supported_endpoint_types.includes(IMAGE_ENDPOINT_TYPE);
      
      // Gemini 模型即使配置了 image-generation 端点，也必须走 chat completions
      // （Gemini 的 /images/generations 只支持 imagen 系列，普通 gemini-* 模型不支持）
      const isGeminiModel = selectedModel.toLowerCase().startsWith('gemini-');
      const useChatAPI = !hasImageGenerationEndpoint || isGeminiModel;
      let data;

      if (useChatAPI) {
        // 没有配置 image-generation 端点，走 chat completions（如 Gemini 等通过对话形式返回图片的模型）
        const contentParts = [{ type: 'text', text: prompt }];
        if (referenceImage) {
          const refMatch = referenceImage.url.match(/^data:(image\/[^;]+);base64,(.+)$/);
          if (refMatch) {
            contentParts.push({ type: 'image_url', image_url: { url: referenceImage.url } });
          }
        }
        const chatRequestBody = {
          model: selectedModel,
          messages: [
            { role: 'user', content: contentParts.length === 1 ? prompt : contentParts },
          ],
        };

        let res;
        try {
          res = await API.post('/v1/chat/completions', chatRequestBody, {
            headers: authHeaders,
            timeout: REQUEST_TIMEOUT,
          });
        } catch (reqErr) {
          const errMsg = extractErrMsg(reqErr, t('请求失败'));
          console.error('[ImageGenerator] Gemini 请求异常:', reqErr);
          markFailure(errMsg);
          showError(errMsg);
          setIsGenerating(false);
          return;
        }

        data = res.data;
        console.log('[ImageGenerator] Chat API response:', JSON.stringify(data)?.slice(0, 800));

        // 先检查响应体层面的 error 字段
        if (data?.error) {
          const errMsg = data.error.message || t('生成失败');
          markFailure(errMsg);
          showError(errMsg);
        } else {
          const choice = data?.choices?.[0];
          const rawContent = choice?.message?.content || '';
          // content 可能是数组格式（多部分内容）
          const contentStr = typeof rawContent === 'string'
            ? rawContent
            : JSON.stringify(rawContent);

          // 优先尝试提取 base64 图片
          const base64Match = contentStr.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
          // 其次尝试 markdown 图片链接
          const mdImageMatch = contentStr.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
          // 最后尝试普通 URL
          const urlMatch = contentStr.match(/https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp|gif)[^\s"'<>]*/i);

          const imageUrl = base64Match?.[0] || mdImageMatch?.[1] || urlMatch?.[0] || null;

          if (imageUrl) {
            await markSuccess(imageUrl);
          } else if (choice) {
            // 有响应但没图片
            const detailMsg = contentStr.length > 0
              ? t('模型未返回图片，可能不支持图像生成') + `：${contentStr.slice(0, 100)}`
              : t('模型未返回图片，可能不支持图像生成');
            markFailure(detailMsg);
          } else {
            markFailure(t('未获取到图片结果'));
          }
        }
      } else {
        // 模型配置了 image-generation 端点，走标准 /v1/images/generations
        const size = getEffectiveSize();
        const requestBody = {
          model: selectedModel,
          prompt: prompt,
          n: count,
          size: size,
          quality: quality,
          response_format: 'url',
        };
        if (referenceImage) {
          requestBody.image = referenceImage.url;
        }

        let res;
        try {
          res = await API.post('/v1/images/generations', requestBody, {
            headers: authHeaders,
            timeout: REQUEST_TIMEOUT,
          });
        } catch (reqErr) {
          const errMsg = extractErrMsg(reqErr, t('请求失败'));
          console.error('[ImageGenerator] 生图请求异常:', reqErr);
          markFailure(errMsg);
          showError(errMsg);
          setIsGenerating(false);
          return;
        }

        data = res.data;
        console.log('[ImageGenerator] Image API response:', JSON.stringify(data)?.slice(0, 500));

        // 先检查响应体 error
        if (data?.error) {
          const errMsg = data.error.message || t('生成失败');
          markFailure(errMsg);
          showError(errMsg);
        } else if (data?.id && data?.status && data.status !== 'completed') {
          // 异步任务模式：返回 task_id
          setAssets((prev) =>
            prev.map((a) =>
              a.id === assetId ? { ...a, taskId: data.id, status: data.status } : a
            )
          );
          // 进入异步轮询模式，停止假进度（轮询有真实进度）
          stopFakeProgress();
          pollTaskStatus(data.id, assetId);
        } else {
          // 同步返回模式：尝试多种格式解析
          const imageUrl = extractImageUrl(data);
          if (imageUrl) {
            await markSuccess(imageUrl);
          } else {
            console.warn('[ImageGenerator] 无法识别的响应格式:', data);
            markFailure(t('未获取到图片结果，请查看控制台日志'));
          }
        }
      }
    } catch (error) {
      // 捕获未预期的全局异常
      stopFakeProgress();
      const errMsg = extractErrMsg(error, t('未知错误'));
      console.error('[ImageGenerator] 未预期异常:', error);
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
  }, [prompt, selectedModel, count, ratio, quality, referenceImage, pollTaskStatus, t]);

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

  // 清理轮询定时器（组件卸载时只清游标记器，不改变localStorage状态，下次进来可自动恢复）
  useEffect(() => {
    return () => {
      pollTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      pollTimersRef.current.clear();
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
              onClick={() => fetchImageModels(true)}
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
              .slice(0, 4)
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
                    (() => {
                      const { type, hint } = getFailureHint(asset.error);
                      return (
                        <div className={`ig-recent-failed${type !== 'error' ? ` ig-recent-failed--${type}` : ''}`}>
                          {type === 'policy' ? <ShieldAlert size={28} strokeWidth={1.5} />
                            : type === 'token' ? <AlertCircle size={28} strokeWidth={1.5} />
                            : <XCircle size={28} strokeWidth={1.5} />}
                          <span>{asset.error || t('生成失败')}</span>
                          {hint && <span className='ig-failed-hint'>{hint}</span>}
                        </div>
                      );
                    })()
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
                        (() => {
                          const { type, hint } = getFailureHint(asset.error);
                          return (
                            <div className={`ig-asset-failed${type !== 'error' ? ` ig-asset-failed--${type}` : ''}`}>
                              {type === 'policy' ? <ShieldAlert size={28} strokeWidth={1.5} />
                                : type === 'token' ? <AlertCircle size={28} strokeWidth={1.5} />
                                : <XCircle size={28} strokeWidth={1.5} />}
                              <span>{asset.error || t('生成失败')}</span>
                              {hint && <span className='ig-failed-hint'>{hint}</span>}
                            </div>
                          );
                        })()
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
                        {asset.expireAt && (
                          <span className='ig-asset-expire'>
                            {t('保存至')} {new Date(asset.expireAt).toLocaleDateString()} {t('（90天后自动删除）')}
                          </span>
                        )}
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
                  onClick={() => { setSelectedStyleCategory(cat); savePref({ styleCategory: cat }); }}
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
                {SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.ratio}
                    className={`ig-ratio-btn ${ratio === preset.ratio ? 'active' : ''}`}
                    onClick={() => handleRatioChange(preset.ratio)}
                  >
                    <span className='ig-ratio-label'>{preset.ratio}</span>
                    <span className='ig-ratio-size'>{ratioToSize(preset.ratio, quality)}</span>
                  </button>
                ))}
              </div>
              <div className='ig-custom-size'>
                <div className='ig-size-input-group'>
                  <label>W</label>
                  <input
                    type='number'
                    value={customWidth ?? (ratio ? ratioToSize(ratio, quality).split('x')[0] : '')}
                    onChange={(e) => handleCustomWidthChange(e.target.value)}
                    className='ig-size-input'
                    placeholder={ratio ? ratioToSize(ratio, quality).split('x')[0] : ''}
                  />
                </div>
                <div className='ig-size-input-group'>
                  <label>H</label>
                  <input
                    type='number'
                    value={customHeight ?? (ratio ? ratioToSize(ratio, quality).split('x')[1] : '')}
                    onChange={(e) => handleCustomHeightChange(e.target.value)}
                    className='ig-size-input'
                    placeholder={ratio ? ratioToSize(ratio, quality).split('x')[1] : ''}
                  />
                </div>
                {(customWidth || customHeight) && (
                  <button
                    className='ig-size-reset'
                    onClick={() => { setCustomWidth(null); setCustomHeight(null); }}
                    title={t('重置为比例尺寸')}
                  >↺</button>
                )}
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
