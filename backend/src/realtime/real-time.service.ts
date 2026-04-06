import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { RedisService } from './redis.service';

// Event types
export interface TaskCreatedEvent {
  projectId: string;
  task: any;
}

export interface TaskUpdatedEvent {
  projectId: string;
  task: any;
}

export interface ChatMessageEvent {
  projectId: string;
  taskId: string;
  message: any;
}

export interface AnalysisProgressEvent {
  projectId: string;
  step: string;
  status: 'started' | 'progress' | 'completed' | 'error';
}

export interface ProjectUpdatedEvent {
  projectId: string;
  project: any;
}

@Injectable()
export class RealTimeService {
  private server: Server | null = null;

  constructor(private redisService: RedisService) {}

  /**
   * Initialize with Socket.io server instance
   * Called from Gateway
   */
  init(server: Server) {
    this.server = server;
  }

  /**
   * Get the Socket.io server
   */
  getServer(): Server | null {
    return this.server;
  }

  /**
   * Emit to all clients in a project room
   */
  emitToProject(projectId: string, event: string, data: any) {
    if (!this.server) {
      console.warn('[RealTime] Server not initialized');
      return;
    }
    this.server.to(`project:${projectId}`).emit(event, data);
  }

  /**
   * Emit to a specific user
   */
  emitToUser(userId: string, event: string, data: any) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any) {
    if (!this.server) return;
    this.server.emit(event, data);
  }

  // ============ Convenience Methods ============

  /**
   * Notify that a new task was created
   */
  taskCreated(projectId: string, task: any) {
    this.emitToProject(projectId, 'task:created', { projectId, task });
  }

  /**
   * Notify that a task was updated
   */
  taskUpdated(projectId: string, task: any) {
    this.emitToProject(projectId, 'task:updated', { projectId, task });
  }

  /**
   * Notify that a chat message was added
   */
  chatMessage(projectId: string, taskId: string, message: any) {
    this.emitToProject(projectId, 'chat:message', { projectId, taskId, message });
  }

  /**
   * Notify analysis progress
   */
  analysisProgress(projectId: string, step: string, status: 'started' | 'progress' | 'completed' | 'error') {
    this.emitToProject(projectId, 'analysis:progress', { projectId, step, status });
  }

  /**
   * Notify that project was updated
   */
  projectUpdated(projectId: string, project: any) {
    this.emitToProject(projectId, 'project:updated', { projectId, project });
  }

  /**
   * Notify analysis completed with new tasks
   */
  analysisCompleted(projectId: string, tasks: any[], analysis: string) {
    this.emitToProject(projectId, 'analysis:completed', { projectId, tasks, analysis });
  }
}
