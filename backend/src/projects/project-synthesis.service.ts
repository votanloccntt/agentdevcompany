import { Injectable, OnModuleInit } from "@nestjs/common";
import { OllamaService } from "../ollama/ollama.service";
import { PrismaService } from "../prisma.service";
import { AgentType } from "@prisma/client";

interface ParsedTask {
  title: string;
  agentType: AgentType;
  description: string;
  priority?: string;
}

// Queue item interface
interface AnalysisJob {
  projectId: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

@Injectable()
export class ProjectSynthesisService implements OnModuleInit {
  // Concurrency limiter - max 1 analysis at a time
  private analysisQueue: AnalysisJob[] = [];
  private isProcessing = false;
  private readonly MAX_CONCURRENT = 1;

  constructor(
    private ollama: OllamaService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    console.log('[ProjectSynthesis] Analysis queue initialized - max concurrent:', this.MAX_CONCURRENT);
  }

  // Queue-based analysis - ensures sequential processing
  async analyzeAndRespond(projectId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Add to queue
      this.analysisQueue.push({ projectId, resolve, reject });
      
      // Log queue status
      console.log(`[Analysis Queue] Job added for project ${projectId}. Queue size: ${this.analysisQueue.length}`);
      
      // Try to process
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    // Skip if already processing max concurrent
    if (this.isProcessing) {
      return;
    }

    // Get next job from queue
    const job = this.analysisQueue.shift();
    if (!job) {
      return;
    }

    this.isProcessing = true;
    console.log(`[Analysis Queue] Processing project ${job.projectId}. Remaining: ${this.analysisQueue.length}`);

    try {
      // Perform the actual analysis
      const result = await this.doAnalyzeAndRespond(job.projectId);
      job.resolve(result);
    } catch (error) {
      console.error(`[Analysis Queue] Error processing project ${job.projectId}:`, error);
      job.reject(error);
    } finally {
      this.isProcessing = false;
      // Process next in queue
      this.processQueue();
    }
  }

