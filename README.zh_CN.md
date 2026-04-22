<div align="center">

# Yumo

**新一代大模型网关与AI资产管理系统**

<p align="center">
  <strong>简体中文</strong> |
  <a href="./README.zh_TW.md">繁體中文</a> |
  <a href="./README.md">English</a> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a>
</p>

</div>

## 项目简介

Yumo 是一个统一的 AI API 网关，将 40+ 上游 AI 提供商（OpenAI、Claude、Gemini、Azure、AWS Bedrock 等）聚合在单一 API 接口后。提供用户管理、计费、速率限制和管理仪表板。

## 快速开始

### 使用 Docker Compose（推荐）

```bash
# 克隆项目
git clone https://github.com/your-org/yumo.git
cd yumo

# 编辑 docker-compose.yml 配置
nano docker-compose.yml

# 启动服务
docker-compose up -d
```

### 使用 Docker 命令

```bash
# 使用 SQLite（默认）
docker run --name yumo -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  yumo:latest

# 使用 MySQL
docker run --name yumo -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/yumo" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  yumo:latest
```

部署完成后，访问 `http://localhost:3000` 即可使用！

---

## 部署要求

| 组件 | 要求 |
|------|------|
| **本地数据库** | SQLite（Docker 需挂载 `/data` 目录）|
| **远程数据库** | MySQL ≥ 5.7.8 或 PostgreSQL ≥ 9.6 |
| **容器引擎** | Docker / Docker Compose |

---

## 环境变量配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SESSION_SECRET` | 会话密钥（多机部署必须） | - |
| `CRYPTO_SECRET` | 加密密钥（Redis 必须） | - |
| `SQL_DSN` | 数据库连接字符串 | - |
| `REDIS_CONN_STRING` | Redis 连接字符串 | - |
| `STREAMING_TIMEOUT` | 流式超时时间（秒） | `300` |
| `STREAM_SCANNER_MAX_BUFFER_MB` | 流式扫描器单行最大缓冲（MB） | `64` |
| `MAX_REQUEST_BODY_MB` | 请求体最大大小（MB） | `32` |
| `AZURE_DEFAULT_API_VERSION` | Azure API 版本 | `2025-04-01-preview` |

---

## 主要特性

### 核心功能

| 特性 | 说明 |
|------|------|
| 全新 UI | 现代化的用户界面设计 |
| 多语言 | 支持中文、英文、法语、日语 |
| 数据看板 | 可视化控制台与统计分析 |
| 权限管理 | 令牌分组、模型限制、用户管理 |

### 支付与计费

- 在线充值（易支付、Stripe）
- 模型按次数收费
- 缓存计费支持（OpenAI、Azure、DeepSeek、Claude、Qwen等所有支持的模型）
- 灵活的计费策略配置

### 授权与安全

- Discord 授权登录
- Telegram 授权登录
- OIDC 统一认证

### API 格式支持

- OpenAI Responses
- OpenAI Realtime API（含 Azure）
- Claude Messages
- Google Gemini
- Rerank 模型（Cohere、Jina）

### 智能路由

- 渠道加权随机
- 失败自动重试
- 用户级别模型限流

### 格式转换

- OpenAI Compatible ⇄ Claude Messages
- OpenAI Compatible → Google Gemini
- Google Gemini → OpenAI Compatible（仅支持文本）
- 思考转内容功能

---

## 模型支持

| 模型类型 | 说明 |
|---------|------|
| OpenAI-Compatible | OpenAI 兼容模型 |
| OpenAI Responses | OpenAI Responses 格式 |
| Claude | Messages 格式 |
| Gemini | Google Gemini 格式 |
| Rerank | Cohere、Jina |
| Midjourney-Proxy | Midjourney 接口支持 |
| Suno-API | Suno 音乐 API |
| 自定义 | 支持完整调用地址 |

---

## 多机部署注意事项

> **警告：**
> - **必须设置** `SESSION_SECRET` - 否则登录状态不一致
> - **公用 Redis 必须设置** `CRYPTO_SECRET` - 否则数据无法解密

---

## 缓存配置

- `REDIS_CONN_STRING`：Redis 缓存（推荐）
- `MEMORY_CACHE_ENABLED`：内存缓存

---

## 本地开发

### 后端（Go）

```bash
# 构建后端
make build-backend

# 运行后端
make start-backend
```

### 前端（React + Vite）

```bash
cd web

# 安装依赖
bun install

# 开发服务器
bun run dev

# 生产构建
bun run build
```

---

## 技术栈

- **后端**: Go 1.22+, Gin web framework, GORM v2 ORM
- **前端**: React 18, Vite, Semi Design UI
- **数据库**: SQLite, MySQL, PostgreSQL
- **缓存**: Redis + 内存缓存
- **认证**: JWT, WebAuthn/Passkeys, OAuth

---

## 许可证

本项目采用 GNU Affero 通用公共许可证 v3.0 (AGPLv3) 授权。