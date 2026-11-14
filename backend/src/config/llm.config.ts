import { registerAs } from '@nestjs/config';

export default registerAs('llm', () => ({
  provider: process.env.LLM_PROVIDER || 'openai',
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.LLM_OPENAI_MODEL || 'gpt-4-turbo',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.LLM_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.LLM_GEMINI_MODEL || 'gemini-2.5-flash',
  },
  maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3', 10),
  timeout: parseInt(process.env.LLM_TIMEOUT || '30000', 10),
}));
