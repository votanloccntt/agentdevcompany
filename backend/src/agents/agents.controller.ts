import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AgentsService } from "./agents.service";
import { AgentType } from "@prisma/client";
import { ChatAgentDto } from "./dtos/chat-agent.dto";

@Controller("agents")
@UseGuards(AuthGuard("jwt"))
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Get()
  getAllAgents() {
    return this.agentsService.getAllAgents();
  }

  @Get(":type")
  getAgent(@Param("type") type: AgentType) {
    return this.agentsService.getAgent(type);
  }

  @Post("chat")
  async chat(@Body() dto: ChatAgentDto) {
    const content: string = await this.agentsService.chat(
      dto.agentType,
      dto.message,
    );

    if (!content) {
      return { content: "Sorry, no response from agent." };
    }

    return { content };
  }

  @Post("chat/stream")
  async chatStream(@Body() dto: { agentType: string; message: string }) {
    const stream = this.agentsService.chatStream(dto.agentType, dto.message);

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
