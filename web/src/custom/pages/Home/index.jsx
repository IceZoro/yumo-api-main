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

import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoConfig from '@/custom/config/logo-config';
import { StatusContext } from '../../../context/Status';
import { getSystemName, getLogo } from '../../../helpers';
import {
  OpenAI,
  Claude,
  Gemini,
  XAI,
  Midjourney,
} from '@lobehub/icons';
import './Home.css';

const models = [
  { name: 'GPT', desc: 'OpenAI 旗舰大语言模型', icon: <OpenAI size={32} /> },
  { name: 'Claude', desc: 'Anthropic 高性能对话模型', icon: <Claude.Color size={32} /> },
  { name: 'Grok', desc: 'xAI 高性能推理模型', icon: <XAI size={32} /> },
  { name: 'Gemini', desc: 'Google 多模态大模型', icon: <Gemini.Color size={32} /> },
  { name: 'Banana', desc: 'AI 图像生成服务', icon: '🍌' },
  { name: 'GPT-Image', desc: 'OpenAI 图像生成模型', icon: <OpenAI size={32} /> },
  { name: 'Midjourney', desc: '专业 AI 绘画引擎', icon: <Midjourney size={32} /> },
];

const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusState] = useContext(StatusContext);

  // 优先从 StatusContext 读取（后端推送后自动响应式更新），fallback 到 localStorage / 静态配置
  const systemName = statusState?.status?.system_name || getSystemName() || logoConfig.name;
  const logo = statusState?.status?.logo || getLogo() || logoConfig.logo;

  const handleGetStarted = () => {
    // 如果已登录则跳转到控制台，否则跳转到登录页
    const token = localStorage.getItem('user');
    if (token) {
      navigate('/console/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="home-page">
      {/* 动态光晕背景 */}
      <div className="home-bg" />

      {/* 顶部导航栏 */}
      <header className="home-header">
        <div className="home-header-left">
          <img
            src={logo}
            alt={systemName}
            className="home-logo"
          />
          <span className="home-brand">{systemName}</span>
        </div>
        <div className="home-header-right">
          <Link to="/login" className="home-nav-link">
            {t('登录')}
          </Link>
          <Link to="/register" className="home-nav-link home-nav-link-primary">
            {t('注册')}
          </Link>
        </div>
      </header>

      {/* Hero 区域 */}
      <section className="home-hero">
        <h1 className="home-hero-title">{t('智能 AI API 聚合平台')}</h1>
        <p className="home-hero-subtitle">
          {t('一站式接入 OpenAI、Claude、Gemini 等顶级大模型，统一接口、灵活计费、稳定高效')}
        </p>
        <button className="home-cta-button" onClick={handleGetStarted}>
          {t('开始使用')}
        </button>
      </section>

      {/* AI 模型卡片网格 */}
      <section className="home-models">
        <h2 className="home-models-title">{t('支持的 AI 模型')}</h2>
        <div className="home-models-grid">
          {models.map((model) => (
            <div key={model.name} className="home-model-card">
              <span className="home-model-icon">{model.icon}</span>
              <span className="home-model-name">{model.name}</span>
              <span className="home-model-desc">{t(model.desc)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 底部页脚 */}
      <footer className="home-footer">
        <p className="home-footer-text">
          © {new Date().getFullYear()} {systemName}. {t('版权所有')}
        </p>
      </footer>
    </div>
  );
};

export default Home;
