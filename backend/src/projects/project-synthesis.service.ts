import { Injectable, OnModuleInit } from "@nestjs/common";
import { OllamaService } from "../ollama/ollama.service";
import { PrismaService } from "../prisma.service";
import { ExecutionStateService } from "../execution-state/execution-state.service";
import { RealTimeService } from "../realtime/real-time.service";
import { AgentType, Stage } from "@prisma/client";

interface ParsedTask {
  title: string;
  agentType: AgentType;
  description: string;
  priority?: string;
  stage?: Stage;
  stageOrder?: number;
  parallelGroup?: string;
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
  private currentStep = '';
  private readonly MAX_CONCURRENT = 1;

  constructor(
    private ollama: OllamaService,
    private prisma: PrismaService,
    private executionState: ExecutionStateService,
    private realtimeService: RealTimeService,
  ) {}

  onModuleInit() {
    console.log('[ProjectSynthesis] Analysis queue initialized - max concurrent:', this.MAX_CONCURRENT);
  }

  // Get queue status for frontend
  getQueueStatus() {
    return {
      queue: this.analysisQueue.map(job => ({
        projectId: job.projectId,
        timestamp: Date.now(), // Approximate
      })),
      isProcessing: this.isProcessing,
      currentStep: this.currentStep,
      queueSize: this.analysisQueue.length,
      activeExecutions: this.executionState.getActiveExecutions(),
    };
  }

  // Emit analysis started event immediately for notification
  emitAnalysisStarted(projectId: string) {
    console.log(`[Analysis] Emitting analysis:started for project ${projectId}`);
    this.realtimeService.broadcast('analysis:started', { projectId });
  }

