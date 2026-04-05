import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dtos/create-task.dto';
import { ChatTaskDto } from './dtos/chat-task.dto';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get('projects/:projectId/tasks')
  async findAll(@Param('projectId') projectId: string, @Request() req) {
    return this.tasksService.findAll(projectId, req.user.id);
  }

  @Post('projects/:projectId/tasks')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @Request() req,
  ) {
    return this.tasksService.create(projectId, dto.title, dto.description, dto.agentType, req.user.id);
  }

  @Get('tasks/:id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.tasksService.findOne(id, req.user.id);
  }

  @Post('tasks/:id/chat')
  async chat(
    @Param('id') id: string,
    @Body() dto: ChatTaskDto,
    @Request() req,
  ) {
    const result = await this.tasksService.chat(id, dto.message, req.user.id);
    return result;
  }
}
