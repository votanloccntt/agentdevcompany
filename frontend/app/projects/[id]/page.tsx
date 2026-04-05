'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Bug, Clock, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { projectsAPI, tasksAPI } from '@/lib/api';

const AGENT_COLORS: Record<string, string> = {
  PM: '#3b82f6',
  CODING: '#22c55e',
  QA: '#f97316',
  UX: '#ec4899',
  DATA: '#06b6d4',
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

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAgent, setNewAgent] = useState('CODING');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    if (params.id) {
      fetchProject(params.id as string);
    }
  }, [params.id]);

  const fetchProject = async (id: string) => {
    try {
      const res = await projectsAPI.getOne(id);
      setProject(res.data);
    } catch (err) {
      console.error('Failed to fetch project', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await tasksAPI.create(project.id, newTitle, newAgent, newDesc);
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      fetchProject(project.id);
    } catch (err) {
      console.error('Failed to create task', err);
    } finally {
      setCreating(false);
    }
  };

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
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {project.tasks?.length === 0 ? (
          <div className="card text-center py-12">
            <MessageSquare className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">No Tasks Yet</h2>
            <p className="text-zinc-400 mb-6">Create your first task and start chatting with an agent</p>
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
            {project.tasks?.map((task: any) => {
              const StatusIcon = STATUS_ICONS[task.status] || Clock;
              const lastMsg = task.messages?.[0];
              
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
