import type {
  AvailabilityResult,
  AvailabilityStatus,
  DomainAvailability,
} from './interfaces/registrar-provider.interface';
import type { CatalogPrice } from './tld-prices.service';
import { multiYearTotal, roundMoney } from './utils/domain.util';

/**
 * Pure aggregation logic (no I/O), kept separate so it can be unit-tested.
 */

/**
 * Combine what each checker said about one domain into one registry-level status.
 * - Any definite answer (available / taken) wins over unknown/unsupported.
 * - If checkers disagree, "taken" wins: offering a name that is gone is worse
 *   than hiding one that might be free.
 * - Only when every checker said "unsupported" is the domain unsupported.
 */
export function resolveStatus(
  results: AvailabilityResult[],
): AvailabilityStatus {
  if (results.some((r) => r.status === 'taken')) return 'taken';
  if (results.some((r) => r.status === 'available')) return 'available';
  if (results.length > 0 && results.every((r) => r.status === 'unsupported'))
    return 'unsupported';
  return 'unknown';
}

/** Live-result key for the RDAP registry lookup (not a registrar, never an offer). */
export const REGISTRY_ID = 'rdap';

export interface BuildOffersInput {
  domain: string;
  tld: string;
  /** Live results for this domain keyed by registrar id. */
  live: Map<string, AvailabilityResult>;
  /** Catalog prices for this TLD. */
  catalog: CatalogPrice[];
  /** Registrar ids the user has enabled. */
  enabled: Set<string>;
  displayName: (registrarId: string) => string;
  /** Where to buy at a registrar; only attached to available offers. */
  purchaseUrl?: (registrarId: string) => string | undefined;
  checkedAt?: Date;
}

/**
 * One offer per registrar for a single domain.
 *
 * Rules:
 * - Normal names: price from the registrar's live quote if it gave one
 *   (Cloudflare, GoDaddy), otherwise from the catalog, plus any one-off fee
 *   (Namecheap EAP).
 * - Premium names: catalog prices do NOT apply. Only live premium quotes are
 *   shown; registrars without one get no price.
 * - A registrar that said "unsupported" for this TLD is left out.
 */
export function buildOffers(input: BuildOffersInput): DomainAvailability[] {
  const { domain, tld, live, catalog, enabled, displayName, purchaseUrl } =
    input;
  const checkedAt = input.checkedAt ?? new Date();
  const liveResults = [...live.values()];
  const status = resolveStatus(liveResults);
  const premium = liveResults.some((r) => r.premium === true);
  const definite = [...live].filter(
    ([, r]) => r.status === 'available' || r.status === 'taken',
  );
  const viaRegistry =
    definite.length > 0 && definite.every(([id]) => id === REGISTRY_ID);

  const catalogByRegistrar = new Map(catalog.map((c) => [c.registrar, c]));
  const registrars = new Set<string>();
  for (const c of catalog) registrars.add(c.registrar);
  for (const [id, r] of live)
    if (r.status !== 'unsupported') registrars.add(id);

  const offers: DomainAvailability[] = [];

  for (const registrarId of registrars) {
    if (!enabled.has(registrarId)) continue;
    const liveResult = live.get(registrarId);
    if (liveResult?.status === 'unsupported') continue;

    const base: DomainAvailability = {
      domain,
      tld,
      status,
      available: status === 'available',
      registrar: displayName(registrarId),
      premiumDomain: premium,
      checkedAt,
      ...(viaRegistry && { availabilitySource: 'registry' as const }),
    };

    if (status !== 'available') {
      base.error = status === 'unknown' ? liveResult?.error : undefined;
      base.reason = liveResult?.reason;
      offers.push(base);
      continue;
    }

    const cat = catalogByRegistrar.get(registrarId);
    const offer: DomainAvailability = {
      ...base,
      reason: liveResult?.reason,
      purchaseUrl: purchaseUrl?.(registrarId),
    };

    if (liveResult?.price !== undefined) {
      offer.price = liveResult.price;
      offer.renewalPrice =
        liveResult.renewalPrice ?? (premium ? undefined : cat?.renewalPrice);
      offer.currency = liveResult.currency ?? cat?.currency ?? 'USD';
      offer.priceSource = 'live';
    } else if (!premium && cat) {
      offer.price = roundMoney(cat.registerPrice + (liveResult?.extraFee ?? 0));
      offer.renewalPrice = cat.renewalPrice;
      offer.transferPrice = cat.transferPrice;
      offer.isPromo = cat.isPromo;
      offer.currency = cat.currency;
      offer.priceSource = cat.source;
      offer.stale = cat.stale;
      if (cat.originalCurrency && cat.originalRegisterPrice !== undefined) {
        offer.originalCurrency = cat.originalCurrency;
        offer.originalPrice = cat.originalRegisterPrice;
      }
    } else if (premium) {
      offer.reason = offer.reason ?? 'premium_price_unavailable';
    }

    if (offer.price !== undefined && offer.renewalPrice !== undefined) {
      offer.threeYearTotal = multiYearTotal(offer.price, offer.renewalPrice, 3);
    }
    offers.push(offer);
  }

  return sortOffers(offers);
}

/** Priced offers first, cheapest first-year price first, then cheapest 3-year total. */
export function sortOffers(offers: DomainAvailability[]): DomainAvailability[] {
  return [...offers].sort((a, b) => {
    const ap = a.price ?? Infinity;
    const bp = b.price ?? Infinity;
    if (ap !== bp) return ap - bp;
    return (a.threeYearTotal ?? Infinity) - (b.threeYearTotal ?? Infinity);
  });
}

/**
 * Cheapest purchasable offer. Prices are only compared within one currency
 * (USD preferred) because there is no FX conversion yet.
 */
export function pickBestOffer(
  offers: DomainAvailability[],
  preferredCurrency = 'USD',
): DomainAvailability | null {
  const priced = offers.filter(
    (o) =>
      o.status === 'available' &&
      o.price !== undefined &&
      o.reason !== 'premium_not_supported_via_api',
  );
  if (priced.length === 0) return null;
  const inPreferred = priced.filter(
    (o) => (o.currency ?? 'USD') === preferredCurrency,
  );
  const pool = inPreferred.length > 0 ? inPreferred : priced;
  return sortOffers(pool)[0];
}
