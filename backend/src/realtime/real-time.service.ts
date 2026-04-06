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

export interface ModelThinkingEvent {
  taskId: string;
  projectId: string;
  thinking: boolean;
  step: string;
}

export interface ProjectUpdatedEvent {
  projectId: string;
  project: any;
}

export interface ExecutionStartedEvent {
  taskId: string;
  taskTitle: string;
  agentType: string;
  projectId: string;
  projectName: string;
  status: 'RUNNING' | 'DONE' | 'ERROR';
  startedAt: number;
  currentStep: string;
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
    if (!this.server) {
      console.warn(`[RealTime] broadcast failed: server not initialized. Event: ${event}`);
      return;
    }
    console.log(`[RealTime] Broadcasting ${event} to all clients:`, data);
    this.server.emit(event, data);
  }

  // ============ Convenience Methods ============

  /**
   * Notify that a new task was created (broadcast to all)
   */
  taskCreated(projectId: string, task: any) {
    if (!this.server) return;
    this.server.emit('task:created', { projectId, task });
    this.server.to(`project:${projectId}`).emit('task:created', { projectId, task });
  }

  /**
   * Notify that a task was updated (broadcast to all)
   */
  taskUpdated(projectId: string, task: any) {
    if (!this.server) return;
    this.server.emit('task:updated', { projectId, task });
    this.server.to(`project:${projectId}`).emit('task:updated', { projectId, task });
  }

  /**
   * Notify that a chat message was added
   */
  chatMessage(projectId: string, taskId: string, message: any) {
    if (!this.server) return;
    this.server.emit('chat:message', { projectId, taskId, message });
    this.server.to(`project:${projectId}`).emit('chat:message', { projectId, taskId, message });
  }

  /**
   * Notify analysis progress (broadcast to all)
   */
  analysisProgress(projectId: string, step: string, status: 'started' | 'progress' | 'completed' | 'error') {
    if (!this.server) return;
    this.server.emit('analysis:progress', { projectId, step, status });
    this.server.to(`project:${projectId}`).emit('analysis:progress', { projectId, step, status });
  }

  /**
   * Notify that project was updated
   */
  projectUpdated(projectId: string, project: any) {
    if (!this.server) return;
    this.server.emit('project:updated', { projectId, project });
    this.server.to(`project:${projectId}`).emit('project:updated', { projectId, project });
  }

  /**
   * Notify model thinking state (for task chat notifications)
   */
  modelThinking(taskId: string, projectId: string, step: string, thinking: boolean) {
    if (!this.server) return;
    this.server.emit('model:thinking', { taskId, projectId, thinking, step });
    this.server.to(`project:${projectId}`).emit('model:thinking', { taskId, projectId, thinking, step });
    this.server.to(`task:${taskId}`).emit('model:thinking', { taskId, projectId, thinking, step });
  }

  /**
   * Notify analysis completed with new tasks (broadcast to all)
   */
  analysisCompleted(projectId: string, tasks: any[], analysis: string) {
    if (!this.server) return;
    this.server.emit('analysis:completed', { projectId, tasks, analysis });
    this.server.to(`project:${projectId}`).emit('analysis:completed', { projectId, tasks, analysis });
  }

  // ============ Execution Events ============

  /**
   * Notify execution started (global broadcast for notification bar)
   */
  executionStarted(taskId: string, taskTitle: string, agentType: string, projectId: string, projectName: string, currentStep: string) {
    if (!this.server) return;
    const data = { taskId, taskTitle, agentType, projectId, projectName, status: 'RUNNING' as const, startedAt: Date.now(), currentStep };
    this.server.emit('execution:started', data);
    this.server.to(`project:${projectId}`).emit('execution:started', data);
  }

  /**
   * Notify execution step updated
   */
  executionStep(taskId: string, step: string) {
    if (!this.server) return;
    this.server.emit('execution:step', { taskId, step });
    this.server.to(`task:${taskId}`).emit('execution:step', { taskId, step });
  }

  /**
   * Notify execution completed
   */
  executionCompleted(taskId: string) {
    if (!this.server) return;
    this.server.emit('execution:completed', { taskId });
    this.server.to(`task:${taskId}`).emit('execution:completed', { taskId });
  }

  /**
   * Notify execution error
   */
  executionError(taskId: string) {
    if (!this.server) return;
    this.server.emit('execution:error', { taskId });
    this.server.to(`task:${taskId}`).emit('execution:error', { taskId });
  }
}
