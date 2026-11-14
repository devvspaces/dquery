import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  ILLMProvider,
  DomainGenerationRequest,
  DomainGenerationResponse,
} from '../interfaces/llm-provider.interface';
import {
  DOMAIN_GENERATION_SYSTEM_PROMPT,
  buildUserPrompt,
} from '../constants/prompts';

@Injectable()
export class AnthropicProvider implements ILLMProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private client: Anthropic;
  private model: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('llm.anthropic.apiKey');
    if (!apiKey) {
      this.logger.warn('Anthropic API key not configured');
    }

    this.client = new Anthropic({
      apiKey: apiKey || 'dummy-key',
    });

    this.model =
      this.configService.get<string>('llm.anthropic.model') ||
      'claude-3-5-sonnet-20241022';
  }

  async generateDomains(
    request: DomainGenerationRequest,
  ): Promise<DomainGenerationResponse> {
    const userPrompt = buildUserPrompt(
      request.businessName,
      request.description,
      request.count,
      request.style,
    );

    // Combine system prompt with user prompt for Anthropic
    const fullPrompt = `${DOMAIN_GENERATION_SYSTEM_PROMPT}\n\n${userPrompt}`;

    this.logger.log(
      `Generating ${request.count} domains for "${request.businessName}" using ${this.model}`,
    );

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        temperature: 0.9, // Higher for creativity
        messages: [
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
      });

      // Extract text content
      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      // Parse JSON response
      const text = content.text.trim();
      const parsed = JSON.parse(text) as { domains: string[] };

      if (!parsed.domains || !Array.isArray(parsed.domains)) {
        throw new Error('Invalid response format from Anthropic');
      }

      // Clean and validate domain names
      const domains = this.cleanDomains(parsed.domains, request.count);

      // Extract token usage
      const tokensUsed = {
        prompt: message.usage.input_tokens,
        completion: message.usage.output_tokens,
        total: message.usage.input_tokens + message.usage.output_tokens,
      };

      // Calculate cost
      const estimatedCost = this.estimateCost(
        tokensUsed.prompt,
        tokensUsed.completion,
      );

      this.logger.log(
        `Generated ${domains.length} domains. Tokens: ${tokensUsed.total}, Cost: $${(estimatedCost / 100).toFixed(4)}`,
      );

      return {
        domains,
        tokensUsed,
        estimatedCost,
        provider: this.getProviderName(),
        model: this.model,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Anthropic API error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Estimate cost in cents based on token usage
   * Pricing as of 2024:
   * - Claude 3.5 Sonnet: $0.003 per 1K input tokens, $0.015 per 1K output tokens
   * - Claude 3 Haiku: $0.00025 per 1K input tokens, $0.00125 per 1K output tokens
   */
  estimateCost(promptTokens: number, completionTokens: number): number {
    const isSonnet = this.model.includes('sonnet');

    const inputCostPer1K = isSonnet ? 0.3 : 0.025; // in cents
    const outputCostPer1K = isSonnet ? 1.5 : 0.125; // in cents

    const inputCost = (promptTokens / 1000) * inputCostPer1K;
    const outputCost = (completionTokens / 1000) * outputCostPer1K;

    return Math.ceil(inputCost + outputCost); // Round up to nearest cent
  }

  /**
   * Clean and validate domain names
   */
  private cleanDomains(domains: string[], requestedCount: number): string[] {
    const cleaned = domains
      .map((d) => d.toLowerCase().trim())
      .filter((d) => d.length >= 3 && d.length <= 30)
      .filter((d) => /^[a-z0-9]+$/.test(d)) // Only alphanumeric
      .slice(0, requestedCount);

    // Remove duplicates
    return [...new Set(cleaned)];
  }

  getProviderName(): string {
    return 'anthropic';
  }

  getModelName(): string {
    return this.model;
  }
}
