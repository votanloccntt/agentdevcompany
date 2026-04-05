import { IsString, IsEnum } from 'class-validator';
import { AgentType } from '@prisma/client';

export class ChatAgentDto {
  @IsEnum(AgentType)
  agentType: AgentType;

  @IsString()
  message: string;
}
