import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { OllamaService } from "../ollama/ollama.service";
import { AGENT_PROMPTS, AgentType } from "../agents/prompts";
import { ExecutionStateService } from "../execution-state/execution-state.service";
import { Task, Status } from "@prisma/client";

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private ollama: OllamaService,
    private executionState: ExecutionStateService,
  ) {}

  async findAll(projectId: string, userId: string): Promise<Task[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    if (project.userId !== userId) {
      throw new ForbiddenException("Access denied");
    }

    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(id: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (task.project.userId !== userId) {
      throw new ForbiddenException("Access denied");
    }

    return task;
  }

  async create(
    projectId: string,
    title: string,
    description: string | null,
    agentType: AgentType,
    userId: string,
  ): Promise<Task> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    if (project.userId !== userId) {
      throw new ForbiddenException("Access denied");
    }

    return this.prisma.task.create({
      data: {
        title,
        description,
        agentType,
        projectId,
        status: "PENDING",
      },
    });
  }

  async chat(
    taskId: string,
    userMessage: string,
    userId: string,
  ): Promise<{ messages: any[]; response: string }> {
    console.log(`[TasksService] chat() called for task ${taskId}`);
    const task = await this.findOne(taskId, userId);
    console.log(`[TasksService] Task found: ${task.title}, agentType: ${task.agentType}`);
    const agent = AGENT_PROMPTS[task.agentType];
    console.log(`[TasksService] Agent prompt loaded, systemPrompt length: ${agent.systemPrompt.length}`);

    // Track execution
    this.executionState.startExecution({
      taskId: task.id,
      taskTitle: task.title,
      agentType: task.agentType,
      projectId: task.projectId,
      projectName: task.project.name,
      currentStep: `Đang xử lý câu hỏi...`,
    });

    // Save user message
    await this.prisma.message.create({
      data: {
        role: "USER",
        content: userMessage,
        taskId,
      },
    });

    // Update task status
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: "IN_PROGRESS" },
    });

    // Get conversation history
    const history = await this.prisma.message.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });

    // Get project context - all tasks and their status
    const allTasks = await this.prisma.task.findMany({
      where: { projectId: task.projectId },
      select: {
        id: true,
        title: true,
        agentType: true,
        status: true,
        result: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Build project context for the agent
    const projectContext = `
## PROJECT CONTEXT
- Project: ${task.project.name}
- Mô tả: ${task.project.description || 'Không có mô tả'}

## CÁC TASK TRONG PROJECT:
${allTasks.map(t => `- [${t.status}] ${t.title} (${t.agentType})${t.result ? `: ${t.result.slice(0, 100)}...` : ''}`).join('\n')}

## TASK HIỆN TẠI:
- Task: ${task.title}
- Mô tả: ${task.description || 'Không có mô tả'}
- Agent: ${task.agentType}

Hãy phản hồi BẰNG TIẾNG VIỆT. Khi trả lời, hãy lưu ý:
1. Biết được project đang làm gì tổng thể
2. Các task khác đã làm gì để phối hợp tốt
3. Tập trung vào task hiện tại của bạn`;

    // Build messages for Ollama
    const ollamaMessages = history.slice(0, -1).map((m) => ({
      role: m.role.toLowerCase() as "user" | "assistant",
      content: m.content,
    }));

    // Add current message with project context
    const messageWithContext = `${projectContext}\n\n## CÂU HỎI CỦA USER:\n${userMessage}`;
    ollamaMessages.push({ role: "user" as const, content: messageWithContext });

    // Non-streaming response
    const enhancedPrompt = `${agent.systemPrompt}\n\n${projectContext}`;
    console.log(`[TasksService] Calling Ollama.chat()...`);
    this.executionState.updateStep(taskId, `AI đang tìm câu trả lời...`);
    const response = await this.ollama.chat(ollamaMessages, enhancedPrompt);
    console.log(`[TasksService] Ollama returned ${response.length} chars`);

    // Create and save agent message
    const agentMessage = await this.prisma.message.create({
      data: {
        role: "AGENT",
        content: response,
        taskId,
      },
    });

    // Update task status
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: "DONE", result: response },
    });

    // Complete execution tracking
    this.executionState.completeExecution(taskId, 'DONE');

    // Return updated history
    const updatedHistory = await this.prisma.message.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });

    return { messages: updatedHistory, response };
  }

  async updateStatus(
    taskId: string,
    status: Status,
    userId: string,
  ): Promise<Task> {
    const task = await this.findOne(taskId, userId);
    return this.prisma.task.update({
      where: { id: taskId },
      data: { status },
    });
  }
}
