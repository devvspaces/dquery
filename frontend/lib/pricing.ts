/** Credit prices as served by GET /api/credits/pricing. */
export interface CreditPricing {
  perAiGeneration: number;
  perWordGeneration: number;
  perDomainCheck: number;
  /** Saved searches: re-read one domain's prices from the catalog. */
  perPriceRefresh?: number;
  /** Most extensions one search may use (server setting search.maxTlds). */
  maxTlds?: number;
}

/** Sign-up promo as served by GET /api/credits/promo. */
export interface CreditPromo {
  earlyAmount: number;
  earlyLimit: number;
  earlyRemaining: number;
  defaultAmount: number;
}

export type GenerationEngine = "ai" | "words";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Mirrors CreditPricingService.quoteGeneration on the backend. */
export function estimateGeneration(
  pricing: CreditPricing,
  engine: GenerationEngine,
  names: number,
  tlds: number
): number {
  const base = engine === "words" ? pricing.perWordGeneration : pricing.perAiGeneration;
  return round2(base + round2(names * tlds * pricing.perDomainCheck));
}

/** Mirrors CreditPricingService.quoteChecks on the backend. */
export function estimateChecks(pricing: CreditPricing, domains: number): number {
  return round2(domains * pricing.perDomainCheck);
}

/** "3.25" / "1" / "0.4": at most two decimals, no trailing zeros. */
/** Re-pricing saved domains from the daily catalog (no live checks). */
export function estimatePriceRefresh(pricing: CreditPricing, domains: number): number {
  return round2(domains * (pricing.perPriceRefresh ?? 0.01));
}

export function formatCredits(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0";
  return String(round2(n));
}

/** Thrown for HTTP 402 so callers can open the credits dialog. */
export class InsufficientCreditsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number
  ) {
    super(
      `This needs ${formatCredits(required)} credits; you have ${formatCredits(available)}.`
    );
    this.name = "InsufficientCreditsError";
  }
}
