import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { OllamaService } from '../ollama/ollama.service';
import { CollaborationService } from './collaboration.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
    }),
  ],
  controllers: [AgentsController],
  providers: [AgentsService, OllamaService, CollaborationService, PrismaService],
  exports: [AgentsService, CollaborationService],
})
export class AgentsModule {}
