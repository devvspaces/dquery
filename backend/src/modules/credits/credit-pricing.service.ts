import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

export type GenerationEngine = 'ai' | 'words';

export interface CreditPricing {
  perAiGeneration: number;
  perWordGeneration: number;
  perDomainCheck: number;
  /** Saved searches: re-read prices for one domain from the catalog. */
  perPriceRefresh: number;
  /** Most extensions one search may use (not a price, but the UI needs it with them). */
  maxTlds: number;
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
  constructor(private readonly settings: SettingsService) {}

  pricing(): CreditPricing {
    return {
      perAiGeneration: this.settings.get<number>('credits.perAiGeneration'),
      perWordGeneration: this.settings.get<number>('credits.perWordGeneration'),
      perDomainCheck: this.settings.get<number>('credits.perDomainCheck'),
      perPriceRefresh: this.settings.get<number>('credits.perPriceRefresh'),
      maxTlds: this.maxTlds(),
    };
  }

  maxTlds(): number {
    return Math.max(1, Math.floor(this.settings.get<number>('search.maxTlds')));
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

  /** Cost of refreshing the prices of `domains` saved results from the catalog. */
  quotePriceRefresh(domains: number): number {
    return round2(domains * this.pricing().perPriceRefresh);
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
