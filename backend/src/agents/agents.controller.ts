import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AgentsService } from "./agents.service";
import { AgentType } from "@prisma/client";
import { ChatAgentDto } from "./dtos/chat-agent.dto";
import { CollaborationService } from './collaboration.service';

@Controller("agents")
@UseGuards(AuthGuard("jwt"))
export class AgentsController {
  constructor(
    private agentsService: AgentsService,
    private collaborationService: CollaborationService,
  ) {}

  @Get()
  getAllAgents() {
    return this.agentsService.getAllAgents();
  }

  @Get(":type")
  getAgent(@Param("type") type: AgentType) {
    return this.agentsService.getAgent(type);
  }

  @Post("chat")
  async chat(@Body() dto: ChatAgentDto & { projectId?: string }) {
    if (dto.projectId) {
      // Use collaboration if projectId is provided
      try {
        const result = await this.collaborationService.processCollaborativeMessage(
          dto.projectId,
          dto.message,
          dto.agentType,
        );
        return result;
      } catch (error) {
        console.error('Collaboration error:', error);
        return { 
          finalSolution: 'Xin lỗi, đã xảy ra lỗi trong quá trình cộng tác giữa các agent.',
          consensusReached: false,
          participatingAgents: [],
          confidence: 0,
          error: error.message
        };
      }
    }
    
    try {
      const content: string = await this.agentsService.chat(
        dto.agentType as any, // Type assertion to bypass strict enum check
        dto.message,
      );

      if (!content) {
        return { content: "Sorry, no response from agent." };
      }

      return { content };
    } catch (error) {
      console.error('Agent chat error:', error);
      return { 
        content: `Error: ${error.message || 'Unknown error occurred'}`,
        error: true
      };
    }
  }

  @Post("chat/stream")
  async chatStream(@Body() dto: { agentType: string; message: string; projectId?: string }) {
    if (dto.projectId) {
      // Collaboration doesn't support streaming yet
      const result = await this.collaborationService.processCollaborativeMessage(
        dto.projectId,
        dto.message,
        dto.agentType as any,
      );
      return result;
    }
    
    const stream = this.agentsService.chatStream(dto.agentType, dto.message);

    // Define ReadableStream and TextEncoder locally for this function
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            console.log(chunk);
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify(chunk) + "\n"),
            );
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }
}
