import { DomainAvailability } from '../../modules/registrars/interfaces/registrar-provider.interface';

import type { WordEngineConfig } from '../../modules/namegen/types';

export interface DomainGenerationJobData {
  userId: string;
  /** 'ai' (LLM, default) or 'words' (rule-based word engine). */
  engine?: 'ai' | 'words';
  /** false: generate names only; the client checks the ones it keeps. */
  autoCheck?: boolean;
  wordEngine?: WordEngineConfig;
  businessName: string;
  description?: string;
  count: number;
  style?: 'creative' | 'professional' | 'short' | 'descriptive';
  tlds: string[];
  creditsDeducted: number;
  searchHistoryId?: string;
  /** "More names" for an existing search: append to it instead of creating one. */
  searchId?: string;
  /** Names to leave out (already in the search). */
  exclude?: string[];
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
  /** Word engine only: the naming technique behind each name. */
  techniques?: Record<string, string>;
  searchHistoryId: string;
  checkingJobIds: string[];
}

export interface DomainCheckingJobData {
  userId: string;
  domains: Array<{ domain: string; tld: string }>;
  creditsDeducted: number;
  parentJobId?: string;
  /** saved_searches.id: results are stored on that search. */
  searchHistoryId?: string;
  /** Skip the short-lived availability cache (user asked for a re-check). */
  force?: boolean;
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
