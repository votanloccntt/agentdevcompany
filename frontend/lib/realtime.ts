'use client';

import { io, Socket } from 'socket.io-client';

export type RealtimeEvent =
  | 'task:created'
  | 'task:updated'
  | 'chat:message'
  | 'analysis:progress'
  | 'analysis:completed'
  | 'project:updated'
  | 'pong';

export interface TaskCreatedPayload {
  projectId: string;
  task: any;
}

export interface TaskUpdatedPayload {
  projectId: string;
  task: any;
}

export interface ChatMessagePayload {
  projectId: string;
  taskId: string;
  message: any;
}

export interface AnalysisProgressPayload {
  projectId: string;
  step: string;
  status: 'started' | 'progress' | 'completed' | 'error';
}

export interface AnalysisCompletedPayload {
  projectId: string;
  tasks: any[];
  analysis: string;
}

type EventCallback<T = any> = (data: T) => void;

class RealtimeService {
  private socket: Socket | null = null;
  private listeners: Map<RealtimeEvent, Set<EventCallback>> = new Map();
  private projectRooms: Set<string> = new Set();
  private taskRooms: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Initialize WebSocket connection
   */
  connect(token?: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';
    
    this.socket = io(`${socketUrl}/ws`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      
      // Rejoin rooms after reconnection
      this.projectRooms.forEach(projectId => {
        this.socket?.emit('join:project', { projectId });
      });
      this.taskRooms.forEach(taskId => {
        this.socket?.emit('join:task', { taskId });
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.reconnectAttempts++;
    });

    // Forward events to listeners
    const events: RealtimeEvent[] = [
      'task:created',
      'task:updated',
      'chat:message',
      'analysis:progress',
      'analysis:completed',
      'project:updated',
    ];

    events.forEach(event => {
      this.socket?.on(event, (data: any) => {
        this.listeners.get(event)?.forEach(callback => callback(data));
      });
    });

    return this.socket;
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Subscribe to events
   */
  on<T = any>(event: RealtimeEvent, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Unsubscribe from events
   */
  off(event: RealtimeEvent, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Join a project room for real-time updates
   */
  joinProject(projectId: string) {
    if (!this.socket?.connected) {
      console.warn('[WebSocket] Not connected, queuing project join');
      this.projectRooms.add(projectId);
      return;
    }
    
    this.socket.emit('join:project', { projectId });
    this.projectRooms.add(projectId);
    console.log('[WebSocket] Joined project:', projectId);
  }

  /**
   * Leave a project room
   */
  leaveProject(projectId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('leave:project', { projectId });
    this.projectRooms.delete(projectId);
  }

  /**
   * Join a task room for real-time updates
   */
  joinTask(taskId: string) {
    if (!this.socket?.connected) {
      this.taskRooms.add(taskId);
      return;
    }
    this.socket.emit('join:task', { taskId });
    this.taskRooms.add(taskId);
  }

  /**
   * Leave a task room
   */
  leaveTask(taskId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('leave:task', { taskId });
    this.taskRooms.delete(taskId);
  }

  /**
   * Subscribe to analysis progress
   */
  subscribeAnalysis(projectId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('subscribe:analysis', { projectId });
  }

  /**
   * Ping for health check
   */
  ping(): Promise<{ event: string; timestamp: number }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ event: 'pong', timestamp: Date.now() });
        return;
      }
      
      const handler = (data: { event: string; timestamp: number }) => {
        this.socket?.off('pong', handler);
        resolve(data);
      };
      
      this.socket.on('pong', handler);
      this.socket.emit('ping');
      
      // Timeout after 5 seconds
      setTimeout(() => {
        this.socket?.off('pong', handler);
        resolve({ event: 'pong', timestamp: Date.now() });
      }, 5000);
    });
  }
}

// Singleton instance
export const realtime = new RealtimeService();

// React hook for using realtime in components
import { useEffect, useState, useCallback } from 'react';

export function useRealtimeProject(projectId: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (!projectId) return;

    // Connect if not already
    if (!realtime.isConnected()) {
      const token = localStorage.getItem('token');
      realtime.connect(token || undefined);
    }

    realtime.joinProject(projectId);
    setIsConnected(realtime.isConnected());

    const unsubConnect = realtime.on('connect' as any, () => setIsConnected(true));
    const unsubDisconnect = realtime.on('disconnect' as any, () => setIsConnected(false));

    return () => {
      realtime.leaveProject(projectId);
      unsubConnect();
      unsubDisconnect();
    };
  }, [projectId]);

  return { isConnected, latestUpdate, realtime };
}

export function useRealtimeTask(taskId: string) {
  useEffect(() => {
    if (!taskId) return;
    realtime.joinTask(taskId);
    return () => realtime.leaveTask(taskId);
  }, [taskId]);
}
