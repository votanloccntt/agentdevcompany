import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Project, User } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { userId },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
          orderBy: [
            { stage: 'asc' },
            { stageOrder: 'asc' },
          ],
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return project;
  }

  async create(name: string, description: string | null, userId: string): Promise<Project> {
    return this.prisma.project.create({
      data: {
        name,
        description,
        userId,
      },
    });
  }

  async update(id: string, name: string, description: string | null, userId: string): Promise<Project> {
    const project = await this.findOne(id, userId);
    return this.prisma.project.update({
      where: { id: project.id },
      data: { name, description },
    });
  }

  async getWorkflow(id: string, userId: string) {
    const project = await this.findOne(id, userId);

    // Get all tasks organized by stage
    const tasks = await this.prisma.task.findMany({
      where: { projectId: id },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        subtasks: true,
      },
      orderBy: [
        { stage: 'asc' },
        { stageOrder: 'asc' },
      ],
    });

    // Filter out team chat for workflow
    const workTasks = tasks.filter(t => t.title !== 'Project Team Chat');

    // Group by stage
    const stages = ['PLANNING', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'DEPLOYMENT', 'MAINTENANCE'] as const;
    const workflow: Record<string, any> = {};

    for (const stage of stages) {
      const stageTasks = workTasks.filter(t => t.stage === stage);
      if (stageTasks.length === 0) continue;

      // Group by parallelGroup
      const parallelGroups: Record<string, any[]> = {};
      const standaloneTasks: any[] = [];

      for (const task of stageTasks) {
        if (task.parallelGroup) {
          if (!parallelGroups[task.parallelGroup]) {
            parallelGroups[task.parallelGroup] = [];
          }
          parallelGroups[task.parallelGroup].push(task);
        } else {
          standaloneTasks.push(task);
        }
      }

      workflow[stage] = {
        tasks: stageTasks,
        parallelGroups: Object.entries(parallelGroups).map(([groupId, tasks]) => ({
          groupId,
          tasks,
        })),
        standaloneTasks,
      };
    }

    return {
      project,
      workflow,
      stages,
    };
  }

  async remove(id: string, userId: string): Promise<void> {
    const project = await this.findOne(id, userId);
    await this.prisma.project.delete({ where: { id: project.id } });
  }
}
