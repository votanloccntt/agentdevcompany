"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Bot, User } from "lucide-react";
import { projectsAPI } from "@/lib/api";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (params.id) {
      fetchChat(params.id as string);
    }
  }, [params.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchChat = async (projectId: string) => {
    try {
      const [projectRes, chatRes] = await Promise.all([
        projectsAPI.getOne(projectId),
        projectsAPI.getProjectChat(projectId).catch(() => null),
      ]);
      setProject(projectRes.data);

      if (chatRes?.data) {
        setMessages(chatRes.data.messages || []);
        setTaskId(chatRes.data.id);
      }
    } catch (err) {
      console.error("Failed to fetch chat", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update - add user message immediately
    const tempId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "USER",
        content: userMessage,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      // For streaming, we need to handle it differently
      // First, save user message and get response
      const res = await projectsAPI.projectChat(project.id, userMessage);

      if (res.data?.messages) {
        setMessages(res.data.messages);
        setTaskId(res.data.id);
      }
    } catch (err) {
      console.error("Failed to send message", err);
      // Remove optimistic update on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleSendStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Add user message
    const tempId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "USER",
        content: userMessage,
        createdAt: new Date().toISOString(),
      },
    ]);

    // Add placeholder for streaming response
    const responseId = (tempId + 1).toString();
    let fullResponse = "";

    setMessages((prev) => [
      ...prev,
      {
        id: responseId,
        role: "AGENT",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch(
        `http://localhost:5000/api/projects/${project.id}/chat/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ message: userMessage }),
        },
      );

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;

          // Update streaming message
          setMessages((prev) =>
            prev.map((m) =>
              m.id === responseId ? { ...m, content: fullResponse } : m,
            ),
          );
        }
      }

      // Refresh to get final saved messages
      await fetchChat(project.id);
    } catch (err) {
      console.error("Failed to send stream message", err);
      // Remove optimistic updates on error
      setMessages((prev) =>
        prev.filter((m) => m.id !== tempId && m.id !== responseId),
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-zinc-400">Loading team chat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link
            href={`/projects/${project?.id}`}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(168, 85, 247, 0.2)" }}
            >
              <Bot className="w-5 h-5 text-purple-400" />
            </div>
            <span className="font-medium text-purple-400">AI Team</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h2 className="text-xl font-medium mb-2">
                Welcome to Team Chat!
              </h2>
              <p className="text-zinc-400 max-w-md mx-auto">
                Chat with your AI Development Team. Ask about requirements,
                architecture, testing strategy, UX design, or data model for
                your project.
              </p>
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.role === "USER";
            const agentKey = isUser ? "USER" : "AGENT";
            const baseAgent = AGENT_INFO[agentKey];
            const agent = baseAgent;

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="flex flex-col items-center">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                      style={{ backgroundColor: agent.bgColor }}
                    >
                      <Bot className="w-5 h-5" style={{ color: agent.color }} />
                    </div>
                    <span className="text-xs" style={{ color: agent.color }}>
                      {agent.name}
                    </span>
                  </div>
                )}

                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                    isUser
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : "bg-zinc-800 text-zinc-100 rounded-bl-md"
                  }`}
                >
                  {!isUser && agent.name !== "AI Team" && (
                    <div
                      className="text-xs font-medium mb-1"
                      style={{ color: agent.color }}
                    >
                      {agent.name}
                    </div>
                  )}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content || (isUser ? "" : "Đang suy nghĩ...")}
                  </div>
                </div>

                {isUser && (
                  <div className="flex flex-col items-center">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                      style={{ backgroundColor: agent.bgColor }}
                    >
                      <User
                        className="w-5 h-5"
                        style={{ color: agent.color }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: agent.color }}>
                      {agent.name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSendStream} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the team about your project..."
              className="input-field flex-1"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="btn-primary px-6"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
