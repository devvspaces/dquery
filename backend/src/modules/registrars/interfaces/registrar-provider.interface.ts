/**
 * Registry-level availability of a name. Availability is decided by the TLD's
 * registry, so it is the same at every registrar; only price differs.
 *
 * - available:   the registry says the name can be registered
 * - taken:       the name is registered (or reserved / disallowed by the registry)
 * - unknown:     the provider failed, timed out or gave no answer for this name.
 *                Never treat this as "taken".
 * - unsupported: this provider does not sell this TLD (other providers may)
 */
export type AvailabilityStatus =
  | 'available'
  | 'taken'
  | 'unknown'
  | 'unsupported';

export type PriceSource = 'live' | 'catalog-api' | 'catalog-static' | 'manual';

/**
 * One registrar's offer for one domain. This is what the API returns per
 * registrar, and what the frontend renders in the comparison table.
 */
export interface DomainAvailability {
  domain: string;
  tld: string;
  /** Kept for backwards compatibility: true only when status === 'available'. */
  available: boolean;
  status: AvailabilityStatus;
  /** First-year registration price. */
  price?: number;
  renewalPrice?: number;
  transferPrice?: number;
  /** Total cost of registering + renewing for 3 years in total. */
  threeYearTotal?: number;
  /** True when `price` is a first-year promo below the regular price. */
  isPromo?: boolean;
  currency?: string;
  registrar: string;
  premiumDomain?: boolean;
  priceSource?: PriceSource;
  /** True when the catalog price is older than the staleness window. */
  stale?: boolean;
  /** Provider-specific reason (e.g. Cloudflare `extension_not_supported_via_api`). */
  reason?: string;
  error?: string;
  /** When `price` was converted to USD: the registrar's own currency and price. */
  originalCurrency?: string;
  originalPrice?: number;
  /** Where to buy this domain at this registrar (may carry an affiliate ID). */
  purchaseUrl?: string;
  checkedAt: Date;
}

/**
 * Result of a live availability check from a single provider.
 */
export interface AvailabilityResult {
  domain: string;
  tld: string;
  status: AvailabilityStatus;
  premium?: boolean;
  /** Live price returned by the provider (premium price, or Cloudflare's at-cost price). */
  price?: number;
  renewalPrice?: number;
  currency?: string;
  /**
   * One-off fee added on top of this registrar's standard first-year price,
   * e.g. a Namecheap Early Access Program (EAP) fee during a new TLD launch.
   */
  extraFee?: number;
  reason?: string;
  error?: string;
}

/**
 * Standard (non-premium) price for one TLD at one registrar.
 */
export interface TldPriceQuote {
  registrar: string;
  tld: string;
  currency: string;
  registerPrice: number;
  renewalPrice: number;
  transferPrice?: number;
  /** Regular first-year price when `registerPrice` is a promo. */
  regularRegisterPrice?: number;
  isPromo: boolean;
  source: PriceSource;
}

export interface ProviderRateLimits {
  requestsPerMinute: number;
  /** Max domains per live availability request. */
  maxBulkSize: number;
}

/**
 * Base contract for every registrar. A provider then implements one or both
 * capabilities below.
 *
 * To add a registrar:
 *   1. Create providers/<name>.provider.ts extending BaseRegistrarProvider
 *   2. Implement AvailabilityChecker and/or PriceCatalogSource
 *   3. Register it in registrars.module.ts and the REGISTRAR_PROVIDERS factory
 */
export interface IRegistrarProvider {
  /** Stable lowercase id used in config, DB rows and cache keys (e.g. "namecheap"). */
  readonly id: string;
  /** Display name (e.g. "Namecheap"). */
  getProviderName(): string;
  /** False when credentials are missing; the provider is then skipped. */
  isConfigured(): boolean;
  getRateLimits(): ProviderRateLimits;
  /** Static list of TLDs the provider can check live. Empty means "unknown, try anything". */
  getSupportedTlds(): Promise<string[]>;
  /** Link to buy `fqdn` at this registrar, if we know one. */
  purchaseUrl?(fqdn: string, override?: string): string | undefined;
}

export interface AvailabilityChecker extends IRegistrarProvider {
  /**
   * True when the live check returns this registrar's real price for every
   * name (not only premium ones), e.g. Cloudflare and GoDaddy, which have no
   * price-list API. The aggregator then asks it for prices of available names
   * even when another provider did the availability check.
   */
  readonly providesLivePricing: boolean;
  checkAvailability(
    domains: Array<{ domain: string; tld: string }>,
  ): Promise<AvailabilityResult[]>;
}

export interface PriceCatalogSource extends IRegistrarProvider {
  fetchTldPrices(): Promise<TldPriceQuote[]>;
}

export function isAvailabilityChecker(
  p: IRegistrarProvider,
): p is AvailabilityChecker {
  return typeof (p as AvailabilityChecker).checkAvailability === 'function';
}

export function isPriceCatalogSource(
  p: IRegistrarProvider,
): p is PriceCatalogSource {
  return typeof (p as PriceCatalogSource).fetchTldPrices === 'function';
}

export const REGISTRAR_PROVIDERS = Symbol('REGISTRAR_PROVIDERS');
