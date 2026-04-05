'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Bot, User as UserIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { tasksAPI } from '@/lib/api';

const AGENT_COLORS: Record<string, string> = {
  PM: '#3b82f6',
  CODING: '#22c55e',
  QA: '#f97316',
  UX: '#ec4899',
  DATA: '#06b6d4',
};

export default function TaskChatPage() {
  const router = useRouter();
  const params = useParams();
  const [task, setTask] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    if (params.taskId) {
      fetchTask(params.taskId as string);
    }
  }, [params.taskId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedContent]);

  const fetchTask = async (id: string) => {
    try {
      const res = await tasksAPI.getOne(id);
      setTask(res.data);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to fetch task', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);
    setStreaming(true);
    setStreamedContent('');

    // Add user message immediately
    const userMsg = { role: 'USER', content: userMessage, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/api/tasks/' + params.taskId + '/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          fullContent += chunk;
          setStreamedContent(fullContent);
        }
      }

      // Add agent message
      const agentMsg = { role: 'AGENT', content: fullContent, createdAt: new Date().toISOString() };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      console.error('Failed to send message', err);
      // Add error message
      const errorMsg = { role: 'AGENT', content: 'Sorry, I encountered an error. Please make sure Ollama is running.', createdAt: new Date().toISOString() };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      setStreaming(false);
      setStreamedContent('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
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

  const agentColor = AGENT_COLORS[task.agentType] || '#6366f1';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${params.id}`} className="text-zinc-400 hover:text-white transition-colors">
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
              <p className="text-zinc-400 text-sm">{task.description || 'Chat with agent'}</p>
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
              <h2 className="text-xl font-medium mb-2">Start the conversation</h2>
              <p className="text-zinc-400">
                Send a message to start chatting with the {task.agentType} Agent
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-4 ${msg.role === 'USER' ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'USER' ? 'bg-indigo-500' : ''
                }`}
                style={msg.role === 'AGENT' ? { backgroundColor: `${agentColor}20` } : {}}
              >
                {msg.role === 'USER' ? (
                  <UserIcon className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4" style={{ color: agentColor }} />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'USER'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-zinc-800 text-zinc-100'
                }`}
              >
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {streaming && streamedContent && (
            <div className="flex gap-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${agentColor}20` }}
              >
                <Bot className="w-4 h-4" style={{ color: agentColor }} />
              </div>
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-zinc-800">
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
                style={{ backgroundColor: `${agentColor}20` }}
              >
                <Bot className="w-4 h-4" style={{ color: agentColor }} />
              </div>
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-zinc-800">
                <span className="animate-pulse text-zinc-400">Thinking...</span>
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
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${task.agentType} Agent...`}
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
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </footer>
    </div>
  );
}
