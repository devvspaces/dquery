import { DomainAvailability } from '../../modules/registrars/interfaces/registrar-provider.interface';

export interface DomainGenerationJobData {
  userId: string;
  businessName: string;
  description?: string;
  count: number;
  style?: 'creative' | 'professional' | 'short' | 'descriptive';
  tlds: string[];
  creditsDeducted: number;
  searchHistoryId?: string;
}

export interface DomainGenerationJobResult {
  domains: string[];
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  estimatedCost: number;
  provider: string;
  model: string;
  searchHistoryId: string;
  checkingJobIds: string[];
}

export interface DomainCheckingJobData {
  userId: string;
  domains: Array<{ domain: string; tld: string }>;
  creditsDeducted: number;
  parentJobId?: string;
  searchHistoryId?: string;
}

export interface DomainCheckingJobResult {
  results: Array<{
    domain: string;
    tld: string;
    results: DomainAvailability[];
    availableCount: number;
    bestPrice: number | null;
    bestRegistrar: string | null;
    checkedAt: Date;
  }>;
  checkedAt: Date;
}
