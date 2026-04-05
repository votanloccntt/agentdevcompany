import { IsString, IsOptional, IsEnum } from 'class-validator';
import { AgentType } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(AgentType)
  agentType: AgentType;
}
