import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';
import { ProjectSynthesisService } from './project-synthesis.service';
import { CreateProjectDto } from './dtos/create-project.dto';
import { UpdateProjectDto } from './dtos/update-project.dto';

@Controller('analysis-queue')
export class AnalysisQueueController {
  constructor(private synthesisService: ProjectSynthesisService) {}

  @Get('status')
  async getStatus() {
    return this.synthesisService.getQueueStatus();
  }
}

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private synthesisService: ProjectSynthesisService,
  ) {}

  @Get()
  async findAll(@Request() req) {
    return this.projectsService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.projectsService.findOne(id, req.user.id);
  }

  @Post()
  async create(@Body() dto: CreateProjectDto, @Request() req) {
    const project = await this.projectsService.create(dto.name, dto.description, req.user.id);
    
    // Tự động phân tích và tạo tasks cho team
    if (dto.analyze !== false) {
      // Chạy async để không blocking response
      this.synthesisService.analyzeAndRespond(project.id).catch(err => {
        console.error('Auto analysis failed:', err);
      });
    }
    
    return project;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @Request() req) {
    return this.projectsService.update(id, dto.name, dto.description, req.user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    await this.projectsService.remove(id, req.user.id);
    return { success: true };
  }

  // Get or create Project Team Chat
  @Get(':id/chat')
  async getProjectChat(@Param('id') id: string, @Request() req) {
    await this.projectsService.findOne(id, req.user.id);
    return this.synthesisService.startProjectChat(id);
  }

  // Send message to Project Team Chat
  @Post(':id/chat')
  async projectChat(@Param('id') id: string, @Body() body: { message: string }, @Request() req) {
    await this.projectsService.findOne(id, req.user.id);
    return this.synthesisService.chat(id, body.message);
  }

  // Stream response from Project Team Chat
  @Post(':id/chat/stream')
  async projectChatStream(@Param('id') id: string, @Body() body: { message: string }, @Request() req) {
    await this.projectsService.findOne(id, req.user.id);
    const { taskId, stream } = await this.synthesisService.chatStream(id, body.message);
    
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = typeof chunk === 'string' ? chunk : (chunk.content || '');
            controller.enqueue(new TextEncoder().encode(text));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Task-Id': taskId,
      },
    });
  }

  // Trigger team analysis - PM phân tích và phân công tasks
  @Post(':id/analyze')
  async reanalyze(@Param('id') id: string, @Request() req) {
    await this.projectsService.findOne(id, req.user.id);
    return this.synthesisService.analyzeAndRespond(id);
  }

  // Get analysis queue status
  @Get('analysis-queue/status')
  async getQueueStatus() {
    return this.synthesisService.getQueueStatus();
  }
}
