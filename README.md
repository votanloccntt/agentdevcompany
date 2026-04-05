# 🤖 Web Agent Platform

Multi-Agent AI Platform với 5 chuyên gia AI: **PM Agent**, **Coding Agent**, **QA Agent**, **UX Agent**, **Data Agent**.

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 + TypeScript + TailwindCSS
- **Backend**: NestJS + Prisma + PostgreSQL
- **LLM**: Ollama (local, llama3.2)
- **Auth**: JWT

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+
- PostgreSQL (running locally or via Docker)
- Ollama (running at localhost:11434)

### 2. Setup Ollama

```bash
# Install Ollama
# macOS: brew install ollama
# Windows: Download from ollama.ai

# Pull llama3.2 model
ollama pull llama3.2

# Start Ollama server (usually auto-starts)
ollama serve
```

### 3. Database Setup

```bash
# Create PostgreSQL database
createdb web_agent

# Or via Docker
docker run --name postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=web_agent -p 5432:5432 -d postgres
```

### 4. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
echo "DATABASE_URL=postgresql://postgres:password@localhost:5432/web_agent" > .env
echo "JWT_SECRET=your-super-secret-key-change-in-production" >> .env

# Generate Prisma client & migrate
npx prisma generate
npx prisma migrate dev --name init

# Start backend
npm run start:dev
```

Backend running at: http://localhost:4000

### 5. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start frontend
npm run dev
```

Frontend running at: http://localhost:3000

## 📁 Project Structure

```
web-agent/
├── backend/              # NestJS API
│   ├── prisma/           # Database schema
│   ├── src/
│   │   ├── auth/         # Authentication (JWT)
│   │   ├── users/        # User management
│   │   ├── projects/     # Project CRUD
│   │   ├── tasks/        # Task management
│   │   ├── agents/       # Agent definitions & prompts
│   │   └── ollama/       # Ollama integration
│   └── package.json
├── frontend/             # Next.js app
│   ├── app/
│   │   ├── page.tsx      # Dashboard
│   │   ├── login/        # Login page
│   │   ├── register/     # Register page
│   │   ├── projects/     # Projects pages
│   │   └── agents/       # Direct agent chat
│   ├── components/        # UI components
│   └── package.json
└── README.md
```

## 🎯 Features

### Dashboard
- Stats overview (projects, tasks, completed)
- Quick actions
- Recent projects
- Agent showcase

### Projects
- Create/edit/delete projects
- Each project has its own tasks

### Tasks
- Create tasks with specific agent type
- Real-time chat with streaming responses
- Conversation history

### Agents
Each agent is a specialized AI:

| Agent | Color | Role |
|-------|-------|------|
| PM Agent | 🔵 Blue | Project management, requirements |
| Coding Agent | 🟢 Green | Full-stack development |
| QA Agent | 🟠 Orange | Testing, quality assurance |
| UX Agent | 🩷 Pink | User experience design |
| Data Agent | 🔵 Cyan | Data engineering, analytics |

## 🔌 API Endpoints

### Auth
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login (returns JWT)

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/projects/:projectId/tasks` - List tasks
- `POST /api/projects/:projectId/tasks` - Create task
- `GET /api/tasks/:id` - Get task + messages
- `POST /api/tasks/:id/chat/stream` - Chat (streaming)

### Agents
- `GET /api/agents` - List all agents
- `POST /api/agents/chat/stream` - Direct agent chat

## 🎨 Design

- Dark theme (Linear/Vercel inspired)
- Agent-specific accent colors
- Smooth animations
- Responsive layout

## 🔧 Troubleshooting

### Ollama not responding
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve
```

### Database connection failed
```bash
# Check PostgreSQL is running
docker ps  # if using Docker

# Or check local PostgreSQL
pg_isready
```

### Port already in use
- Backend: 4000
- Frontend: 3000
- Ollama: 11434

## 📝 License

MIT
