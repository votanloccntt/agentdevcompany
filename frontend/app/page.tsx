"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  ArrowRight,
  FolderKanban,
  CheckCircle2,
  Clock,
} from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!userData || !token) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(userData));
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/projects", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const activeTasks = projects.reduce(
    (acc, p) => acc + (p.tasks?.length || 0),
    0,
  );
  const totalTasks = projects.reduce(
    (acc, p) => acc + (p._count?.tasks || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="font-semibold text-lg">WebAgent</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-zinc-400">Hello, {user.name}</span>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.push("/login");
              }}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{projects.length}</p>
                <p className="text-zinc-400 text-sm">Total Projects</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{activeTasks}</p>
                <p className="text-zinc-400 text-sm">Active Tasks</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{totalTasks}</p>
                <p className="text-zinc-400 text-sm">Total Tasks</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mb-8">
          <Link
            href="/projects"
            className="btn-primary flex items-center gap-2"
          >
            <FolderKanban className="w-4 h-4" />
            View Projects
          </Link>
        </div>

        {/* Recent Projects */}
        <h2 className="text-xl font-semibold mb-4">Recent Projects</h2>
        {loading ? (
          <div className="text-zinc-400">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="card text-center py-8">
            <FolderKanban className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 mb-4">No projects yet</p>
            <Link
              href="/projects"
              className="btn-primary inline-flex items-center gap-2"
            >
              Create First Project
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="card hover:border-zinc-700 transition-all duration-200"
              >
                <h3 className="font-medium mb-2">{project.name}</h3>
                <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
                  {project.description || "No description"}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">
                    {project._count?.tasks || 0} tasks
                  </span>
                  <span className="text-zinc-500">
                    {project.tasks?.length || 0} active
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
