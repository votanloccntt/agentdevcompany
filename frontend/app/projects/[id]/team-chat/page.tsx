"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Bot, User, Brain, Loader2 } from "lucide-react";
import { projectsAPI } from "@/lib/api";
import { realtime } from "@/lib/realtime";

const AGENT_INFO: Record<
  string,
  { name: string; color: string; bgColor: string }
> = {
  PM: {
    name: "PM Agent",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.2)",
  },
  CODING: {
    name: "Coding Agent",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.2)",
  },
  QA: {
    name: "QA Agent",
    color: "#f97316",
    bgColor: "rgba(249, 115, 22, 0.2)",
  },
  UX: {
    name: "UX Agent",
    color: "#ec4899",
    bgColor: "rgba(236, 72, 153, 0.2)",
  },
  DATA: {
    name: "Data Agent",
    color: "#06b6d4",
    bgColor: "rgba(6, 182, 212, 0.2)",
  },
  USER: { name: "Bạn", color: "#ffffff", bgColor: "rgba(255, 255, 255, 0.2)" },
  AGENT: {
    name: "AI Team",
    color: "#a855f7",
    bgColor: "rgba(168, 85, 247, 0.2)",
  },
};

interface Message {
  id: string;
  role: "USER" | "AGENT";
  content: string;
  createdAt: string;
}

export default function TeamChatPage() {
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [modelThinking, setModelThinking] = useState(false);
  const [modelStep, setModelStep] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef<number>(0);

  const fetchChatData = useCallback(async () => {
    if (!params.id) return;
    try {
      const data = await projectsAPI.getProjectChat(params.id as string);
      if (data.data) {
        setProject(data.data);
        setMessages(data.data.messages || []);
        setTaskId(data.data.id);
      }
    } catch (err) {
      console.error("Failed to fetch chat", err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (params.id) {
      fetchChatData();
    }
  }, [params.id, fetchChatData, router]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!params.id) return;

    if (!realtime.isConnected()) {
      const token = localStorage.getItem("token");
      realtime.connect(token || undefined);
    }
    realtime.joinProject(params.id as string);

    const unsubChatMessage = realtime.on("chat:message", (data) => {
      if (data.projectId === params.id) {
        setMessages((prev) => [...prev, data.message]);
      }
    });

    const unsubAnalysisCompleted = realtime.on("analysis:completed", (data) => {
      if (data.projectId === params.id) {
        fetchChatData();
      }
    });

    const unsubAnalysisProgress = realtime.on("analysis:progress", (data: { projectId: string; step: string; status: string }) => {
      if (data.projectId === params.id) {
        setModelStep(data.step);
        setModelThinking(data.status === "progress");
      }
    });

    const unsubModelThinking = realtime.on("model:thinking", (data: { projectId?: string; thinking: boolean; step: string }) => {
      if (!data.projectId || data.projectId === params.id) {
        setModelThinking(data.thinking);
        setModelStep(data.step);
      }
    });

    return () => {
      realtime.leaveProject(params.id as string);
      unsubChatMessage();
      unsubAnalysisCompleted();
      unsubAnalysisProgress();
      unsubModelThinking();
    };
  }, [params.id, fetchChatData]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    const userMessage = input.trim();
    setInput("");

    try {
      await projectsAPI.projectChat(params.id as string, userMessage);
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span className="font-semibold text-lg">
                {project?.name || "Team Chat"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="card h-[800px] flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">Chat với toàn bộ AI Team</p>
              </div>
            )}

            {messages.map((msg, index) => {
              const agentInfo = AGENT_INFO[msg.role] || AGENT_INFO.AGENT;
              return (
                <div
                  key={msg.id || index}
                  className={`flex gap-4 ${msg.role === "USER" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === "USER" ? "bg-indigo-500" : ""
                    }`}
                    style={
                      msg.role === "AGENT"
                        ? { backgroundColor: agentInfo.bgColor }
                        : {}
                    }
                  >
                    {msg.role === "USER" ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot
                        className="w-4 h-4"
                        style={{ color: agentInfo.color }}
                      />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "USER"
                        ? "bg-indigo-500 text-white"
                        : "bg-zinc-800"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs mt-1 opacity-60">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
            {sending && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-500/20">
                  <Bot className="w-4 h-4 text-purple-400" />
                </div>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-zinc-800">
                  <span className="animate-pulse text-zinc-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {modelStep || "AI Team đang xử lý..."}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhắn cho team..."
              className="input-field flex-1 resize-none h-12 py-3"
              rows={1}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="btn-primary px-6 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
