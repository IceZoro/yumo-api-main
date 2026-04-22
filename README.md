<div align="center">

# Yumo

**Next-Generation LLM Gateway and AI Asset Management System**

<p align="center">
  <a href="./README.zh_CN.md">简体中文</a> |
  <a href="./README.zh_TW.md">繁體中文</a> |
  <strong>English</strong> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a>
</p>

</div>

## Overview

Yumo is a unified AI API gateway that aggregates 40+ upstream AI providers (OpenAI, Claude, Gemini, Azure, AWS Bedrock, etc.) behind a single API endpoint. It provides user management, billing, rate limiting, and an admin dashboard.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the project
git clone https://github.com/your-org/yumo.git
cd yumo

# Edit docker-compose.yml configuration
nano docker-compose.yml

# Start the service
docker-compose up -d
```

### Using Docker Commands

```bash
# Using SQLite (default)
docker run --name yumo -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  yumo:latest

# Using MySQL
docker run --name yumo -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/yumo" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  yumo:latest
```

After deployment, visit `http://localhost:3000` to start using!

---

## Deployment Requirements

| Component | Requirement |
|------|------|
| **Local database** | SQLite (Docker must mount `/data` directory)|
| **Remote database** | MySQL ≥ 5.7.8 or PostgreSQL ≥ 9.6 |
| **Container engine** | Docker / Docker Compose |

---

## Environment Variables

| Variable | Description | Default |
|--------|------|--------|
| `SESSION_SECRET` | Session secret (required for multi-machine deployment) | - |
| `CRYPTO_SECRET` | Encryption secret (required for Redis) | - |
| `SQL_DSN` | Database connection string | - |
| `REDIS_CONN_STRING` | Redis connection string | - |
| `STREAMING_TIMEOUT` | Streaming timeout (seconds) | `300` |
| `STREAM_SCANNER_MAX_BUFFER_MB` | Max per-line buffer (MB) for stream scanner | `64` |
| `MAX_REQUEST_BODY_MB` | Max request body size (MB) | `32` |
| `AZURE_DEFAULT_API_VERSION` | Azure API version | `2025-04-01-preview` |

---

## Key Features

### Core Functions

| Feature | Description |
|------|------|
| Modern UI | Modern user interface design |
| Multi-language | Supports Chinese, English, French, Japanese |
| Data Dashboard | Visual console and statistical analysis |
| Permission Management | Token grouping, model restrictions, user management |

### Payment and Billing

- Online recharge (EPay, Stripe)
- Pay-per-use model pricing
- Cache billing support (OpenAI, Azure, DeepSeek, Claude, Qwen and all supported models)
- Flexible billing policy configuration

### Authorization and Security

- Discord authorization login
- Telegram authorization login
- OIDC unified authentication

### API Format Support

- OpenAI Responses
- OpenAI Realtime API (including Azure)
- Claude Messages
- Google Gemini
- Rerank Models (Cohere, Jina)

### Intelligent Routing

- Channel weighted random
- Automatic retry on failure
- User-level model rate limiting

### Format Conversion

- OpenAI Compatible ⇄ Claude Messages
- OpenAI Compatible → Google Gemini
- Google Gemini → OpenAI Compatible (Text only)
- Thinking-to-content functionality

---

## Model Support

| Model Type | Description |
|---------|------|
| OpenAI-Compatible | OpenAI compatible models |
| OpenAI Responses | OpenAI Responses format |
| Claude | Messages format |
| Gemini | Google Gemini format |
| Rerank | Cohere, Jina |
| Midjourney-Proxy | Midjourney interface support |
| Suno-API | Suno music API |
| Custom | Supports complete call address |

---

## Multi-machine Deployment

> **Warning:**
> - **Must set** `SESSION_SECRET` - Otherwise login status inconsistent
> - **Shared Redis must set** `CRYPTO_SECRET` - Otherwise data cannot be decrypted

---

## Cache Configuration

- `REDIS_CONN_STRING`: Redis cache (recommended)
- `MEMORY_CACHE_ENABLED`: Memory cache

---

## Local Development

### Backend (Go)

```bash
# Build backend
make build-backend

# Run backend
make start-backend
```

### Frontend (React + Vite)

```bash
cd web

# Install dependencies
bun install

# Development server
bun run dev

# Build for production
bun run build
```

---

## Tech Stack

- **Backend**: Go 1.22+, Gin web framework, GORM v2 ORM
- **Frontend**: React 18, Vite, Semi Design UI
- **Databases**: SQLite, MySQL, PostgreSQL
- **Cache**: Redis + in-memory cache
- **Auth**: JWT, WebAuthn/Passkeys, OAuth

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPLv3).