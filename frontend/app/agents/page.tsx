"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Briefcase,
  Code,
  Bug,
  Palette,
  Database,
  X,
  Bot,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const AGENTS = [
  {
    type: "PM",
    name: "PM Agent",
    icon: Briefcase,
    color: "#3b82f6",
    description: "Project Manager - Break down requirements, coordinate work",
  },
  {
    type: "CODING",
    name: "Coding Agent",
    icon: Code,
    color: "#22c55e",
    description: "Full Stack Developer - Write code, implement features",
  },
  {
    type: "QA",
    name: "QA Agent",
    icon: Bug,
    color: "#f97316",
    description: "Quality Assurance - Create tests, find bugs",
  },
  {
    type: "UX",
    name: "UX Agent",
    icon: Palette,
    color: "#ec4899",
    description: "UX Designer - Design experiences, create wireframes",
  },
  {
    type: "DATA",
    name: "Data Agent",
    icon: Database,
    color: "#06b6d4",
    description: "Data Engineer - Work with data, create pipelines",
  },
];

export default function AgentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const agentType = searchParams.get("agent");
    if (agentType) {
      const agent = AGENTS.find((a) => a.type === agentType);
      if (agent) {
        setSelectedAgent(agent);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedContent]);

  const handleSend = async () => {
    if (!input.trim() || !selectedAgent || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    setMessages((prev) => [
      ...prev,
      {
        role: "USER",
        content: userMessage,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/agents/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentType: selectedAgent.type,
          message: userMessage,
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "AGENT",
          content: data.content,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "AGENT",
          content: "Sorry, an error occurred while processing your request.",
          createdAt: new Date().toISOString(),
        },
      ]);
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

  const startChat = (agent: any) => {
    setSelectedAgent(agent);
    setMessages([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span className="font-semibold text-lg">Agents</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent List */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-medium mb-4">Choose an Agent</h2>
            <div className="space-y-3">
              {AGENTS.map((agent) => (
                <button
                  key={agent.type}
                  onClick={() => startChat(agent)}
                  className={`w-full card hover:border-zinc-700 transition-all duration-200 text-left ${
                    selectedAgent?.type === agent.type
                      ? "border-indigo-500"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${agent.color}20` }}
                    >
                      <agent.icon
                        className="w-6 h-6"
                        style={{ color: agent.color }}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium">{agent.name}</h3>
                      <p className="text-zinc-400 text-sm">
                        {agent.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2">
            {selectedAgent ? (
              <div className="card h-[600px] flex flex-col">
                {/* Chat Header */}
                <div
                  className="flex items-center gap-4 pb-4 border-b border-zinc-700 mb-4"
                  style={{ borderColor: "#27272a" }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${selectedAgent.color}20` }}
                  >
                    <selectedAgent.icon
                      className="w-5 h-5"
                      style={{ color: selectedAgent.color }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{selectedAgent.name}</h3>
                    <p className="text-zinc-400 text-sm">Ready to help</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAgent(null);
                      setMessages([]);
                    }}
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <Bot className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                      <p className="text-zinc-400">
                        Start a conversation with {selectedAgent.name}
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
                            ? { backgroundColor: `${selectedAgent.color}20` }
                            : {}
                        }
                      >
                        {msg.role === "USER" ? (
                          <span className="text-white text-xs">U</span>
                        ) : (
                          <Bot
                            className="w-4 h-4"
                            style={{ color: selectedAgent.color }}
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
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}

                  {streaming && streamedContent && (
                    <div className="flex gap-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${selectedAgent.color}20` }}
                      >
                        <Bot
                          className="w-4 h-4"
                          style={{ color: selectedAgent.color }}
                        />
                      </div>
                      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-zinc-800">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{streamedContent}</ReactMarkdown>
                        </div>
                        <span className="animate-pulse">▍</span>
                      </div>
                    </div>
                  )}

                  {sending && !streamedContent && (
                    <div className="flex gap-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${selectedAgent.color}20` }}
                      >
                        <Bot
                          className="w-4 h-4"
                          style={{ color: selectedAgent.color }}
                        />
                      </div>
                      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-zinc-800">
                        <span className="animate-pulse text-zinc-400">
                          Thinking...
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="flex gap-3">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${selectedAgent.name}...`}
                    className="input-field flex-1 resize-none h-12 py-3"
                    rows={1}
                    disabled={sending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="btn-primary px-6 disabled:opacity-50"
                    style={{ backgroundColor: selectedAgent.color }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="card h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <Bot className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select an Agent</h3>
                  <p className="text-zinc-400">
                    Choose an agent from the list to start a conversation
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
