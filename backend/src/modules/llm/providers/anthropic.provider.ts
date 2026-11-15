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

  constructor(
    private configService: ConfigService,
    model?: string,
  ) {
    const apiKey = this.configService.get<string>('llm.anthropic.apiKey');
    if (!apiKey) {
      this.logger.warn('Anthropic API key not configured');
    }

    this.client = new Anthropic({
      apiKey: apiKey || 'dummy-key',
    });

    this.model =
      model ||
      this.configService.get<string>('llm.anthropic.model') ||
      'claude-opus-5-5';
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
        max_tokens: 16000,
        // Current models reject temperature; effort controls thinking depth.
        // Naming domains is a light task, so low effort keeps it fast and cheap.
        output_config: { effort: 'low' },
        messages: [
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
      });

      // Extract text content
      // Thinking blocks may precede the answer, so find the text block.
      if (message.stop_reason === 'refusal') {
        throw new Error('Anthropic declined the request');
      }
      const content = message.content.find((block) => block.type === 'text');
      if (!content) {
        throw new Error('Unexpected response type from Anthropic');
      }

      // Parse JSON response (tolerate a ```json fence around it)
      const text = content.text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
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
   * Estimate cost in cents from token usage (USD per 1M tokens, input/output):
   * Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50.
   */
  estimateCost(promptTokens: number, completionTokens: number): number {
    const [inputPerMillion, outputPerMillion] = this.model.includes('haiku')
      ? [0.1, 0.5]
      : this.model.includes('sonnet')
        ? [2, 10]
        : [4, 20];

    // dollars per 1M tokens -> cents per token = x * 100 / 1e6
    const inputCost = (promptTokens * inputPerMillion) / 10_000;
    const outputCost = (completionTokens * outputPerMillion) / 10_000;

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
