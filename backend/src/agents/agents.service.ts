import { Injectable } from '@nestjs/common';
import { OllamaService } from '../ollama/ollama.service';
import { AGENT_PROMPTS, AgentType } from './prompts';

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
    return this.ollama.chat([{ role: 'user', content: message }], agent.systemPrompt);
  }

  async *chatStream(type: AgentType, message: string) {
    const agent = AGENT_PROMPTS[type];
    yield* this.ollama.chatStream([{ role: 'user', content: message }], agent.systemPrompt);
  }
}
