# Multi-Agent Web Platform - SPEC.md

## 1. Concept & Vision

A professional web-based AI agent platform that simulates a software company with specialized agents. Each agent is a domain expert: PM Agent coordinates, Coding Agent builds, QA Agent tests, UX Agent designs, and Data Agent analyzes. Users interact via a modern chat interface, delegating work just like hiring contractors.

**Feel**: Clean, fast, professional - like Linear meets ChatGPT. Dark theme with vibrant agent-specific accent colors.

---

## 2. Design Language

### Aesthetic Direction

Linear/Vercel-inspired dark UI with glass morphism accents and crisp typography.

### Color Palette

```
Background:     #09090b (zinc-950)
Surface:        #18181b (zinc-900)
Border:         #27272a (zinc-800)
Text Primary:   #fafafa (zinc-50)
Text Secondary: #a1a1aa (zinc-400)
Primary:        #6366f1 (indigo-500)

Agent Colors:
- PM Agent:     #3b82f6 (blue-500)
- Coding Agent: #22c55e (green-500)
- QA Agent:     #f97316 (orange-500)
- UX Agent:     #ec4899 (pink-500)
- Data Agent:   #06b6d4 (cyan-500)
```

### Typography

- Font: Inter (Google Fonts) with system fallbacks
- Headings: Bold, tight letter-spacing
- Body: Regular weight, relaxed line-height

### Motion

- Subtle fade-ins (opacity 0→1, 200ms ease-out)
- Button hover: scale(1.02) + brightness
- Chat messages: slide-up animation
- Page transitions: fade

---

## 3. Tech Stack

### Frontend

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS** + **Shadcn/UI**
- **Lucide React** (icons)
- **React Markdown** (render AI responses)
- **Framer Motion** (animations)
- **Axios** (HTTP client)

### Backend

- **NestJS** (Node.js framework)
- **Prisma** (ORM)
- **PostgreSQL** (database)
- **JWT** (authentication)
- **Ollama** (local LLM - gemma4:latest)

---

## 4. Project Structure

```
web-agent/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   └── dto/
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.service.ts
│   │   │   └── user.model.ts
│   │   ├── projects/
│   │   │   ├── projects.module.ts
│   │   │   ├── projects.controller.ts
│   │   │   ├── projects.service.ts
│   │   │   └── dto/
│   │   ├── tasks/
│   │   │   ├── tasks.module.ts
│   │   │   ├── tasks.controller.ts
│   │   │   ├── tasks.service.ts
│   │   │   └── dto/
│   │   ├── agents/
│   │   │   ├── agents.module.ts
│   │   │   ├── agents.controller.ts
│   │   │   ├── agents.service.ts
│   │   │   └── prompts.ts
│   │   ├── ollama/
│   │   │   ├── ollama.module.ts
│   │   │   └── ollama.service.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── package.json
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx (dashboard)
    │   ├── login/page.tsx
    │   ├── register/page.tsx
    │   ├── projects/
    │   │   ├── page.tsx
    │   │   └── [id]/
    │   │       ├── page.tsx
    │   │       └── tasks/[taskId]/page.tsx
    │   └── agents/page.tsx
    ├── components/
    │   ├── ui/ (shadcn)
    │   ├── AgentCard.tsx
    │   ├── ChatMessage.tsx
    │   ├── TaskCard.tsx
    │   ├── ProjectCard.tsx
    │   ├── Sidebar.tsx
    │   └── Header.tsx
    └── package.json
```

---

## 5. Features & Interactions

### Authentication

- Register with email/password
- Login returns JWT token
- Protected routes redirect to login

### Dashboard

- Stats cards: Total Projects, Active Tasks, Completed Tasks
- Recent Projects quick access
- Quick action buttons

### Projects

- Create project (name, description)
- List all projects as cards
- Click to enter project detail

### Tasks

- Create task with title, description, agent type
- Task statuses: PENDING → IN_PROGRESS → DONE (or FAILED)
- Real-time chat with agent (streaming)
- Conversation history

### Agents

- 5 specialized agents, each with unique:
  - Name & icon
  - Color accent
  - System prompt
  - Capabilities description
- Direct chat with any agent (no project context)

---

## 6. Database Schema

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  password  String
  name      String
  projects  Project[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  tasks       Task[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Task {
  id          String   @id @default(cuid())
  title       String
  description String?
  status      Status   @default(PENDING)
  agentType   AgentType
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  result      String?
  error       String?
  messages    Message[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Message {
  id        String   @id @default(cuid())
  role      Role
  content   String
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id])
  createdAt DateTime @default(now())
}

enum Status {
  PENDING
  IN_PROGRESS
  DONE
  FAILED
}

enum AgentType {
  PM
  CODING
  QA
  UX
  DATA
}

enum Role {
  USER
  AGENT
}
```

---

## 7. API Endpoints

### Auth

| Method | Endpoint       | Description        |
| ------ | -------------- | ------------------ |
| POST   | /auth/register | Register new user  |
| POST   | /auth/login    | Login, returns JWT |

### Projects

| Method | Endpoint      | Description          |
| ------ | ------------- | -------------------- |
| GET    | /projects     | List user's projects |
| POST   | /projects     | Create project       |
| GET    | /projects/:id | Get project details  |
| PUT    | /projects/:id | Update project       |
| DELETE | /projects/:id | Delete project       |

### Tasks

| Method | Endpoint                   | Description              |
| ------ | -------------------------- | ------------------------ |
| GET    | /projects/:projectId/tasks | List tasks               |
| POST   | /projects/:projectId/tasks | Create task              |
| GET    | /tasks/:id                 | Get task + messages      |
| POST   | /tasks/:id/chat            | Send message (streaming) |

### Agents

| Method | Endpoint     | Description       |
| ------ | ------------ | ----------------- |
| GET    | /agents      | List all agents   |
| POST   | /agents/chat | Direct agent chat |

---

## 8. Agent Definitions

### PM Agent

- **Icon**: Briefcase
- **Color**: Blue
- **Prompt**: "You are an expert Project Manager. Break down projects into tasks, create specifications, estimate effort, and coordinate development."

### Coding Agent

- **Icon**: Code
- **Color**: Green
- **Prompt**: "You are an expert Full Stack Developer. Write clean, production-ready code following best practices."

### QA Agent

- **Icon**: Bug
- **Color**: Orange
- **Prompt**: "You are an expert QA Engineer. Create test plans, write tests, find bugs, ensure quality."

### UX Agent

- **Icon**: Palette
- **Color**: Pink
- **Prompt**: "You are an expert UX Designer. Create user-centered designs, wireframes, improve UX."

### Data Agent

- **Icon**: Database
- **Color**: Cyan
- **Prompt**: "You are an expert Data Engineer. Work with data pipelines, databases, and analytics."
