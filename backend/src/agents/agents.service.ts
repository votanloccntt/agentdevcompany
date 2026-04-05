import { Injectable } from "@nestjs/common";
import { OllamaService } from "../ollama/ollama.service";
import { AGENT_PROMPTS, AgentType } from "./prompts";

@Injectable()
export class AgentsService {
  constructor(private ollama: OllamaService) {}

  getAllAgents() {
    return Object.entries(AGENT_PROMPTS).map(([key, agent]) => ({
      type: key,
      name: agent.name,
      icon: agent.icon,
      color: agent.color,
      description: agent.description,
    }));
  }

  getAgent(type: AgentType) {
    return AGENT_PROMPTS[type];
  }

  async chat(type: AgentType, message: string) {
    const agent = AGENT_PROMPTS[type];
    const response = await this.ollama.chat(
      [{ role: "user", content: message }],
      agent.systemPrompt,
    );
    return response; // response là object { message: { content: string, ... }, ... }
  }

  private baseUrl = "http://localhost:11434"; // Ollama server
  async *chatStream(type: string, message: string) {
    const systemPrompt = `Agent type: ${type}`;
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma4:latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        stream: true,
      }),
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const content = parsed.message?.content || parsed.content || "";
          const thinking = parsed.message?.thinking || parsed.thinking || "";
          const output = { content, thinking };
          if (content || thinking) yield output;
        } catch {}
      }
    }
  }
}
