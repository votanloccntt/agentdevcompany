import { Controller, Post, Body } from '@nestjs/common';
import { OllamaService } from '../ollama/ollama.service';

@Controller('test')
export class TestController {
  constructor(private ollama: OllamaService) {}

  @Post('ollama')
  async testOllama(@Body() body: { message: string }) {
    const response = await this.ollama.chat(
      [{ role: 'user', content: body.message }],
      'You are a helpful assistant. Reply in Vietnamese.'
    );
    return { response };
  }

  @Post('ollama-stream')
  async testOllamaStream(@Body() body: { message: string }) {
    const messages = [{ role: 'user', content: body.message }];
    const system = 'You are a helpful assistant. Reply in Vietnamese.';
    
    const stream = this.ollama.chatStream(messages, system);
    
    let fullContent = '';
    for await (const chunk of stream) {
      fullContent += chunk;
    }
    
    return { response: fullContent };
  }
}