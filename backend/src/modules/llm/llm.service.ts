import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { llmUsageLogs } from '../../database/schema';
import {
  ILLMProvider,
  DomainGenerationRequest,
  DomainGenerationResponse,
} from './interfaces/llm-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private provider: ILLMProvider;

  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {
    const providerName =
      this.configService.get<string>('llm.provider') || 'openai';

    this.logger.log(`Initializing LLM provider: ${providerName}`);

    switch (providerName.toLowerCase()) {
      case 'openai':
        this.provider = new OpenAIProvider(this.configService);
        break;
      case 'anthropic':
        this.provider = new AnthropicProvider(this.configService);
        break;
      case 'gemini':
        this.provider = new GeminiProvider(this.configService);
        break;
      default:
        this.logger.warn(
          `Unknown provider "${providerName}", defaulting to OpenAI`,
        );
        this.provider = new OpenAIProvider(this.configService);
    }
  }

  /**
   * Generate domain names using the configured LLM provider
   */
  async generateDomains(
    request: DomainGenerationRequest,
    userId?: string,
  ): Promise<DomainGenerationResponse> {
    this.logger.log(
      `Generating domains for business: "${request.businessName}"`,
    );

    try {
      // Generate domains using provider
      const response = await this.provider.generateDomains(request);

      // Log usage to database (async, don't block response)
      if (userId) {
        this.logUsage(
          userId,
          response.provider,
          response.model,
          response.tokensUsed,
          response.estimatedCost,
        ).catch((error) => {
          this.logger.error(`Failed to log LLM usage: ${error.message}`);
        });
      }

      return response;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Domain generation failed: ${error.message}`);
      } else {
        this.logger.error(`Domain generation failed: ${JSON.stringify(error)}`);
      }
      throw error;
    }
  }

  /**
   * Log LLM usage to analytics table
   */
  private async logUsage(
    userId: string,
    provider: string,
    model: string,
    tokensUsed: { prompt: number; completion: number; total: number },
    estimatedCost: number,
  ): Promise<void> {
    const db = this.databaseService.getDb();

    try {
      await db.insert(llmUsageLogs).values({
        userId,
        provider,
        model,
        promptTokens: tokensUsed.prompt,
        completionTokens: tokensUsed.completion,
        totalTokens: tokensUsed.total,
        estimatedCost,
      });

      this.logger.debug(`Logged LLM usage for user ${userId}`);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to log usage: ${error.message}`);
      } else {
        this.logger.error(`Failed to log usage: ${JSON.stringify(error)}`);
      }
    }
  }

  /**
   * Get the current provider name
   */
  getProviderName(): string {
    return this.provider.getProviderName();
  }

  /**
   * Get the current model name
   */
  getModelName(): string {
    return this.provider.getModelName();
  }
}
