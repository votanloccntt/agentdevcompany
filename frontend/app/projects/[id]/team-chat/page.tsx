"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Bot, User, Brain, Loader2 } from "lucide-react";
import { projectsAPI } from "@/lib/api";
import { agentsAPI } from "@/lib/api";
import { realtime } from "@/lib/realtime";
import { getManager } from "@/components/AppNotification";

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
  role: "USER" | "AGENT" | "COLLABORATION" | "ERROR" | "PM" | "CODING" | "QA" | "UX" | "DATA" | string;
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

  // Memoized callback for sending messages
  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    const userMessage = input.trim();
    setInput("");

    // Add user message immediately
    const userMsg = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Show notification that agents are discussing
    const notificationManager = getManager();
    const taskId = `team-chat-${params.id}-${Date.now()}`;
    
    notificationManager.onModelThinking({
      taskId,
      projectId: params.id as string,
      thinking: true,
      step: "Các agent đang thảo luận...",
    });

    try {
      // Get token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      // Use agents/collaboration endpoint for multi-agent interaction
      const response = await fetch('http://localhost:5000/api/agents/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }), // Only add auth header if token exists
        },
        body: JSON.stringify({
          message: userMessage,
          agentType: 'PM', // Use PM as default for team chat
          projectId: params.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Update notification to completed
      notificationManager.onModelThinking({
        taskId,
        projectId: params.id as string,
        thinking: false,
        step: "Hoàn tất thảo luận",
      });
      
      // Handle both regular and collaboration responses
      if (data.discussionLog) {
        // This is a collaboration response with discussion log
        const discussionMessages = [];
        
        // Add individual agent responses from discussion log
        for (const discussion of data.discussionLog) {
          const agentMsg = {
            id: `agent-${discussion.sender}-${Date.now()}-${Math.random()}`,
            role: discussion.sender, // Use actual agent type
            content: discussion.content,
            createdAt: discussion.timestamp || new Date().toISOString(),
          };
          discussionMessages.push(agentMsg);
        }
        
        // Add final consensus
        const finalMsg = {
          id: `collab-${Date.now()}`,
          role: "COLLABORATION",
          content: `🔄 Quyết định hợp tác:\n${data.finalSolution}`,
          createdAt: new Date().toISOString(),
        };
        
        setMessages((prev) => [...prev, ...discussionMessages, finalMsg]);
      } else if (data.finalSolution) {
        // This is a collaboration response without discussion log
        const agentMsg = {
          id: `collab-${Date.now()}`,
          role: "COLLABORATION",
          content: `🔄 Quyết định hợp tác:\n${data.finalSolution}`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        // This is a regular agent response
        const agentMsg = {
          id: `agent-${Date.now()}`,
          role: "AGENT",
          content: data.content || data.message || 'No response',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, agentMsg]);
      }
    } catch (err) {
      // Update notification to show error
      const notificationManager = getManager();
      notificationManager.onModelThinking({
        taskId,
        projectId: params.id as string,
        thinking: false,
        step: "Lỗi xử lý yêu cầu",
      });
      
      console.error("Failed to send message", err);
      const errorMsg = {
        id: `error-${Date.now()}`,
        role: "ERROR",
        content: `Xin lỗi, đã xảy ra lỗi: ${err.message || 'Lỗi không xác định'}. Vui lòng đảm bảo Ollama đang chạy và máy chủ backend hoạt động. Nếu bạn chưa đăng nhập, vui lòng đăng nhập trước khi sử dụng chat.`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }, [input, sending, params.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }, [handleSend]);

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

    const unsubAnalysisProgress = realtime.on("analysis:progress", (data: { projectId: string; step: string; status: "started" | "progress" | "completed" | "error" }) => {
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

              // Handle different message types
              if (msg.role === "COLLABORATION") {
                return (
                  <div key={msg.id || index} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-500/20">
                      <Brain className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gradient-to-r from-purple-900/50 to-transparent border border-purple-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-purple-400" />
                        <span className="font-semibold text-purple-300">Quyết định hợp tác</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content.replace('🔄 Quyết định hợp tác:\n', '')}</p>
                      <p className="text-xs mt-2 opacity-60">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              }

              // Handle agent-specific messages
              if (["PM", "CODING", "QA", "UX", "DATA"].includes(msg.role)) {
                const agentSpecificInfo = AGENT_INFO[msg.role] || {
                  name: msg.role,
                  color: "#a855f7",
                  bgColor: "rgba(168, 85, 247, 0.2)",
                };

                return (
                  <div key={msg.id || index} className="flex gap-4">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: agentSpecificInfo.bgColor }}
                    >
                      <Bot
                        className="w-4 h-4"
                        style={{ color: agentSpecificInfo.color }}
                      />
                    </div>
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-zinc-800">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium" style={{ color: agentSpecificInfo.color }}>
                          {agentSpecificInfo.name}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs mt-1 opacity-60">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              }

              // Handle error messages
              if (msg.role === "ERROR") {
                return (
                  <div key={msg.id || index} className="flex gap-4 flex-row-reverse">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-red-500">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-red-900/50 border border-red-500/30">
                      <p className="text-sm text-red-200 whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs mt-1 opacity-60 text-red-400">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              }

              // Handle regular messages
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
                    <div className="flex items-center gap-2 mb-1">
                      {msg.role === "AGENT" && (
                        <span className="text-xs font-medium" style={{ color: agentInfo.color }}>
                          {agentInfo.name}
                        </span>
                      )}
                    </div>
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
                    {modelStep || "Các agent đang thảo luận..."}
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
