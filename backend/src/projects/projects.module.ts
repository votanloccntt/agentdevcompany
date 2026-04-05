import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ProjectsController } from './projects.controller';
import { AnalysisQueueController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectSynthesisService } from './project-synthesis.service';
import { PrismaService } from '../prisma.service';
import { OllamaService } from '../ollama/ollama.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
    }),
  ],
  controllers: [ProjectsController, AnalysisQueueController],
  providers: [ProjectsService, ProjectSynthesisService, PrismaService, OllamaService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
