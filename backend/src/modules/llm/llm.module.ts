import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';

/** Providers are built by LLMService from the current settings (provider + model). */
@Module({
  providers: [LLMService],
  exports: [LLMService],
})
export class LLMModule {}
