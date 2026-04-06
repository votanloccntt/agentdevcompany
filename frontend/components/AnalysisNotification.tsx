'use client';

import { useEffect, useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Cpu } from 'lucide-react';
import { realtime } from '@/lib/realtime';

interface QueueItem {
  projectId: string;
  timestamp: number;
  step: string;
}

interface ActiveExecution {
  taskId: string;
  taskTitle: string;
  agentType: string;
  projectId: string;
  projectName: string;
  status: 'RUNNING' | 'DONE' | 'ERROR';
  startedAt: number;
  currentStep: string;
}

interface AnalysisNotificationProps {
  /** Pass true when AI is actively processing (controls visibility) */
  isProcessing?: boolean;
  /** Pass current step text directly (controls step display) */
  currentStep?: string;
  onClose?: () => void;
}

export default function AnalysisNotification({
  isProcessing: propProcessing,
  currentStep: propStep,
}: AnalysisNotificationProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeExecutions, setActiveExecutions] = useState<ActiveExecution[]>([]);
  const [currentStep, setCurrentStep] = useState<string>(propStep ?? '');
  const [isProcessing, setIsProcessing] = useState(propProcessing ?? false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [visible, setVisible] = useState(propProcessing ?? false);

  // Sync props → state so parent can control visibility directly
  useEffect(() => {
    if (propProcessing !== undefined) {
      setIsProcessing(propProcessing);
      if (propProcessing) setVisible(true);
    }
  }, [propProcessing]);

  useEffect(() => {
    if (propStep !== undefined) setCurrentStep(propStep);
  }, [propStep]);

  // Also listen to WebSocket events as a secondary source
  useEffect(() => {
    let hideTimer: NodeJS.Timeout | null = null;

    const handleStarted = (data: { projectId: string }) => {
      setIsProcessing(true);
      setCurrentStep('Đang bắt đầu phân tích...');
      setVisible(true);
    };

    const handleProgress = (data: { projectId: string; step: string; status: string }) => {
      setIsProcessing(data.status === 'progress');
      setCurrentStep(data.step);
      setVisible(true);
    };

    const handleCompleted = (data: any) => {
      setIsProcessing(false);
      setActiveExecutions([]);
      setQueue([]);
      hideTimer = setTimeout(() => setVisible(false), 3000);
    };

    const handleTaskCreated = (data: { projectId: string }) => {
      setVisible(true);
    };

    const handleModelThinking = (data: any) => {
      console.log('[Notification] model:thinking event:', JSON.stringify(data));
      if (data.thinking) {
        setIsProcessing(true);
        setCurrentStep(data.step || 'Đang suy nghĩ...');
        setVisible(true);
      } else {
        setIsProcessing(false);
        setCurrentStep('');
        hideTimer = setTimeout(() => setVisible(false), 3000);
      }
    };

    if (!realtime.isConnected()) {
      const token = localStorage.getItem('token');
      realtime.connect(token || undefined);
    }

    realtime.on('analysis:started', handleStarted);
    realtime.on('analysis:progress', handleProgress);
    realtime.on('analysis:completed', handleCompleted);
    realtime.on('task:created', handleTaskCreated);
    realtime.on('model:thinking', handleModelThinking);

    return () => {
      realtime.off('analysis:started', handleStarted);
      realtime.off('analysis:progress', handleProgress);
      realtime.off('analysis:completed', handleCompleted);
      realtime.off('task:created', handleTaskCreated);
      realtime.off('model:thinking', handleModelThinking);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  // Don't render if nothing visible and no props controlling it
  if (!visible && !isProcessing) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] animate-slide-in">
      <div className="bg-zinc-900 border border-indigo-500/50 rounded-xl shadow-2xl w-80 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-950/80 to-transparent cursor-pointer hover:bg-zinc-800/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain className="w-5 h-5 text-indigo-400" />
              {(activeExecutions.length > 0 || queue.length > 0) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full animate-pulse-slow" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm text-indigo-400">AI Analysis</p>
              <p className="text-xs text-zinc-400">
                {activeExecutions.length > 0
                  ? `${activeExecutions.length} đang chạy`
                  : isProcessing
                    ? '⚡ Đang xử lý'
                    : `${queue.length} trong hàng đợi`}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          )}
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="px-4 py-3 border-t border-zinc-800">
            {/* Current Step */}
            {isProcessing && currentStep && (
              <div className="mb-3">
                <p className="text-xs text-zinc-500 mb-1">Đang xử lý:</p>
                <p className="text-sm text-white font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse-slow" />
                  {currentStep}
                </p>
              </div>
            )}

            {/* Active Executions */}
            {activeExecutions.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Đang thực thi:
                </p>
                <div className="space-y-2">
                  {activeExecutions.map((exec) => (
                    <div key={exec.taskId} className="bg-zinc-800/50 rounded-lg p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-indigo-400">
                          [{exec.agentType}]
                        </span>
                        <span className="text-xs text-zinc-500">
                          {Math.floor((Date.now() - exec.startedAt) / 1000)}s
                        </span>
                      </div>
                      <p className="text-sm text-white mt-1">{exec.taskTitle}</p>
                      <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        {exec.currentStep}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Project: {exec.projectName}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Queue List */}
            {queue.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">Hàng đợi:</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {queue.map((item, index) => (
                    <div key={item.projectId} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-600'}`} />
                      <span className="text-zinc-300">Project {item.projectId.slice(-6)}</span>
                      <span className="text-zinc-500 ml-auto">
                        {Math.floor((Date.now() - item.timestamp) / 1000)}s
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
