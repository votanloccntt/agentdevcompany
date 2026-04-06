import { Injectable } from '@nestjs/common';
import { OllamaService } from '../ollama/ollama.service';
import { PrismaService } from '../prisma.service';
import { RealTimeService } from '../realtime/real-time.service';
import { AgentType } from '@prisma/client';

export interface AgentMessage {
  sender: string;
  content: string;
  timestamp: Date;
  projectId: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

export interface CollaborationDecision {
  finalSolution: string;
  consensusReached: boolean;
  participatingAgents: string[];
  confidence: number;
  discussionLog?: AgentMessage[]; // Include discussion log for frontend display
}

@Injectable()
export class CollaborationService {
  constructor(
    private ollama: OllamaService,
    private prisma: PrismaService,
    private realtime: RealTimeService,
  ) {}

  /**
   * Process a message that requires multi-agent collaboration
   */
  async processCollaborativeMessage(
    projectId: string,
    message: string,
    initiatingAgent: string = 'PM',
  ): Promise<CollaborationDecision> {
    console.log(`[Collaboration] Processing collaborative message for project ${projectId}`);

    // Get project context
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Get all agents involved in the project
    const involvedAgents = Array.from(
      new Set(project.tasks.map(task => task.agentType))
    ) as string[];

    // Prepare collaboration context
    const collaborationContext = await this.buildCollaborationContext(
      projectId,
      message,
      project,
    );

    // Simulate round-robin discussion between agents
    const discussionLog: AgentMessage[] = [];
    let currentMessage = message;

    // Each agent contributes to the discussion
    for (const agentType of involvedAgents) {
      const agentResponse = await this.getAgentResponse(
        agentType,
        currentMessage,
        collaborationContext,
      );

      const agentMessage: AgentMessage = {
        sender: agentType,
        content: agentResponse,
        timestamp: new Date(),
        projectId,
        metadata: {
          round: discussionLog.length + 1,
          previousMessage: currentMessage,
        },
      };

      discussionLog.push(agentMessage);
      currentMessage = agentResponse; // Next agent builds on previous response

      // Broadcast intermediate result to team chat
      await this.broadcastToTeamChat(projectId, agentMessage);
    }

    // Generate final consensus
    const finalDecision = await this.generateFinalDecision(
      discussionLog,
      collaborationContext,
    );

    // Return decision with discussion log for frontend display
    return {
      ...finalDecision,
      discussionLog,
    };
  }

  private async buildCollaborationContext(
    projectId: string,
    initialMessage: string,
    project: any,
  ): Promise<string> {
    // Get all tasks and their status
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    return `
PROJECT CONTEXT FOR COLLABORATION:
- Project: ${project.name}
- Description: ${project.description || 'No description'}
- Created: ${project.createdAt}

ALL PROJECT TASKS:
${tasks.map(t => `- [${t.status}] ${t.title} (${t.agentType}): ${t.result || 'No result yet'}`).join('\n')}

INITIAL REQUEST:
${initialMessage}

COLLABORATION RULES:
1. Agents should build upon each other's ideas
2. Consider constraints from other tasks
3. Aim for consensus on best solution
4. Respond in Vietnamese
`;
  }

  private async getAgentResponse(
    agentType: string,
    message: string,
    context: string,
  ): Promise<string> {
    const agentPrompts = {
      PM: `You are a Project Manager agent. Focus on planning, coordination, timeline, and stakeholder management. When collaborating, consider how your suggestions align with other agents' inputs.`,
      CODING: `You are a Coding agent. Focus on technical implementation, code quality, architecture, and development feasibility. When collaborating, consider how your technical suggestions align with PM's plan and other agents' inputs.`,
      QA: `You are a QA agent. Focus on quality, testing strategies, edge cases, and potential risks. When collaborating, evaluate suggestions from other agents for quality implications.`,
      UX: `You are a UX agent. Focus on user experience, interface design, usability, and accessibility. When collaborating, ensure other agents' suggestions maintain good UX practices.`,
      DATA: `You are a Data agent. Focus on data architecture, analytics, performance metrics, and scalability. When collaborating, consider data implications of other agents' suggestions.`,
    };

    const systemPrompt = `
${agentPrompts[agentType] || `You are a ${agentType} agent.`}

COLLABORATION CONTEXT:
${context}

RESPONSE REQUIREMENTS:
- Build upon the previous discussion
- Acknowledge other agents' contributions when relevant
- Provide constructive feedback
- Suggest improvements to collective solution
- Respond in Vietnamese
- Keep responses focused and actionable
    `;

    return await this.ollama.chat(
      [{ role: 'user', content: message }],
      systemPrompt,
    );
  }

  private async broadcastToTeamChat(projectId: string, message: AgentMessage) {
    // Find or create team chat task
    let teamChat = await this.prisma.task.findFirst({
      where: {
        projectId,
        title: 'Project Team Chat',
      },
    });

    if (!teamChat) {
      teamChat = await this.prisma.task.create({
        data: {
          title: 'Project Team Chat',
          description: 'Team collaboration chat',
          agentType: 'PM',
          projectId,
          status: 'IN_PROGRESS',
        },
      });
    }

    // Save agent message to team chat
    await this.prisma.message.create({
      data: {
        role: 'AGENT', // Use standard role for all agent messages
        content: `[${message.sender}] ${message.content}`,
        taskId: teamChat.id,
        createdAt: message.timestamp,
      },
    });

    // Broadcast to WebSocket
    this.realtime.chatMessage(
      projectId,
      teamChat.id,
      {
        id: `agent-${Date.now()}`,
        role: 'AGENT', // Use standard role for all agent messages
        content: `[${message.sender}] ${message.content}`,
        createdAt: message.timestamp.toISOString(),
      },
    );
  }

  private async generateFinalDecision(
    discussionLog: AgentMessage[],
    context: string,
  ): Promise<CollaborationDecision> {
    const discussionSummary = discussionLog
      .map(msg => `[${msg.sender}] ${msg.content}`)
      .join('\n');

    const decisionPrompt = `
DISCUSSION LOG:
${discussionSummary}

CONTEXT:
${context}

Based on the discussion above, synthesize a final decision/solution that incorporates input from all agents. Consider:
1. Consensus points raised by multiple agents
2. Technical feasibility (from CODING agent)
3. Quality considerations (from QA agent)
4. User experience (from UX agent)
5. Project constraints (from PM agent)
6. Data implications (from DATA agent)

Provide a unified solution that represents the team's collective wisdom.
Respond in Vietnamese.
    `;

    const finalSolution = await this.ollama.chat(
      [{ role: 'user', content: decisionPrompt }],
      'You are a collaboration orchestrator synthesizing input from multiple AI agents.',
    );

    // Calculate confidence based on agreement level
    const confidence = this.calculateConfidence(discussionLog);

    return {
      finalSolution,
      consensusReached: confidence > 0.6,
      participatingAgents: Array.from(
        new Set(discussionLog.map(msg => msg.sender))
      ),
      confidence,
    };
  }

  private calculateConfidence(discussionLog: AgentMessage[]): number {
    // Simple confidence calculation - can be enhanced with semantic analysis
    const totalAgents = new Set(discussionLog.map(msg => msg.sender as string)).size;
    const totalMessages = discussionLog.length;
    
    // Higher confidence if more agents participate and contribute meaningfully
    return Math.min(1.0, (totalAgents * 0.7 + totalMessages * 0.1) / 10);
  }
}