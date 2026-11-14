export interface DomainGenerationRequest {
  businessName: string;
  description?: string;
  count: number;
  style?: 'creative' | 'professional' | 'short' | 'descriptive';
}

export interface DomainGenerationResponse {
  domains: string[];
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  estimatedCost: number; // in cents
  provider: string;
  model: string;
}

export interface ILLMProvider {
  generateDomains(
    request: DomainGenerationRequest,
  ): Promise<DomainGenerationResponse>;
  estimateCost(promptTokens: number, completionTokens: number): number;
  getProviderName(): string;
  getModelName(): string;
}
