import { IsString, IsOptional, IsEnum } from 'class-validator';
import { AgentType, Stage } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(AgentType)
  agentType: AgentType;

  @IsEnum(Stage)
  @IsOptional()
  stage?: Stage;

  @IsOptional()
  stageOrder?: number;

  @IsString()
  @IsOptional()
  parallelGroup?: string;

  @IsString()
  @IsOptional()
  parentTaskId?: string;
}
