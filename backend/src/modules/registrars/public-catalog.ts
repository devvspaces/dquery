import type { CatalogPrice } from './tld-prices.service';
import { multiYearTotal, roundMoney } from './utils/domain.util';
import {
  categorizeTld,
  POPULAR_ORDER,
  type TldCategory,
} from './tld-categories';

/**
 * Pure shaping of the price catalog for the public (SEO) price pages.
 * Only USD prices are shown, so every row on a page compares like for like.
 */

export interface PublicOffer {
  registrarId: string;
  registrar: string;
  registerPrice: number;
  renewalPrice: number;
  transferPrice: number | null;
  threeYearTotal: number;
  isPromo: boolean;
  /** The registrar's own currency and price when we converted to USD. */
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
  /** Most expensive 3-year total minus the cheapest: what shopping around saves. */
  threeYearSpread: number;
  updatedAt: string;
}

export interface PublicCatalog {
  stats: { prices: number; tlds: number; registrars: number };
  tlds: PublicTldSummary[];
}

export function toPublicOffers(
  prices: CatalogPrice[],
  enabled: Set<string>,
  displayName: (id: string) => string,
): PublicOffer[] {
  return prices
    .filter((p) => p.currency === 'USD' && enabled.has(p.registrar))
    .map((p) => ({
      registrarId: p.registrar,
      registrar: displayName(p.registrar),
      registerPrice: roundMoney(p.registerPrice),
      renewalPrice: roundMoney(p.renewalPrice),
      transferPrice:
        p.transferPrice !== undefined ? roundMoney(p.transferPrice) : null,
      threeYearTotal: multiYearTotal(p.registerPrice, p.renewalPrice, 3),
      isPromo: p.isPromo,
      originalCurrency: p.originalCurrency ?? null,
      originalPrice: p.originalRegisterPrice ?? null,
      updatedAt: p.updatedAt,
    }))
    .sort(
      (a, b) =>
        a.threeYearTotal - b.threeYearTotal ||
        a.registerPrice - b.registerPrice,
    );
}

const latest = (offers: PublicOffer[]) =>
  offers.reduce<string | null>(
    (max, o) => (max === null || o.updatedAt > max ? o.updatedAt : max),
    null,
  );

export function toPublicDetail(
  tld: string,
  prices: CatalogPrice[],
  enabled: Set<string>,
  displayName: (id: string) => string,
): PublicTldDetail {
  const offers = toPublicOffers(prices, enabled, displayName);
  return { tld, offers, updatedAt: latest(offers) };
}

export function toPublicCatalog(
  all: Map<string, CatalogPrice[]>,
  enabled: Set<string>,
  displayName: (id: string) => string,
): PublicCatalog {
  const tlds: PublicTldSummary[] = [];
  const registrars = new Set<string>();
  let prices = 0;
  for (const [tld, rows] of all) {
    const offers = toPublicOffers(rows, enabled, displayName);
    if (offers.length === 0) continue;
    prices += offers.length;
    offers.forEach((o) => registrars.add(o.registrarId));
    const totals = offers.map((o) => o.threeYearTotal);
    tlds.push({
      tld,
      registrars: offers.length,
      cheapestRegister: Math.min(...offers.map((o) => o.registerPrice)),
      cheapestRenewal: Math.min(...offers.map((o) => o.renewalPrice)),
      cheapestThreeYear: Math.min(...totals),
      threeYearSpread: roundMoney(Math.max(...totals) - Math.min(...totals)),
      updatedAt: latest(offers) ?? new Date(0).toISOString(),
    });
  }
  // Most-compared TLDs first, then alphabetical.
  tlds.sort(
    (a, b) => b.registrars - a.registrars || a.tld.localeCompare(b.tld),
  );
  return {
    stats: { prices, tlds: tlds.length, registrars: registrars.size },
    tlds,
  };
}

/** One extension in the picker: cheapest first-year price and how many registrars price it. */
export interface TldIndexEntry {
  tld: string;
  from: number;
  registrars: number;
  category: TldCategory;
  /** We can check availability live (otherwise prices only). */
  checkable: boolean;
}

/** Every priced extension, popular ones first, then most-compared, then A–Z. */
export function toTldIndex(
  catalog: PublicCatalog,
  checkable: Set<string>,
): {
  count: number;
  checkable: number;
  tlds: TldIndexEntry[];
} {
  const rank = (t: string) => {
    const i = POPULAR_ORDER.indexOf(t);
    return i === -1 ? POPULAR_ORDER.length : i;
  };
  const tlds = catalog.tlds
    .map((t) => ({
      tld: t.tld,
      from: t.cheapestRegister,
      registrars: t.registrars,
      category: categorizeTld(t.tld),
      checkable: checkable.has(t.tld),
    }))
    .sort(
      (a, b) =>
        rank(a.tld) - rank(b.tld) ||
        b.registrars - a.registrars ||
        a.tld.localeCompare(b.tld),
    );
  return {
    count: tlds.length,
    checkable: tlds.filter((t) => t.checkable).length,
    tlds,
  };
}
