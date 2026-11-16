import { API_BASE_URL } from "@/lib/config";
import type { CreditPricing, CreditPromo } from "@/lib/pricing";

/**
 * Server-side reads of the public API for the landing and price pages.
 * Cached by Next (ISR) so a page render never waits on the API, and every
 * call degrades to `null` so the page still renders if the API is down.
 */

export interface PublicOffer {
  registrarId: string;
  registrar: string;
  registerPrice: number;
  renewalPrice: number;
  transferPrice: number | null;
  threeYearTotal: number;
  isPromo: boolean;
  originalCurrency: string | null;
  originalPrice: number | null;
  updatedAt: string;
}

export interface PublicTldDetail {
  tld: string;
  offers: PublicOffer[];
  updatedAt: string | null;
}

export interface PublicTldSummary {
  tld: string;
  registrars: number;
  cheapestRegister: number;
  cheapestRenewal: number;
  cheapestThreeYear: number;
  threeYearSpread: number;
  updatedAt: string;
}

export interface PublicCatalog {
  stats: { prices: number; tlds: number; registrars: number };
  tlds: PublicTldSummary[];
}

export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  price: number;
  currency: string;
  popular: boolean;
}

/** TLD pages need prices from at least this many registrars to be indexed. */
export const MIN_INDEXABLE_REGISTRARS = 3;

/** Refresh public data every 6 hours (prices sync daily). */
export const PRICE_REVALIDATE = 21600;

async function get<T>(path: string, revalidate = PRICE_REVALIDATE): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api${path}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const getCatalog = () => get<PublicCatalog>("/public/tlds");

export const getTld = (tld: string) =>
  get<PublicTldDetail>(`/public/tlds/${encodeURIComponent(tld)}`);

export const getPricing = () => get<CreditPricing>("/credits/pricing", 3600);
export const getPromo = () => get<CreditPromo>("/credits/promo", 600);
export const getPacks = () => get<CreditPack[]>("/credits/packs", 3600);

/** "$9.37" */
export const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The renewal-trap example for the landing page: among well-compared TLDs,
 * the one where the cheapest first year hides the largest 3-year spread.
 */
export function pickRenewalTrap(catalog: PublicCatalog | null): PublicTldSummary | null {
  return renewalTrapCandidates(catalog)[0] ?? null;
}

/** TLDs worth showing as a renewal-trap example, best first. */
export function renewalTrapCandidates(catalog: PublicCatalog | null): PublicTldSummary[] {
  const candidates = (catalog?.tlds ?? []).filter(
    (t) => t.registrars >= MIN_INDEXABLE_REGISTRARS && t.cheapestRenewal > t.cheapestRegister * 1.5
  );
  const popular = ["io", "ai", "co", "app", "dev", "xyz", "com", "net", "org", "tech", "online", "store"];
  const pool = candidates.filter((t) => popular.includes(t.tld));
  const list = pool.length ? pool : candidates;
  return [...list].sort((a, b) => b.threeYearSpread - a.threeYearSpread);
}

/** Well-known TLDs for the footer and related links, in a stable order. */
export const POPULAR_TLD_ORDER = [
  "com", "net", "org", "io", "ai", "co", "app", "dev", "xyz", "me",
  "tech", "online", "store", "shop", "site", "info", "biz", "us", "uk", "co.uk",
  "ng", "com.ng", "africa", "ke", "co.za", "de", "fr", "ca", "tv", "gg",
];

/**
 * The renewal trap in one comparison: the cheapest-looking first year among
 * the other registrars vs the cheapest over 3 years (offers come sorted by it).
 */
export function renewalStory(offers: PublicOffer[]) {
  if (offers.length < 2) return null;
  const best = offers[0];
  const others = offers.slice(1).sort((a, b) => a.registerPrice - b.registerPrice);
  // A true trap: a cheaper first year that costs more over 3 years.
  const trap = others.find((o) => o.registerPrice < best.registerPrice);
  const bait = trap ?? others[0];
  const saving = bait.threeYearTotal - best.threeYearTotal;
  return saving > 0.5 ? { bait, best, saving, isTrap: Boolean(trap) } : null;
}
