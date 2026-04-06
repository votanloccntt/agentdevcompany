'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Brain, Code, Bug, Palette, Database, Clock, CheckCircle2, 
  XCircle, PlayCircle, Target, Layers, Rocket, Shield,
  ChevronRight, Box
} from 'lucide-react';

const AGENT_COLORS: Record<string, string> = {
  PM: '#3b82f6',
  CODING: '#22c55e',
  QA: '#f97316',
  UX: '#ec4899',
  DATA: '#06b6d4',
};

const AGENT_ICONS: Record<string, any> = {
  PM: Brain,
  CODING: Code,
  QA: Bug,
  UX: Palette,
  DATA: Database,
};

const STATUS_ICONS: Record<string, any> = {
  PENDING: Clock,
  IN_PROGRESS: PlayCircle,
  DONE: CheckCircle2,
  FAILED: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-zinc-400 bg-zinc-800',
  IN_PROGRESS: 'text-orange-400 bg-orange-500/20',
  DONE: 'text-green-400 bg-green-500/20',
  FAILED: 'text-red-400 bg-red-500/20',
};

const STAGE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  PLANNING: { icon: Target, label: 'Planning', color: '#8b5cf6' },
  DESIGN: { icon: Palette, label: 'Design', color: '#ec4899' },
  DEVELOPMENT: { icon: Code, label: 'Development', color: '#22c55e' },
  TESTING: { icon: Bug, label: 'Testing', color: '#f97316' },
  DEPLOYMENT: { icon: Rocket, label: 'Deployment', color: '#3b82f6' },
  MAINTENANCE: { icon: Shield, label: 'Maintenance', color: '#06b6d4' },
};

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  agentType: string;
  projectId: string;
  stage: string;
  stageOrder: number;
  parallelGroup?: string;
  messages?: any[];
}

interface ParallelGroup {
  groupId: string;
  tasks: Task[];
}

interface StageData {
  tasks: Task[];
  parallelGroups: ParallelGroup[];
  standaloneTasks: Task[];
}

interface Workflow {
  [key: string]: StageData;
}

interface WorkflowBoardProps {
  projectId: string;
  projectName: string;
}

export default function WorkflowBoard({ projectId, projectName }: WorkflowBoardProps) {
  const [workflow, setWorkflow] = useState<Workflow>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkflow();
  }, [projectId]);

  const fetchWorkflow = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/projects/${projectId}/workflow`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      setWorkflow(data.workflow || {});
    } catch (err) {
      console.error('Failed to fetch workflow', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-400">Loading workflow...</div>
      </div>
    );
  }

  const stages = Object.keys(workflow);

  if (stages.length === 0) {
    return (
      <div className="text-center py-12">
        <Layers className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
        <h3 className="text-xl font-medium mb-2">No Workflow Yet</h3>
        <p className="text-zinc-400 mb-6">Run &quot;Phân tích lại&quot; to generate tasks with workflow structure</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stage Timeline */}
      <div className="card">
        <h3 className="font-semibold mb-4">Tiến Độ Theo Giai Đoạn</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {stages.map((stage, index) => {
            const stageData = workflow[stage];
            const stageConfig = STAGE_CONFIG[stage] || { icon: Layers, label: stage, color: '#6366f1' };
            const StageIcon = stageConfig.icon;
            const totalTasks = stageData.tasks.length;
            const completedTasks = stageData.tasks.filter((t: Task) => t.status === 'DONE').length;
            const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

            return (
              <div key={stage} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 text-zinc-600 mx-1 flex-shrink-0" />
                )}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  progress === 100 ? 'bg-green-500/20' : 
                  progress > 0 ? 'bg-indigo-500/20' : 'bg-zinc-800'
                }`}>
                  <StageIcon 
                    className="w-4 h-4 flex-shrink-0" 
                    style={{ color: progress === 100 ? '#22c55e' : stageConfig.color }}
                  />
                  <div className="flex flex-col min-w-[80px]">
                    <span className="text-xs font-medium">{stageConfig.label}</span>
                    <span className="text-xs text-zinc-400">{completedTasks}/{totalTasks}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stages.map((stage) => {
          const stageData = workflow[stage];
          const stageConfig = STAGE_CONFIG[stage] || { icon: Layers, label: stage, color: '#6366f1' };
          const StageIcon = stageConfig.icon;

          return (
            <div key={stage} className="card">
              {/* Stage Header */}
              <div className="flex items-center gap-2 mb-4">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${stageConfig.color}20` }}
                >
                  <StageIcon className="w-4 h-4" style={{ color: stageConfig.color }} />
                </div>
                <div>
                  <h4 className="font-medium">{stageConfig.label}</h4>
                  <p className="text-xs text-zinc-400">
                    {stageData.tasks.length} tasks
                  </p>
                </div>
              </div>

              {/* Parallel Groups */}
              {stageData.parallelGroups.map((group: ParallelGroup) => (
                <div 
                  key={group.groupId}
                  className="mb-3 p-3 rounded-lg bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Box className="w-3 h-3 text-indigo-400" />
                    <span className="text-xs font-medium text-indigo-400">
                      Parallel: {group.groupId}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.tasks.map((task) => (
                      <TaskCard key={task.id} task={task} projectId={projectId} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Standalone Tasks */}
              <div className="space-y-2">
                {stageData.standaloneTasks.map((task: Task) => (
                  <TaskCard key={task.id} task={task} projectId={projectId} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task, projectId }: { task: Task; projectId: string }) {
  const StatusIcon = STATUS_ICONS[task.status] || Clock;
  const AgentIcon = AGENT_ICONS[task.agentType] || Brain;
  const statusColor = STATUS_COLORS[task.status] || STATUS_COLORS.PENDING;

  return (
    <Link
      href={`/projects/${projectId}/tasks/${task.id}`}
      className="block p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/30 hover:border-zinc-600 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${AGENT_COLORS[task.agentType] || '#6366f1'}20` }}
        >
          <AgentIcon 
            className="w-4 h-4" 
            style={{ color: AGENT_COLORS[task.agentType] || '#6366f1' }} 
          />
        </div>
        <div className="flex-1 min-w-0">
          <h5 className="font-medium text-sm mb-1 truncate">{task.title}</h5>
          {task.description && (
            <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
              <StatusIcon className="w-3 h-3 inline mr-1" />
              {task.status.replace('_', ' ')}
            </span>
            <span className="text-xs text-zinc-500">
              {task.agentType}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
