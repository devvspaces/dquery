import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GenerationEngine = 'ai' | 'words';

export interface CreditPricing {
  perAiGeneration: number;
  perWordGeneration: number;
  perDomainCheck: number;
}

export interface CreditQuote {
  generation: number;
  checks: number;
  checking: number;
  total: number;
}

/** Round to whole cents of a credit, matching the decimal(10,2) ledger. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The single source of truth for what an action costs.
 * Availability is one registry lookup per domain and prices come from the
 * catalog, so cost scales with names × TLDs, never with the registrar count.
 */
@Injectable()
export class CreditPricingService {
  constructor(private readonly config: ConfigService) {}

  pricing(): CreditPricing {
    return {
      perAiGeneration: this.config.get<number>('credits.perAiGeneration', 1),
      perWordGeneration: this.config.get<number>(
        'credits.perWordGeneration',
        0.25,
      ),
      perDomainCheck: this.config.get<number>('credits.perDomainCheck', 0.05),
    };
  }

  /** Cost of a generation run plus checking `names × tlds` domains. */
  quoteGeneration(
    engine: GenerationEngine,
    names: number,
    tlds: number,
  ): CreditQuote {
    const p = this.pricing();
    const generation =
      engine === 'words' ? p.perWordGeneration : p.perAiGeneration;
    return this.build(generation, names * tlds);
  }

  /** Cost of checking `domains` fully-qualified domains. */
  quoteChecks(domains: number): CreditQuote {
    return this.build(0, domains);
  }

  private build(generation: number, checks: number): CreditQuote {
    const checking = round2(checks * this.pricing().perDomainCheck);
    return {
      generation: round2(generation),
      checks,
      checking,
      total: round2(generation + checking),
    };
  }
}
