import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  providers: [LLMService, OpenAIProvider, AnthropicProvider, GeminiProvider],
  exports: [LLMService],
})
export class LLMModule {}
