'use client';

import { useEffect, useState, useRef } from 'react';
import { Brain, ChevronDown, ChevronUp, Cpu, X } from 'lucide-react';
import { realtime } from '@/lib/realtime';

export interface ActiveExecution {
  taskId: string;
  taskTitle: string;
  agentType: string;
  projectId: string;
  projectName: string;
  status: 'RUNNING' | 'DONE' | 'ERROR';
  startedAt: number;
  currentStep: string;
}

interface QueueItem {
  projectId: string;
  projectName?: string; // Optional, will be filled later if available
  timestamp: number;
  step: string;
}

let globalManager: NotificationManager | null = null;

class NotificationManager {
  private listeners: Set<(execs: ActiveExecution[], queue: QueueItem[]) => void> = new Set();
  private activeExecutions: Map<string, ActiveExecution> = new Map();
  private queue: QueueItem[] = [];
  private wsConnected = false;
  private eventHistory: Set<string> = new Set(); // Prevent duplicate processing

  subscribe(callback: (execs: ActiveExecution[], queue: QueueItem[]) => void) {
    this.listeners.add(callback);
    // Immediately call with current state
    callback(this.getExecutions(), this.queue);
    return () => this.listeners.delete(callback);
  }

  private emit() {
    const execs = this.getExecutions();
    const q = this.queue;
    this.listeners.forEach(cb => cb(execs, q));
  }

  private createEventId(type: string, id: string): string {
    return `${type}:${id}:${Date.now()}`;
  }

  private addEventToHistory(eventId: string): boolean {
    if (this.eventHistory.has(eventId)) {
      return false; // Already processed
    }
    this.eventHistory.add(eventId);
    // Clean up old events periodically
    if (this.eventHistory.size > 100) {
      const oldest = Array.from(this.eventHistory).slice(0, 50);
      oldest.forEach(id => this.eventHistory.delete(id));
    }
    return true;
  }

  subscribe(callback: (execs: ActiveExecution[], queue: QueueItem[]) => void) {
    this.listeners.add(callback);
    // Immediately call with current state
    callback(this.getExecutions(), this.queue);
    return () => this.listeners.delete(callback);
  }

  private emit() {
    const execs = this.getExecutions();
    const q = this.queue;
    this.listeners.forEach(cb => cb(execs, q));
  }

  private getExecutions(): ActiveExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  setConnected(connected: boolean) {
    this.wsConnected = connected;
    if (!connected) {
      // Clear all on disconnect
      this.activeExecutions.clear();
      this.queue = [];
      this.emit();
    }
  }

  onExecutionStarted(data: ActiveExecution) {
    const eventId = this.createEventId('execution-started', data.taskId);
    if (!this.addEventToHistory(eventId)) return; // Skip if duplicate
    
    this.activeExecutions.set(data.taskId, data);
    // Remove from queue if it was there
    this.queue = this.queue.filter(q => q.projectId !== data.projectId);
    this.emit();
  }

  onExecutionStepUpdated(taskId: string, step: string) {
    const eventId = this.createEventId('execution-step', `${taskId}-${step}`);
    if (!this.addEventToHistory(eventId)) return; // Skip if duplicate
    
    const exec = this.activeExecutions.get(taskId);
    if (exec) {
      exec.currentStep = step;
      this.emit();
    }
  }

  onExecutionCompleted(taskId: string) {
    const eventId = this.createEventId('execution-completed', taskId);
    if (!this.addEventToHistory(eventId)) return; // Skip if duplicate
    
    const exec = this.activeExecutions.get(taskId);
    if (exec) {
      exec.status = 'DONE';
      this.emit();
      // Remove after delay
      setTimeout(() => {
        this.activeExecutions.delete(taskId);
        this.emit();
      }, 5000);
    }
  }

  onExecutionError(taskId: string) {
    const exec = this.activeExecutions.get(taskId);
    if (exec) {
      exec.status = 'ERROR';
      this.emit();
      setTimeout(() => {
        this.activeExecutions.delete(taskId);
        this.emit();
      }, 5000);
    }
  }

