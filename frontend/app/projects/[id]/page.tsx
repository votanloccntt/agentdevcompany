'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Bug, Clock, CheckCircle2, XCircle, MessageSquare, Users, Brain, Sparkles, TrendingUp, Target, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { projectsAPI, tasksAPI } from '@/lib/api';
import WorkflowBoard from '@/components/WorkflowBoard';
import { realtime } from '@/lib/realtime';

const AGENT_COLORS: Record<string, string> = {
  PM: '#3b82f6',
  CODING: '#22c55e',
  QA: '#f97316',
  UX: '#ec4899',
  DATA: '#06b6d4',
};

const AGENT_NAMES: Record<string, string> = {
  PM: 'PM Agent',
  CODING: 'Coding Agent',
  QA: 'QA Agent',
  UX: 'UX Agent',
  DATA: 'Data Agent',
};

const STATUS_ICONS: Record<string, any> = {
  PENDING: Clock,
  IN_PROGRESS: Bug,
  DONE: CheckCircle2,
  FAILED: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-zinc-400',
  IN_PROGRESS: 'text-orange-400',
  DONE: 'text-green-400',
  FAILED: 'text-red-400',
};

interface ProjectPhase {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: 'pending' | 'active' | 'completed';
  color: string;
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<any>(null);
  const [teamChat, setTeamChat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAgent, setNewAgent] = useState('CODING');
  const [creating, setCreating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [analysisProjectId, setAnalysisProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'workflow'>('workflow');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [wsConnected, setWsConnected] = useState(false);

  const fetchProjectData = useCallback(async () => {
    if (!params.id) return;
    try {
      const [projectRes, chatRes] = await Promise.all([
        projectsAPI.getOne(params.id as string),
        projectsAPI.getProjectChat(params.id as string).catch(() => null),
      ]);
      setProject(projectRes.data);
      setTeamChat(chatRes?.data || null);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch project', err);
    }
  }, [params.id]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    if (params.id) {
      fetchProjectData();
    }
  }, [params.id, fetchProjectData, router]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!params.id) return;

    if (!realtime.isConnected()) {
      const token = localStorage.getItem('token');
      realtime.connect(token || undefined);
    }
    realtime.joinProject(params.id as string);

    const unsubTaskCreated = realtime.on('task:created', (data) => {
      if (data.projectId === params.id) fetchProjectData();
    });
    const unsubTaskUpdated = realtime.on('task:updated', (data) => {
      if (data.projectId === params.id) fetchProjectData();
    });
    const unsubAnalysisProgress = realtime.on('analysis:progress', (data) => {
      if (data.projectId === params.id) {
        setAnalysisStep(data.step);
        setAnalyzing(data.status === 'progress');
      }
    });
    const unsubAnalysisCompleted = realtime.on('analysis:completed', (data) => {
      if (data.projectId === params.id) {
        setAnalyzing(false);
        setAnalysisStep('');
        fetchProjectData();
      }
    });
    const unsubConnect = realtime.on('connect' as any, () => setWsConnected(true));
    const unsubDisconnect = realtime.on('disconnect' as any, () => setWsConnected(false));

    return () => {
      realtime.leaveProject(params.id as string);
      unsubTaskCreated();
      unsubTaskUpdated();
      unsubAnalysisProgress();
      unsubAnalysisCompleted();
      unsubConnect();
      unsubDisconnect();
    };
  }, [params.id, fetchProjectData]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await tasksAPI.create(project.id, newTitle, newAgent, newDesc);
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
    } catch (err) {
      console.error('Failed to create task', err);
    } finally {
      setCreating(false);
    }
  };

  const handleReanalyze = async () => {
    if (!project) return;
    setAnalyzing(true);
    setAnalysisStep('Đang xóa dữ liệu cũ...');
    try {
      projectsAPI.analyze(project.id);
    } catch (err) {
      console.error('Failed to analyze', err);
      setAnalyzing(false);
      setAnalysisStep('');
    }
  };


  // Check if this project is being analyzed when page loads
  useEffect(() => {
    if (params.id && teamChat && teamChat.messages && teamChat.messages.length > 0) {
      // Project has been analyzed before
      // Could restore state from localStorage if needed
    }
  }, [params.id, teamChat]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-zinc-400">Project not found</div>
      </div>
    );
  }

  const regularTasks = project.tasks?.filter((t: any) => t.title !== 'Project Team Chat') || [];
  const lastTeamMsg = teamChat?.messages?.[teamChat.messages.length - 1];
  
  // Calculate project progress
  const totalTasks = regularTasks.length;
  const completedTasks = regularTasks.filter((t: any) => t.status === 'DONE').length;
  const inProgressTasks = regularTasks.filter((t: any) => t.status === 'IN_PROGRESS').length;
  const pendingTasks = regularTasks.filter((t: any) => t.status === 'PENDING').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Determine current phase
  const getProjectPhases = (): ProjectPhase[] => {
    const hasTeamChat = teamChat && teamChat.messages && teamChat.messages.length > 0;
    const hasTasks = totalTasks > 0;
    const hasCompletedTasks = completedTasks > 0;
    const allTasksDone = totalTasks > 0 && completedTasks === totalTasks;

    return [
      {
        id: 'created',
        name: 'Tạo Dự Án',
        description: 'Dự án đã được khởi tạo',
        icon: Target,
        status: 'completed',
        color: '#22c55e',
      },
      {
        id: 'analyzing',
        name: 'PM Phân Tích',
        description: hasTeamChat ? 'Đã phân tích và lên kế hoạch' : 'Đang chờ PM phân tích...',
        icon: Brain,
        status: hasTeamChat ? 'completed' : (analyzing ? 'active' : 'pending'),
        color: '#3b82f6',
      },
      {
        id: 'tasks',
        name: 'Phân Công',
        description: hasTasks ? `${totalTasks} công việc đã được tạo` : 'Chưa có công việc nào',
        icon: Users,
        status: hasTasks ? 'completed' : 'pending',
        color: '#8b5cf6',
      },
      {
        id: 'working',
        name: 'Đang Làm Việc',
        description: inProgressTasks > 0 ? `${inProgressTasks} đang thực hiện` : (hasTasks ? 'Sẵn sàng bắt đầu' : 'Chờ phân công'),
        icon: Sparkles,
        status: inProgressTasks > 0 ? 'active' : (hasTasks ? 'completed' : 'pending'),
        color: '#f97316',
      },
      {
        id: 'done',
        name: 'Hoàn Thành',
        description: allTasksDone ? 'Tất cả công việc đã hoàn tất!' : `${completedTasks}/${totalTasks} hoàn thành`,
        icon: TrendingUp,
        status: allTasksDone ? 'completed' : (hasTasks ? 'active' : 'pending'),
        color: '#10b981',
      },
    ];
  };

  const phases = getProjectPhases();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-semibold text-lg">{project.name}</h1>
              <p className="text-zinc-400 text-sm">{project.description || 'No description'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReanalyze}
              disabled={analyzing}
              className="btn-secondary flex items-center gap-2"
            >
              <Brain className={`w-4 h-4 ${analyzing ? 'animate-pulse' : ''}`} />
              {analyzing ? 'Đang phân tích...' : 'Phân tích lại'}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Project Progress Tracker */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg">Tiến Độ Dự Án</h2>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold">{progressPercent}%</p>
                <p className="text-zinc-400 text-sm">Hoàn thành</p>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="h-3 bg-zinc-800 rounded-full mb-6 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-zinc-900/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-white">{totalTasks}</p>
              <p className="text-zinc-400 text-sm">Tổng công việc</p>
            </div>
            <div className="bg-zinc-900/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-400">{completedTasks}</p>
              <p className="text-zinc-400 text-sm">Hoàn thành</p>
            </div>
            <div className="bg-zinc-900/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-orange-400">{inProgressTasks}</p>
              <p className="text-zinc-400 text-sm">Đang làm</p>
            </div>
            <div className="bg-zinc-900/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-zinc-400">{pendingTasks}</p>
              <p className="text-zinc-400 text-sm">Chờ xử lý</p>
            </div>
          </div>

          {/* Phase Timeline */}
          <div className="relative">
            <div className="flex items-center justify-between">
              {phases.map((phase, index) => {
                const PhaseIcon = phase.icon;
                return (
                  <div key={phase.id} className="flex flex-col items-center relative z-10">
                    {/* Connector Line */}
                    {index > 0 && (
                      <div 
                        className={`absolute top-5 -left-1/2 w-full h-0.5 ${
                          phase.status === 'completed' || phases[index - 1].status === 'completed'
                            ? 'bg-green-500' 
                            : 'bg-zinc-700'
                        }`}
                        style={{ width: '200%', left: '-100%' }}
                      />
                    )}
                    
                    {/* Icon Circle */}
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        phase.status === 'completed' 
                          ? 'bg-green-500/20' 
                          : phase.status === 'active' 
                            ? 'bg-indigo-500/20 ring-2 ring-indigo-500'
                            : 'bg-zinc-800'
                      }`}
                    >
                      <PhaseIcon 
                        className={`w-5 h-5 ${
                          phase.status === 'completed' 
                            ? 'text-green-400' 
                            : phase.status === 'active' 
                              ? 'text-indigo-400'
                              : 'text-zinc-500'
                        }`}
                      />
                    </div>
                    
                    {/* Phase Name */}
                    <p className={`text-xs mt-2 font-medium ${
                      phase.status === 'completed' 
                        ? 'text-green-400' 
                        : phase.status === 'active' 
                          ? 'text-white'
                          : 'text-zinc-500'
                    }`}>
                      {phase.name}
                    </p>
                    
                    {/* Phase Description */}
                    <p className="text-xs text-zinc-500 mt-1 text-center max-w-[120px]">
                      {phase.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Analysis Progress */}
        {analyzing && (
          <div className="card mb-8 border-indigo-500/50 bg-gradient-to-br from-indigo-950/50 to-transparent animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Brain className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-lg text-indigo-400">PM Agent Đang Phân Tích</h2>
                <p className="text-zinc-400 text-sm">{analysisStep || 'Đang xử lý...'}</p>
              </div>
            </div>
            
            {/* Steps Progress */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${analysisStep === 'Đang xóa dữ liệu cũ...' ? 'bg-indigo-400 animate-ping' : 'bg-green-400'}`} />
                <span className={`text-sm ${analysisStep === 'Đang xóa dữ liệu cũ...' ? 'text-white' : 'text-zinc-400'}`}>Xóa dữ liệu cũ</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${analysisStep === 'PM Agent đang phân tích dự án...' ? 'bg-indigo-400 animate-ping' : analysisStep.includes('Hoàn tất') || analysisStep === 'Đang tạo tasks mới...' ? 'bg-green-400' : 'bg-zinc-600'}`} />
                <span className={`text-sm ${analysisStep === 'PM Agent đang phân tích dự án...' ? 'text-white' : 'text-zinc-400'}`}>PM Agent phân tích</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${analysisStep === 'Đang tạo tasks mới...' ? 'bg-indigo-400 animate-ping' : analysisStep.includes('Hoàn tất') ? 'bg-green-400' : 'bg-zinc-600'}`} />
                <span className={`text-sm ${analysisStep === 'Đang tạo tasks mới...' ? 'text-white' : 'text-zinc-400'}`}>Tạo tasks mới</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${analysisStep.includes('Hoàn tất') ? 'bg-green-400' : 'bg-zinc-600'}`} />
                <span className={`text-sm ${analysisStep.includes('Hoàn tất') ? 'text-green-400' : 'text-zinc-400'}`}>Hoàn tất</span>
              </div>
            </div>
          </div>
        )}

        {/* Project Team Chat */}
        <div className="card mb-8 border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 to-transparent">
          <Link
            href={`/projects/${project.id}/team-chat`}
            className="flex items-center gap-4 hover:opacity-80 transition-opacity"
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <Users className="w-7 h-7 text-indigo-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg mb-1">Project Team Chat</h2>
              <p className="text-zinc-400 text-sm">
                Chat với toàn bộ AI Team (PM, Coding, QA, UX, Data)
              </p>
              {lastTeamMsg && (
                <p className="text-zinc-500 text-xs mt-1 line-clamp-1">
                  {lastTeamMsg.role === 'USER' ? 'You' : 'Team'}: {lastTeamMsg.content.slice(0, 80)}...
                </p>
              )}
            </div>
            <div className="text-indigo-400 text-sm font-medium flex items-center gap-2">
              Open Chat
              <MessageSquare className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium">Tasks</h2>
          <div className="flex gap-2 bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('workflow')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'workflow'
                  ? 'bg-indigo-500 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Workflow
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-indigo-500 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>
        </div>

        {viewMode === 'workflow' ? (
          <WorkflowBoard projectId={project.id} projectName={project.name} />
        ) : (
          <>
            {regularTasks.length === 0 ? (
              <div className="card text-center py-12">
                <MessageSquare className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                <h2 className="text-xl font-medium mb-2">No Tasks Yet</h2>
                <p className="text-zinc-400 mb-6">Create a task to chat with a specific agent</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Task
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {regularTasks.map((task: any) => {
                  const StatusIcon = STATUS_ICONS[task.status] || Clock;
                  const lastMsg = task.messages?.[task.messages.length - 1];
                  
                  return (
                    <Link
                      key={task.id}
                      href={`/projects/${project.id}/tasks/${task.id}`}
                      className="card hover:border-zinc-700 transition-all duration-200 block"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${AGENT_COLORS[task.agentType] || '#6366f1'}20` }}
                        >
                          <span
                            className="text-sm font-bold"
                            style={{ color: AGENT_COLORS[task.agentType] || '#6366f1' }}
                          >
                            {task.agentType}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium mb-1">{task.title}</h3>
                          {lastMsg && (
                            <p className="text-zinc-400 text-sm line-clamp-1">
                              {lastMsg.content.slice(0, 100)}...
                            </p>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 ${STATUS_COLORS[task.status]}`}>
                          <StatusIcon className="w-4 h-4" />
                          <span className="text-sm">{task.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Create Task Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold mb-6">Create New Task</h2>
            <form onSubmit={handleCreateTask}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Task Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="input-field w-full"
                  placeholder="What needs to be done?"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Agent Type</label>
                <select
                  value={newAgent}
                  onChange={(e) => setNewAgent(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="PM">PM Agent - Project Manager</option>
                  <option value="CODING">Coding Agent - Developer</option>
                  <option value="QA">QA Agent - Quality Assurance</option>
                  <option value="UX">UX Agent - Designer</option>
                  <option value="DATA">Data Agent - Data Engineer</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="input-field w-full h-24 resize-none"
                  placeholder="Additional details..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary flex-1"
                >
                  {creating ? 'Creating...' : 'Create & Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
