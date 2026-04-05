import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AgentsService } from './agents.service';
import { AgentType } from '@prisma/client';
import { ChatAgentDto } from './dtos/chat-agent.dto';

@Controller('agents')
@UseGuards(AuthGuard('jwt'))
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Get()
  getAllAgents() {
    return this.agentsService.getAllAgents();
  }

  @Get(':type')
  getAgent(@Param('type') type: AgentType) {
    return this.agentsService.getAgent(type);
  }

  @Post('chat')
  async chat(@Body() dto: ChatAgentDto) {
    const response = await this.agentsService.chat(dto.agentType, dto.message);
    return { response };
  }

  @Post('chat/stream')
  async chatStream(@Body() dto: ChatAgentDto) {
    const stream = this.agentsService.chatStream(dto.agentType, dto.message);
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
}
