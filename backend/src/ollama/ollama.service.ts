import { Injectable } from "@nestjs/common";
import passport from "passport";

@Injectable()
export class OllamaService {
  private baseUrl = "http://localhost:11434";

  async generate(prompt: string, system: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma4:latest",
          prompt,
          system,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error("Ollama error:", error);
      throw error;
    }
  }

  async *generateStream(prompt: string, system: string) {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma4:latest",
          prompt,
          system,
          stream: true,
        }),
      });
      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              yield parsed.response;
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error("Ollama stream error:", error);
      throw error;
    }
  }

  async chat(
    messages: { role: string; content: string }[],
    system: string,
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma4:latest",
          messages: [{ role: "system", content: system }, ...messages],
          stream: false,
          thinking: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json();
      return data.message?.content || data.response || "";
    } catch (error) {
      console.error("Ollama chat error:", error);
      throw error;
    }
  }

  async *chatStream(messages, system) {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma4:latest",
          messages: [{ role: "system", content: system }, ...messages],
          stream: true,
          thinking: false, // Disable extended thinking to get plain text
        }),
      });

      const reader = response.body.getReader();
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
            // gemma4 returns message.content directly when thinking is disabled
            const content = parsed.message?.content ?? parsed.content ?? "";
            if (content) {
              yield content;
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error("Ollama chat stream error:", error);
      throw error;
    }
  }
}
