"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Bot, User as UserIcon, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { tasksAPI } from "@/lib/api";
import { realtime } from "@/lib/realtime";

const AGENT_COLORS: Record<string, string> = {
  PM: "#3b82f6",
  CODING: "#22c55e",
  QA: "#f97316",
  UX: "#ec4899",
  DATA: "#06b6d4",
};

export default function TaskChatPage() {
  const router = useRouter();
  const params = useParams();
  const [task, setTask] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [modelThinking, setModelThinking] = useState(false);
  const [modelStep, setModelStep] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (params.taskId) {
      fetchTask(params.taskId as string);
    }
  }, [params.taskId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!params.taskId) return;

    if (!realtime.isConnected()) {
      const token = localStorage.getItem("token");
      realtime.connect(token || undefined);
    }

    // Join project room so we receive model:thinking broadcasts
    if (params.id) {
      realtime.joinProject(params.id as string);
    }
    realtime.joinTask(params.taskId as string);

    const handleChatMessage = (data: { taskId: string; message: any }) => {
      if (data.taskId === params.taskId) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.message.id);
          if (exists) return prev;
          return [...prev, data.message];
        });
        setSending(false);
      }
    };

    const handleModelThinking = (data: { taskId: string; thinking: boolean; step: string }) => {
      if (data.taskId === params.taskId) {
        setModelThinking(data.thinking);
        setModelStep(data.step || "");
      }
    };

    const handleExecutionStep = (data: { taskId: string; step: string }) => {
      if (data.taskId === params.taskId) {
        // Update model step to show current execution step
        setModelStep(data.step || "");
        setModelThinking(true); // Ensure we know it's still processing
      }
    };

    realtime.on("chat:message", handleChatMessage);
    realtime.on("model:thinking", handleModelThinking);
    realtime.on("execution:step", handleExecutionStep);

    return () => {
      if (params.id) {
        realtime.leaveProject(params.id as string);
      }
      if (params.taskId) {
        realtime.leaveTask(params.taskId as string);
      }
      realtime.off("chat:message", handleChatMessage);
      realtime.off("model:thinking", handleModelThinking);
      realtime.off("execution:step", handleExecutionStep);
    };
  }, [params.taskId, params.id]);

  const fetchTask = async (id: string) => {
    try {
      const res = await tasksAPI.getOne(id);
      setTask(res.data);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error("Failed to fetch task", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    const userMsg = {
      role: "USER",
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await tasksAPI.chat(params.taskId as string, userMessage);
      setMessages(result.data.messages || []);
    } catch (err) {
      console.error("Failed to send message", err);
      const errorMsg = {
        role: "AGENT",
        content: "Xin lỗi, đã xảy ra lỗi. Vui lòng đảm bảo Ollama đang chạy.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-zinc-400">Task not found</div>
      </div>
    );
  }

  const agentColor = AGENT_COLORS[task.agentType] || "#6366f1";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/${params.id}`}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${agentColor}20` }}
            >
              <span className="text-xs font-bold" style={{ color: agentColor }}>
                {task.agentType}
              </span>
            </div>
            <div>
              <h1 className="font-semibold">{task.title}</h1>
              <p className="text-zinc-400 text-sm">
                {task.description || "Chat with agent"}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h2 className="text-xl font-medium mb-2">
                Bắt đầu cuộc trò chuyện
              </h2>
              <p className="text-zinc-400">
                Gửi tin nhắn để chat với {task.agentType} Agent
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-4 ${msg.role === "USER" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === "USER" ? "bg-indigo-500" : ""
                }`}
                style={
                  msg.role === "AGENT"
                    ? { backgroundColor: `${agentColor}20` }
                    : {}
                }
              >
                {msg.role === "USER" ? (
                  <UserIcon className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4" style={{ color: agentColor }} />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "USER"
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-800 text-zinc-100"
                }`}
              >
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {sending && (
            <div className="flex gap-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${agentColor}20` }}
              >
                <Bot className="w-4 h-4" style={{ color: agentColor }} />
              </div>
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-zinc-800">
                <span className="animate-pulse text-zinc-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {modelStep || "Đang xử lý..."}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Nhắn tin cho ${task.agentType} Agent...`}
              className="input-field flex-1 resize-none h-12 py-3"
              rows={1}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="btn-primary px-6 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-zinc-500 text-xs mt-2 text-center">
            Nhấn Enter để gửi, Shift+Enter để xuống dòng
          </p>
        </div>
      </footer>
    </div>
  );
}
