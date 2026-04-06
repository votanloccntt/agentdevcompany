import { IsString, IsEnum, IsOptional } from 'class-validator';
import { AgentType } from '@prisma/client';

export class ChatAgentDto {
  @IsString()
  agentType: string;

  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}
