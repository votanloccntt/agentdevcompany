# 🤖 AI Development Team - Multi-Agent Web Platform

Nền tảng quản lý dự án với đội ngũ AI Agents (PM, Coding, QA, UX, Data) hoạt động như một team thực thụ.

![Tech Stack](https://img.shields.io/badge/Stack-Next.js%2014%2B%20|%20NestJS%10%2B%20|%20PostgreSQL%16%2B%20|%20Ollama-glimmer)

## ✨ Tính năng

- **🧠 AI Development Team** - 5 AI agents chuyên biệt phối hợp với nhau
- **📋 Project Management** - Tạo project, tự động phân công tasks
- **💬 Team Chat** - Chat với toàn bộ team hoặc từng agent riêng
- **📊 Progress Tracker** - Theo dõi tiến độ dự án trực quan
- **🔗 Project Context** - Agents có shared context để phối hợp hiệu quả
- **🌐 100% Local** - Chạy hoàn toàn local với Ollama

## 🛠️ Setup

### Yêu cầu

- Node.js 18+
- PostgreSQL (hoặc Docker)
- [Ollama](https://ollama.ai/) với model `gemma4:latest`

### 1. Clone & Install

```bash
cd web-agent
npm install
```

### 2. Setup Database

```bash
# Tạo database PostgreSQL
createdb web_agent

# Backend: Copy và chỉnh .env
cd backend
cp .env.example .env
# Chỉnh DATABASE_URL và JWT_SECRET trong .env

# Chạy migrations
npx prisma migrate dev
```

### 3. Pull Ollama Model

```bash
ollama pull gemma4:latest
```

### 4. Chạy Ứng dụng

```bash
# Terminal 1: Backend (port 5000)
cd backend
npm run dev

# Terminal 2: Frontend (port 3000)
cd frontend
npm run dev
```

### 5. Mở trình duyệt

```
http://localhost:3000
```

## 📁 Cấu trúc dự án

```
web-agent/
├── backend/           # NestJS API
│   ├── src/
│   │   ├── agents/          # 5 AI Agents
│   │   ├── auth/             # JWT Authentication
│   │   ├── ollama/           # Ollama Integration
│   │   ├── projects/         # Projects & Team Chat
│   │   └── tasks/            # Tasks Management
│   └── prisma/
│       └── schema.prisma     # Database Schema
├── frontend/          # Next.js 14 App
│   └── app/
│       ├── projects/         # Project pages
│       ├── agents/           # Agent pages
│       └── login/            # Auth pages
└── SPEC.md            # Project Specification
```

## 👥 AI Agents

| Agent | Màu | Chuyên môn |
|-------|-----|------------|
| 🔵 PM Agent | Xanh dương | Quản lý dự án, yêu cầu, timeline |
| 🟢 Coding Agent | Xanh lá | Full Stack Developer |
| 🟠 QA Agent | Cam | Quality Assurance, Testing |
| 🩷 UX Agent | Hồng | UX Design, Accessibility |
| 🔵 Data Agent | Cyan | Data Engineering |

## 🔧 Environment Variables

### Backend (.env)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/web_agent"
JWT_SECRET="your-super-secret-key-change-this"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="gemma4:latest"
PORT=5000
```

## 🚀 Workflow

```
Tạo Project → PM Agent phân tích & phân công → Team Chat → Hoàn thành Task
```

1. **Tạo Project** - PM Agent tự động phân tích
2. **Tasks được phân công** - Mỗi agent có task cụ thể
3. **Team Chat** - Chat với toàn bộ team
4. **Progress Tracker** - Theo dõi tiến độ
5. **Context Sharing** - Agents biết nhau đang làm gì

## 📝 License

MIT