  // Handle model:thinking from task chat (simple thinking without full execution)
  // Handle model:thinking from task chat (simple thinking without full execution)
  onModelThinking(data: { taskId: string; projectId: string; thinking: boolean; step: string }) {
    const eventId = this.createEventId('model-thinking', `${data.taskId}-${data.thinking}`);
    if (!this.addEventToHistory(eventId)) return; // Skip if duplicate
    
    if (data.thinking) {
      // Look for existing execution for this task
      const existingExec = Array.from(this.activeExecutions.values()).find(
        exec => exec.taskId === data.taskId
      );
      
      if (existingExec) {
        // Update existing execution's step instead of creating new entry
        existingExec.currentStep = data.step || 'Đang suy nghĩ...';
        this.emit();
      } else {
        // Find the project name from any existing execution for the same project
        const projectExec = Array.from(this.activeExecutions.values()).find(
          exec => exec.projectId === data.projectId
        );
        
        // Create a temporary execution entry for this thinking
        const key = `thinking-${data.taskId}`;
        this.activeExecutions.set(key, {
          taskId: data.taskId,
          taskTitle: data.step || 'Đang xử lý...',
          agentType: 'CODING',
          projectId: data.projectId,
          projectName: projectExec?.projectName || '', // Use project name from existing exec if available
          status: 'RUNNING',
          startedAt: Date.now(),
          currentStep: data.step || 'Đang suy nghĩ...',
        });
        this.emit();
      }
    } else {
      // Remove thinking entry only if it's a temporary one
      const key = `thinking-${data.taskId}`;
      if (this.activeExecutions.has(key)) {
        this.activeExecutions.delete(key);
        this.emit();
      }
    }
  }

  onAnalysisStarted(data: { projectId: string; projectName?: string }) {
    const eventId = this.createEventId('analysis-started', data.projectId);
    if (!this.addEventToHistory(eventId)) return; // Skip if duplicate
    
    // Add to queue as pending
    this.queue.push({
      projectId: data.projectId,
      projectName: data.projectName, // Use project name if provided
      timestamp: Date.now(),
      step: 'Đang chờ phân tích...',
    });
    this.emit();
  }

  onAnalysisProgress(data: { projectId: string; step: string; status: string }) {
    const eventId = this.createEventId('analysis-progress', `${data.projectId}-${data.step}`);
    if (!this.addEventToHistory(eventId)) return; // Skip if duplicate
    
    if (data.status === 'progress') {
      // Move from queue to active
      this.queue = this.queue.filter(q => q.projectId !== data.projectId);
      // Find or create execution for this project
      const existing = Array.from(this.activeExecutions.values()).find(
        e => e.projectId === data.projectId && e.taskTitle === 'PM Agent Phân Tích'
      );
      if (existing) {
        existing.currentStep = data.step;
        this.emit();
      }
    }
  }

  onAnalysisCompleted(data: { projectId: string }) {
    const eventId = this.createEventId('analysis-completed', data.projectId);
    if (!this.addEventToHistory(eventId)) return; // Skip if duplicate
    
    this.queue = this.queue.filter(q => q.projectId !== data.projectId);
    // Remove analysis execution
    Array.from(this.activeExecutions.keys()).forEach(key => {
      const exec = this.activeExecutions.get(key);
      if (exec && exec.projectId === data.projectId) {
        this.activeExecutions.delete(key);
      }
    });
    this.emit();
  }

  onTaskCreated(data: { projectId: string; task?: any }) {
    const eventId = this.createEventId('task-created', data.projectId);
    if (!this.addEventToHistory(eventId)) return; // Skip if duplicate
    
    // If this is an analysis task, remove from queue
    this.queue = this.queue.filter(q => q.projectId !== data.projectId);
    this.emit();
  }
}

function getManager(): NotificationManager {
  if (!globalManager) {
    globalManager = new NotificationManager();
  }
  return globalManager;
}

// ============ React Component ============

