import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { OllamaService } from '../ollama/ollama.service';

@Module({
  controllers: [TestController],
  providers: [OllamaService],
})
export class TestModule {}