  private async doAnalyzeAndRespond(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    // Get or create Project Team Chat
    let teamChat = await this.prisma.task.findFirst({
      where: {
        projectId: projectId,
        title: "Project Team Chat",
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!teamChat) {
      teamChat = await this.prisma.task.create({
        data: {
          title: "Project Team Chat",
          description: "Shared chat for the entire project team",
          agentType: "PM",
          projectId: projectId,
          status: "IN_PROGRESS",
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }

    // Context từ project
    const context = `Tên dự án: ${project.name}
Mô tả: ${project.description || "Không có mô tả"}`;

    // System prompt cho PM Agent - yêu cầu phân tích và tạo tasks
    const systemPrompt = `Bạn là một Project Manager chuyên nghiệp với 15+ năm kinh nghiệm. Bạn được giao phân tích dự án mới và tạo ra kế hoạch công việc cho team.

Nhiệm vụ của bạn:
1. Phân tích dự án dựa trên tên và mô tả
2. Xác định các công việc cần thiết
3. Phân công công việc cho agent phù hợp:
   - CODING: Lập trình viên Full Stack - viết code, xây dựng tính năng
   - QA: Quality Assurance - viết tests, kiểm thử
   - UX: UX Designer - thiết kế trải nghiệm người dùng
   - DATA: Data Engineer - thiết kế database, data model
   - PM: Project Manager - quản lý, điều phối

Hãy phản hồi BẰNG TIẾNG VIỆT theo format sau:

## Phân tích dự án
[Đoạn văn phân tích ngắn gọn về dự án, các yêu cầu chính, và độ phức tạp]

## Kế hoạch công việc

### Task 1: [Tên công việc cụ thể]
- Agent: [CODING/QA/UX/DATA/PM]
- Mô tả: [Mô tả chi tiết công việc cần làm]
- Ưu tiên: [Cao/Trung bình/Thấp]

### Task 2: [Tên công việc cụ thể]
- Agent: [CODING/QA/UX/DATA/PM]
- Mô tả: [Mô tả chi tiết công việc cần làm]
- Ưu tiên: [Cao/Trung bình/Thấp]

[Liệt kê tất cả các công việc cần thiết, bao gồm:]
- Database design & setup
- Backend API development
- Frontend development
- Testing (unit, integration, E2E)
- UX research & design
- CI/CD setup
- Documentation
- Code review
- v.v.

Hãy đảm bảo:
- Mỗi task có mô tả rõ ràng, actionable
- Các task được sắp xếp theo thứ tự ưu tiên
- Phân công hợp lý cho từng agent
- Cân bằng khối lượng work giữa các agents`;

    try {
      // ========== XÓA DỮ LIỆU CŨ NGAY LẬP TỨC ==========
      const oldTasks = await this.prisma.task.findMany({
        where: { projectId: projectId },
        select: { id: true },
      });
      
      for (const task of oldTasks) {
        await this.prisma.message.deleteMany({
          where: { taskId: task.id },
        });
      }
      
      await this.prisma.task.deleteMany({
        where: { projectId: projectId },
      });
      
      console.log(`[Analysis] Cleared ${oldTasks.length} old tasks for project ${projectId}`);
      // ============================================

      // Gọi PM Agent để phân tích và tạo tasks
      const response = await this.ollama.chat(
        [{ role: "user", content: `Hãy phân tích và lên kế hoạch cho dự án sau:\n\n${context}` }],
        systemPrompt
      );

      // Parse response để trích xuất các tasks
      const parsedTasks = this.parseTasksFromResponse(response);

      // Tạo lại Project Team Chat mới
      const newTeamChat = await this.prisma.task.create({
        data: {
          title: "Project Team Chat",
          description: "Shared chat for the entire project team",
          agentType: "PM",
          projectId: projectId,
          status: "DONE",
          result: `Đã phân tích lại với ${parsedTasks.length} công việc`,
        },
      });

      // Lưu PM's analysis vào team chat
      await this.prisma.message.create({
        data: {
          role: "AGENT",
          content: response,
          taskId: newTeamChat.id,
        },
      });

      // Fetch teamChat with messages
      teamChat = await this.prisma.task.findUnique({
        where: { id: newTeamChat.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });

      // Tạo các tasks mới
      const createdTasks = [];
      for (const taskData of parsedTasks) {
        const task = await this.prisma.task.create({
          data: {
            title: taskData.title,
            description: taskData.description,
            agentType: taskData.agentType,
            projectId: projectId,
            status: "PENDING",
          },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });
        createdTasks.push(task);
      }

      console.log(`[Analysis Queue] Completed re-analysis for project ${projectId}. Created ${createdTasks.length} new tasks.`);

      return {
        teamChat,
        createdTasks,
        analysis: response,
      };
    } catch (error) {
      console.error("Error in project analysis:", error);
      throw error;
    }
  }

  async startProjectChat(projectId: string, userMessage?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    // Tìm hoặc tạo Project Team Chat
    let teamChat = await this.prisma.task.findFirst({
      where: {
        projectId: projectId,
        title: "Project Team Chat",
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!teamChat) {
      teamChat = await this.prisma.task.create({
        data: {
          title: "Project Team Chat",
          description: "Shared chat for the entire project team",
          agentType: "PM",
          projectId: projectId,
          status: "IN_PROGRESS",
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }

    // Nếu có user message, lưu vào chat
    if (userMessage) {
      await this.prisma.message.create({
        data: {
          role: "USER",
          content: userMessage,
          taskId: teamChat.id,
        },
      });
    }

    return teamChat;
  }

  async chat(projectId: string, userMessage: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    // Get or create Project Team Chat
    let teamChat = await this.prisma.task.findFirst({
      where: {
        projectId: projectId,
        title: "Project Team Chat",
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!teamChat) {
      teamChat = await this.prisma.task.create({
        data: {
          title: "Project Team Chat",
          description: "Shared chat for the entire project team",
          agentType: "PM",
          projectId: projectId,
          status: "IN_PROGRESS",
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }

    // Lưu user message
    await this.prisma.message.create({
      data: {
        role: "USER",
        content: userMessage,
        taskId: teamChat.id,
      },
    });

    // Build conversation history
    const history = teamChat.messages.map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    }));

    // System prompt cho AI Team
    const systemPrompt = `Bạn là trưởng nhóm của một đội phát triển AI gồm 5 chuyên gia:
- PM Agent (Xanh dương): Quản lý dự án
- Coding Agent (Xanh lá): Lập trình viên Full Stack  
- QA Agent (Cam): Quality Assurance
- UX Agent (Hồng): Thiết kế UX
- Data Agent (Cyan): Kỹ sư dữ liệu

Người dùng đang hỏi một câu hỏi hoặc đưa ra yêu cầu. Hãy để các agent liên quan phản hồi.
Bạn có thể involve 1 hoặc nhiều agents tùy theo mức độ phù hợp.

Hãy phản hồi BẰNG TIẾNG VIỆT.

Format một cách tự nhiên như một cuộc thảo luận nhóm. Mỗi agent chỉ nên nói khi chuyên môn của họ liên quan.`;

    try {
      // Gọi AI với context
      const response = await this.ollama.chat(
        [...history, { role: "user", content: userMessage }],
        systemPrompt
      );

      // Lưu agent response
      await this.prisma.message.create({
        data: {
          role: "AGENT",
          content: response,
          taskId: teamChat.id,
        },
      });

      // Update task status
      await this.prisma.task.update({
        where: { id: teamChat.id },
        data: { status: "IN_PROGRESS" },
      });

      // Return updated chat
      return this.prisma.task.findUnique({
        where: { id: teamChat.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    } catch (error) {
      console.error("Error in chat:", error);
      throw error;
    }
  }

  async chatStream(projectId: string, userMessage: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    // Get or create Project Team Chat
    let teamChat = await this.prisma.task.findFirst({
      where: {
        projectId: projectId,
        title: "Project Team Chat",
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!teamChat) {
      teamChat = await this.prisma.task.create({
        data: {
          title: "Project Team Chat",
          description: "Shared chat for the entire project team",
          agentType: "PM",
          projectId: projectId,
          status: "IN_PROGRESS",
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }

    // Lưu user message
    await this.prisma.message.create({
      data: {
        role: "USER",
        content: userMessage,
        taskId: teamChat.id,
      },
    });

    // Build conversation history
    const history = teamChat.messages.map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    }));

    // System prompt
    const systemPrompt = `Bạn là trưởng nhóm của một đội phát triển AI gồm 5 chuyên gia:
- PM Agent (Xanh dương): Quản lý dự án
- Coding Agent (Xanh lá): Lập trình viên Full Stack  
- QA Agent (Cam): Quality Assurance
- UX Agent (Hồng): Thiết kế UX
- Data Agent (Cyan): Kỹ sư dữ liệu

Người dùng đang hỏi một câu hỏi hoặc đưa ra yêu cầu. Hãy để các agent liên quan phản hồi.

Hãy phản hồi BẰNG TIẾNG VIỆT.
Format một cách tự nhiên như một cuộc thảo luận nhóm.`;

    // Stream response
    const stream = this.ollama.chatStream(
      [...history, { role: "user", content: userMessage }],
      systemPrompt
    );

    return { taskId: teamChat.id, stream };
  }

  private parseTasksFromResponse(response: string): ParsedTask[] {
    const tasks: ParsedTask[] = [];
    
    // Tìm tất cả các task blocks - hỗ trợ nhiều formats
    // Tách response thành các phần dựa trên header ### Task
    const sections = response.split(/(?=###\s*Task\s*\d+)/i);
    
    for (const section of sections) {
      if (!section.includes('###')) continue;
      
      // Trích xuất tên task
      const titleMatch = section.match(/###\s*Task\s*\d+:?\s*([^\n-]+)/i);
      if (!titleMatch) continue;
      
      const title = titleMatch[1].trim();
      
      // Trích xuất agent type
      let agentType: AgentType = 'CODING'; // default
      const agentMatch = section.match(/Agent:?:?\s*(\w+)/i);
      if (agentMatch) {
        const agentStr = agentMatch[1].trim().toUpperCase();
        if (['CODING', 'QA', 'UX', 'DATA', 'PM'].includes(agentStr)) {
          agentType = agentStr as AgentType;
        }
      }
      
      // Trích xuất mô tả
      let description = '';
      const descMatch = section.match(/Mô tả:?:?\s*([^\n-]+)/i);
      if (descMatch) {
        description = descMatch[1].trim();
      } else {
        const rest = section.replace(/###\s*Task\s*\d+:?\s*[^\n]+/i, '').trim();
        description = rest.slice(0, 200);
      }
      
      // Trích xuất ưu tiên
      let priority = '';
      const priorityMatch = section.match(/Ưu tiên:?:?\s*(\w+)/i);
      if (priorityMatch) {
        priority = priorityMatch[1].trim();
      }
      
      if (title && description) {
        tasks.push({
          title,
          agentType,
          description: `${description}${priority ? ` (Ưu tiên: ${priority})` : ''}`,
          priority,
        });
      }
    }

    // Fallback: nếu không parse được task nào, tạo 1 task tổng hợp
    if (tasks.length === 0) {
      tasks.push({
        title: 'Phân tích và lên kế hoạch dự án',
        agentType: 'PM',
        description: response.slice(0, 500),
      });
    }

    return tasks;
  }
}