export default function AppNotification() {
  const [activeExecutions, setActiveExecutions] = useState<ActiveExecution[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [visible, setVisible] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [timestamp, setTimestamp] = useState(Date.now()); // Add timestamp for refresh
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer for refreshing timestamps

  // Setup periodic refresh for timestamps
  useEffect(() => {
    // Update timestamp every second to refresh elapsed time
    refreshTimerRef.current = setInterval(() => {
      setTimestamp(Date.now());
    }, 1000);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const manager = getManager();
    const unsubscribe = manager.subscribe((execs, q) => {
      const hasActive = execs.some(e => e.status === 'RUNNING');
      const hasQueue = q.length > 0;

      setActiveExecutions(execs);
      setQueue(q);

      if (hasActive || hasQueue) {
        setVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      } else {
        // Auto-hide after 3s when nothing active
        hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
      }
    });

    // Connect WebSocket if needed
    if (!realtime.isConnected()) {
      const token = localStorage.getItem('token');
      realtime.connect(token || undefined);
    }

    const handleConnect = () => manager.setConnected(true);
    const handleDisconnect = () => manager.setConnected(false);

    // Execution events
    const handleExecutionStarted = (data: any) => {
      manager.onExecutionStarted(data);
    };

    const handleExecutionStepUpdated = (data: any) => {
      manager.onExecutionStepUpdated(data.taskId, data.step);
    };

    const handleExecutionCompleted = (data: any) => {
      manager.onExecutionCompleted(data.taskId);
    };

    const handleExecutionError = (data: any) => {
      manager.onExecutionError(data.taskId);
    };

    // Analysis events
    const handleAnalysisStarted = (data: any) => {
      manager.onAnalysisStarted(data);
    };

    const handleAnalysisProgress = (data: any) => {
      manager.onAnalysisProgress(data);
    };

    const handleAnalysisCompleted = (data: any) => {
      manager.onAnalysisCompleted(data);
    };

    const handleTaskCreated = (data: any) => {
      manager.onTaskCreated(data);
    };

    // Model thinking (task chat)
    const handleModelThinking = (data: any) => {
      manager.onModelThinking(data);
    };

    // Subscribe to WebSocket events
    realtime.on('connect' as any, handleConnect);
    realtime.on('disconnect' as any, handleDisconnect);
    realtime.on('execution:started', handleExecutionStarted);
    realtime.on('execution:step', handleExecutionStepUpdated);
    realtime.on('execution:completed', handleExecutionCompleted);
    realtime.on('execution:error', handleExecutionError);
    realtime.on('analysis:started', handleAnalysisStarted);
    realtime.on('analysis:progress', handleAnalysisProgress);
    realtime.on('analysis:completed', handleAnalysisCompleted);
    realtime.on('task:created', handleTaskCreated);
    realtime.on('model:thinking', handleModelThinking);

    return () => {
      unsubscribe();
      realtime.off('connect' as any, handleConnect);
      realtime.off('disconnect' as any, handleDisconnect);
      realtime.off('execution:started', handleExecutionStarted);
      realtime.off('execution:step', handleExecutionStepUpdated);
      realtime.off('execution:completed', handleExecutionCompleted);
      realtime.off('execution:error', handleExecutionError);
      realtime.off('analysis:started', handleAnalysisStarted);
      realtime.off('analysis:progress', handleAnalysisProgress);
      realtime.off('analysis:completed', handleAnalysisCompleted);
      realtime.off('task:created', handleTaskCreated);
      realtime.off('model:thinking', handleModelThinking);
    };
  }, []);

  const dismissExecution = (taskId: string) => {
    setDismissedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(taskId);
      return newSet;
    });
  };

  const visibleExecs = activeExecutions.filter(e => !dismissedIds.has(e.taskId));
  const hasActive = visibleExecs.some(e => e.status === 'RUNNING');

  if (!visible || (visibleExecs.length === 0 && queue.length === 0)) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] animate-slide-in">
      <div className="bg-zinc-900 border border-indigo-500/50 rounded-xl shadow-2xl w-96 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-950/80 to-transparent"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain className="w-5 h-5 text-indigo-400" />
              {hasActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm text-indigo-400">AI Agent</p>
              <p className="text-xs text-zinc-400">
                {visibleExecs.length > 0
                  ? `${visibleExecs.filter(e => e.status === 'RUNNING').length} đang chạy`
                  : queue.length > 0
                    ? `${queue.length} trong hàng đợi`
                    : 'Hoàn tất'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isExpanded ? (
              <ChevronDown
                className="w-4 h-4 text-zinc-400 cursor-pointer hover:text-white transition-colors"
                onClick={() => setIsExpanded(false)}
              />
            ) : (
              <ChevronUp
                className="w-4 h-4 text-zinc-400 cursor-pointer hover:text-white transition-colors"
                onClick={() => setIsExpanded(true)}
              />
            )}
          </div>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="px-4 py-3 border-t border-zinc-800 max-h-80 overflow-y-auto">
            {/* Active Executions */}
            {visibleExecs.length > 0 && (
              <div className="space-y-2">
                {visibleExecs.map((exec) => (
                  <div key={`${exec.projectId}-${exec.taskId}`} className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-indigo-400">
                        [{exec.agentType}] {exec.projectName}
                      </span>
                      <div className="flex items-center gap-2">
                        {exec.status === 'RUNNING' && (
                          <span className="text-xs text-zinc-500">
                            {Math.floor((timestamp - exec.startedAt) / 1000)}s
                          </span>
                        )}
                        <button
                          onClick={() => dismissExecution(exec.taskId)}
                          className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-white mt-1 font-medium">{exec.taskTitle}</p>
                    {exec.currentStep && (
                      <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                        {exec.status === 'RUNNING' && (
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                        )}
                        {exec.status === 'DONE' && (
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                        )}
                        {exec.status === 'ERROR' && (
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                        )}
                        {exec.currentStep}
                      </p>
                    )}
                    <p className="text-xs text-zinc-500 mt-1">
                      📁 {exec.projectName}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Queue List */}
            {queue.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Hàng đợi:
                </p>
                <div className="space-y-2">
                  {queue.map((item, index) => (
                    <div key={item.projectId} className="flex items-center gap-2 text-xs bg-zinc-800/30 rounded-lg px-3 py-2">
                      <span className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-yellow-400 animate-pulse' : 'bg-zinc-600'}`} />
                      <span className="text-zinc-300">
                        {item.projectName ? item.projectName : `Project ${item.projectId.slice(-6)}`}
                      </span>
                      <span className="text-zinc-500 ml-auto">
                        {Math.floor((timestamp - item.timestamp) / 1000)}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