  // Queue-based analysis - ensures sequential processing
  async analyzeAndRespond(projectId: string): Promise<any> {
    console.log(`[Analysis Queue] Adding project ${projectId} to queue`);
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
    console.log(`[Analysis Queue] processQueue called. isProcessing=${this.isProcessing}, queue=${this.analysisQueue.length}`);
    if (this.isProcessing) return;

    const job = this.analysisQueue.shift();
    if (!job) {
      console.log(`[Analysis Queue] No job, returning`);
      return;
    }

    this.isProcessing = true;
    this.currentStep = 'Đang phân tích dự án...';
    console.log(`[Analysis Queue] Processing project ${job.projectId}. Remaining: ${this.analysisQueue.length}`);

    try {
      const result = await this.doAnalyzeAndRespond(job.projectId);
      this.currentStep = 'Hoàn tất!';
      job.resolve(result);
    } catch (error) {
      console.error(`[Analysis Queue] Error:`, error);
      this.currentStep = 'Đã xảy ra lỗi';
      job.reject(error);
    } finally {
      this.isProcessing = false;
      setTimeout(() => { this.currentStep = ''; }, 3000);
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

### Stage: PLANNING (Giai đoạn 1 - Lập kế hoạch)

#### Task 1: [Tên công việc cụ thể]
- Agent: [CODING/QA/UX/DATA/PM]
- Mô tả: [Mô tả chi tiết công việc cần làm]
- Ưu tiên: [Cao/Trung bình/Thấp]
- Stage: PLANNING
- StageOrder: 1
- ParallelGroup: [group-id] (để trống nếu task độc lập)

#### Task 2: [Tên công việc cụ thể]
- Agent: [CODING/QA/UX/DATA/PM]
- Mô tả: [Mô tả chi tiết công việc cần làm]
- Ưu tiên: [Cao/Trung bình/Thấp]
- Stage: PLANNING
- StageOrder: 2
- ParallelGroup: [group-id]

### Stage: DESIGN (Giai đoạn 2 - Thiết kế)

#### Task 3: [Tên công việc cụ thể]
- Agent: [CODING/QA/UX/DATA/PM]
- Mô tả: [Mô tả chi tiết công việc cần làm]
- Ưu tiên: [Cao/Trung bình/Thấp]
- Stage: DESIGN
- StageOrder: 1
- ParallelGroup: [group-id]

### Stage: DEVELOPMENT (Giai đoạn 3 - Phát triển)

#### Task 4: [Tên công việc cụ thể]
- Agent: [CODING/QA/UX/DATA/PM]
- Mô tả: [Mô tả chi tiết công việc cần làm]
- Ưu tiên: [Cao/Trung bình/Thấp]
- Stage: DEVELOPMENT
- StageOrder: 1
- ParallelGroup: [group-id]

### Stage: TESTING (Giai đoạn 4 - Kiểm thử)

### Stage: DEPLOYMENT (Giai đoạn 5 - Triển khai)

Hãy đảm bảo:
- Mỗi task có mô tả rõ ràng, actionable
- Các task được sắp xếp theo thứ tự ưu tiên
- Phân công hợp lý cho từng agent
- Cân bằng khối lượng work giữa các agents
- Tasks chạy song song (VD: design UI + setup database) nên có cùng StageOrder và ParallelGroup
- Các giai đoạn: PLANNING → DESIGN → DEVELOPMENT → TESTING → DEPLOYMENT`;

    try {
      this.currentStep = 'Đang xóa dữ liệu cũ...';
      this.realtimeService.analysisProgress(projectId, 'Đang xóa dữ liệu cũ...', 'progress');
      // ========== XÓA DỮ LIỆU CŨ NHƯNG GIỮ LẠI TEAM CHAT ==========
      // Tìm và xóa các task cũ (KHÔNG phải team chat)
      const oldTasks = await this.prisma.task.findMany({
        where: { projectId: projectId, title: { not: "Project Team Chat" } },
        select: { id: true },
      });
      
      for (const task of oldTasks) {
        await this.prisma.message.deleteMany({
          where: { taskId: task.id },
        });
      }
      
      await this.prisma.task.deleteMany({
        where: { projectId: projectId, title: { not: "Project Team Chat" } },
      });
      
      console.log(`[Analysis] Cleared ${oldTasks.length} old tasks (kept Team Chat) for project ${projectId}`);
      
      this.currentStep = 'PM Agent đang phân tích...';
      this.realtimeService.analysisProgress(projectId, 'PM Agent đang phân tích...', 'progress');

      // Gọi PM Agent để phân tích và tạo tasks
      const response = await this.ollama.chat(
        [{ role: "user", content: `Hãy phân tích và lên kế hoạch cho dự án sau:\n\n${context}` }],
        systemPrompt
      );

      // Parse response để trích xuất các tasks
      const parsedTasks = this.parseTasksFromResponse(response);

      this.currentStep = `Đang tạo ${parsedTasks.length} tasks...`;
      this.realtimeService.analysisProgress(projectId, `Đang tạo ${parsedTasks.length} tasks...`, 'progress');

      // Tìm hoặc tạo mới Team Chat - KHÔNG xóa message cũ
      let teamChat = await this.prisma.task.findFirst({
        where: {
          projectId: projectId,
          title: "Project Team Chat",
        },
      });
      
      if (!teamChat) {
        teamChat = await this.prisma.task.create({
          data: {
            title: "Project Team Chat",
            description: "Shared chat for the entire project team",
            agentType: "PM",
            projectId: projectId,
            status: "DONE",
          },
        });
      }

      // Lưu PM's analysis vào team chat (THÊM MỚI, không xóa message cũ)
      await this.prisma.message.create({
        data: {
          role: "AGENT",
          content: response,
          taskId: teamChat.id,
        },
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
            stage: taskData.stage || Stage.PLANNING,
            stageOrder: taskData.stageOrder || 0,
            parallelGroup: taskData.parallelGroup,
          },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });
        createdTasks.push(task);
      }

      // Emit task created events for each task
      for (const task of createdTasks) {
        this.realtimeService.taskCreated(projectId, task);
      }

      // Emit analysis completed
      this.realtimeService.analysisCompleted(projectId, createdTasks, response);

      console.log(`[Analysis Queue] Completed re-analysis for project ${projectId}. Created ${createdTasks.length} new tasks.`);

      // Fetch teamChat với messages để trả về
      const teamChatWithMessages = await this.prisma.task.findUnique({
        where: { id: teamChat.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });

      return {
        teamChat: teamChatWithMessages,
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
    let currentStage: Stage = Stage.PLANNING;
    let currentStageOrder = 0;
    let currentParallelGroup: string | null = null;
    
    // Tách response thành các phần dựa trên header ### Task hoặc ### Stage
    const lines = response.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
      // Detect stage header
      const stageMatch = line.match(/###\s*Stage:\s*(\w+)/i);
      if (stageMatch) {
        const stageStr = stageMatch[1].trim().toUpperCase();
        if (['PLANNING', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'DEPLOYMENT', 'MAINTENANCE'].includes(stageStr)) {
          currentStage = stageStr as Stage;
          currentStageOrder = 0;
          currentParallelGroup = null;
        }
        continue;
      }
      
      // Detect task header - match both ### Task and #### Task
      if (line.match(/^#{3,4}\s*Task\s*\d+/i)) {
        // Process previous task if exists
        if (currentSection.trim()) {
          const parsed = this.parseSingleTask(currentSection, currentStage, currentStageOrder, currentParallelGroup);
          if (parsed) {
            tasks.push(parsed);
            currentStageOrder++;
          }
        }
        currentSection = line + '\n';
        continue;
      }
      
      currentSection += line + '\n';
    }
    
    // Process last task
    if (currentSection.trim()) {
      const parsed = this.parseSingleTask(currentSection, currentStage, currentStageOrder, currentParallelGroup);
      if (parsed) {
        tasks.push(parsed);
      }
    }

    // Fallback: nếu không parse được task nào, tạo 1 task tổng hợp
    if (tasks.length === 0) {
      tasks.push({
        title: 'Phân tích và lên kế hoạch dự án',
        agentType: 'PM',
        description: response.slice(0, 500),
        stage: Stage.PLANNING,
        stageOrder: 0,
      });
    }

    return tasks;
  }

  private parseSingleTask(
    section: string,
    defaultStage: Stage,
    defaultStageOrder: number,
    defaultParallelGroup: string | null
  ): ParsedTask | null {
    // Trích xuất tên task - hỗ trợ ### Task và #### Task
    const titleMatch = section.match(/#+\s*Task\s*\d+:?\s*([^\n-]+)/i);
    if (!titleMatch) return null;
    
    const title = titleMatch[1].trim();
    
    // Trích xuất agent type
    let agentType: AgentType = 'CODING';
    const agentMatch = section.match(/Agent:?:?\s*(\w+)/i);
    if (agentMatch) {
      const agentStr = agentMatch[1].trim().toUpperCase();
      if (['CODING', 'QA', 'UX', 'DATA', 'PM'].includes(agentStr)) {
        agentType = agentStr as AgentType;
      }
    }
    
    // Trích xuất stage
    let stage = defaultStage;
    const stageMatch = section.match(/Stage:?:?\s*(\w+)/i);
    if (stageMatch) {
      const stageStr = stageMatch[1].trim().toUpperCase();
      if (['PLANNING', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'DEPLOYMENT', 'MAINTENANCE'].includes(stageStr)) {
        stage = stageStr as Stage;
      }
    }
    
    // Trích xuất stageOrder
    let stageOrder = defaultStageOrder;
    const orderMatch = section.match(/StageOrder:?:?\s*(\d+)/i);
    if (orderMatch) {
      stageOrder = parseInt(orderMatch[1], 10);
    }
    
    // Trích xuất parallelGroup
    let parallelGroup: string | null = defaultParallelGroup;
    const groupMatch = section.match(/ParallelGroup:?:?\s*([\w-]+)/i);
    if (groupMatch) {
      const groupStr = groupMatch[1].trim();
      if (groupStr && groupStr !== '') {
        parallelGroup = groupStr;
      }
    }
    
    // Trích xuất mô tả
    let description = '';
    const descMatch = section.match(/Mô tả:?:?\s*([^\n-]+)/i);
    if (descMatch) {
      description = descMatch[1].trim();
    } else {
      const rest = section.replace(/#+\s*Task\s*\d+:?\s*[^\n]+/i, '').trim();
      description = rest.slice(0, 200);
    }
    
    // Trích xuất ưu tiên
    let priority = '';
    const priorityMatch = section.match(/Ưu tiên:?:?\s*(\w+)/i);
    if (priorityMatch) {
      priority = priorityMatch[1].trim();
    }
    
    return {
      title,
      agentType,
      description: `${description}${priority ? ` (Ưu tiên: ${priority})` : ''}`,
      priority,
      stage,
      stageOrder,
      parallelGroup,
    };
  }
}
