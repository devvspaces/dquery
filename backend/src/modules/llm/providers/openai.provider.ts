import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
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
export class OpenAIProvider implements ILLMProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private client: OpenAI;
  private model: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('llm.openai.apiKey');
    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
    }

    this.client = new OpenAI({
      apiKey: apiKey || 'dummy-key',
    });

    this.model =
      this.configService.get<string>('llm.openai.model') || 'gpt-4-turbo';
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

    this.logger.log(
      `Generating ${request.count} domains for "${request.businessName}" using ${this.model}`,
    );

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: DOMAIN_GENERATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9, // Higher for creativity
        max_tokens: 1000,
      });

      // Extract and parse response
      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }
      const parsed = JSON.parse(content);

      if (!parsed.domains || !Array.isArray(parsed.domains)) {
        throw new Error('Invalid response format from OpenAI');
      }

      // Clean and validate domain names
      const domains = this.cleanDomains(parsed.domains, request.count);

      // Extract token usage
      const tokensUsed = {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
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
        error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenAI API error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Estimate cost in cents based on token usage
   * Pricing as of 2024:
   * - GPT-4 Turbo: $0.01 per 1K prompt tokens, $0.03 per 1K completion tokens
   * - GPT-3.5 Turbo: $0.0005 per 1K prompt tokens, $0.0015 per 1K completion tokens
   */
  estimateCost(promptTokens: number, completionTokens: number): number {
    const isGPT4 = this.model.includes('gpt-4');

    const promptCostPer1K = isGPT4 ? 1.0 : 0.05; // in cents
    const completionCostPer1K = isGPT4 ? 3.0 : 0.15; // in cents

    const promptCost = (promptTokens / 1000) * promptCostPer1K;
    const completionCost = (completionTokens / 1000) * completionCostPer1K;

    return Math.ceil(promptCost + completionCost); // Round up to nearest cent
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
    return 'openai';
  }

  getModelName(): string {
    return this.model;
  }
}
