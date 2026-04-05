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
          orderBy: { updatedAt: 'desc' },
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

  async remove(id: string, userId: string): Promise<void> {
    const project = await this.findOne(id, userId);
    await this.prisma.project.delete({ where: { id: project.id } });
  }
}
