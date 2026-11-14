import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
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
export class GeminiProvider implements ILLMProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private client: GoogleGenAI;
  private model: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('llm.gemini.apiKey');
    if (!apiKey) {
      this.logger.warn('Gemini API key not configured');
    }

    this.client = new GoogleGenAI({
      apiKey: apiKey || 'dummy-key',
    });

    this.model =
      this.configService.get<string>('llm.gemini.model') || 'gemini-2.5-flash';
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
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: userPrompt,
        config: {
          systemInstruction: DOMAIN_GENERATION_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              domains: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['domains'],
          },
          temperature: 0.9,
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      const parsed = JSON.parse(text) as { domains: string[] };
      if (!parsed.domains || !Array.isArray(parsed.domains)) {
        throw new Error('Invalid response format from Gemini');
      }

      // Clean and validate domain names
      const domains = this.cleanDomains(parsed.domains, request.count);

      // Extract token usage
      const promptTokens = response.usageMetadata?.promptTokenCount || 0;
      const completionTokens =
        response.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = response.usageMetadata?.totalTokenCount || 0;

      const tokensUsed = {
        prompt: promptTokens,
        completion: completionTokens,
        total: totalTokens,
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
      this.logger.error(`Gemini API error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Estimate cost in cents based on token usage
   * Pricing for Gemini 2.5 Flash as of 2026:
   * - Input Tokens: $0.30 per 1 million tokens ($0.0003 per 1K tokens => 0.03 cents per 1K)
   * - Output Tokens: $2.50 per 1 million tokens ($0.0025 per 1K tokens => 0.25 cents per 1K)
   */
  estimateCost(promptTokens: number, completionTokens: number): number {
    const inputCostPer1K = 0.03; // in cents
    const outputCostPer1K = 0.25; // in cents

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
    return 'gemini';
  }

  getModelName(): string {
    return this.model;
  }
}
