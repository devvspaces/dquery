import type { AvailabilityStatus, DomainResult, RegistrarPrice } from "@/lib/types";

/** One registrar offer as returned by the backend checking job. */
export interface BackendOffer {
  registrar: string;
  available: boolean;
  status?: AvailabilityStatus;
  price?: number | null;
  renewalPrice?: number | null;
  threeYearTotal?: number | null;
  isPromo?: boolean;
  premiumDomain?: boolean;
  originalCurrency?: string;
  originalPrice?: number;
  purchaseUrl?: string;
  /** "registry": availability came from the public RDAP lookup, not a registrar. */
  availabilitySource?: "registry";
}

/** One domain's entry in a checking job result (live stream or saved search). */
export interface BackendCheckItem {
  domain: string;
  tld: string;
  results: BackendOffer[];
  bestPrice: number | null;
  status?: string;
  checkedAt?: string;
  pricedAt?: string;
}

const dotted = (tld: string) => (tld.startsWith(".") ? tld : `.${tld}`);

/** Registry-level status from the offers: any "available" wins, then "taken". */
export function statusOf(offers: BackendOffer[]): AvailabilityStatus {
  if (offers.some((o) => o.available || o.status === "available")) return "available";
  if (offers.some((o) => o.status === "taken" || (o.status === undefined && !o.available))) return "taken";
  if (offers.length && offers.every((o) => o.status === "unsupported")) return "unsupported";
  return "unknown";
}

function toPrices(offers: BackendOffer[]): RegistrarPrice[] {
  return offers
    .map((r) => ({
      registrar: r.registrar,
      available: r.available,
      registerPrice: r.price ?? null,
      renewalPrice: r.renewalPrice ?? null,
      status: r.status,
      threeYearTotal: r.threeYearTotal ?? null,
      isPromo: r.isPromo,
      premium: r.premiumDomain,
      originalCurrency: r.originalCurrency,
      originalPrice: r.originalPrice,
      purchaseUrl: r.purchaseUrl,
    }))
    .sort((a, b) => (a.registerPrice ?? Infinity) - (b.registerPrice ?? Infinity));
}

/** A placeholder row for a domain that hasn't been checked yet. */
export function pendingRow(name: string, tld: string, technique?: string): DomainResult {
  const extension = dotted(tld);
  return {
    domain: `${name}${extension}`,
    name,
    extension,
    available: false,
    status: "pending",
    prices: [],
    bestPrice: null,
    technique,
  };
}

/** Fill a row from a checked item. */
export function checkedRow(item: BackendCheckItem, technique?: string): DomainResult {
  const extension = dotted(item.tld);
  const status = statusOf(item.results);
  return {
    domain: `${item.domain}${extension}`,
    name: item.domain,
    extension,
    available: status === "available",
    status,
    prices: toPrices(item.results),
    bestPrice: status === "available" ? item.bestPrice : null,
    technique,
    checkedAt: item.checkedAt,
    pricedAt: item.pricedAt,
    viaRegistry: item.results.some((r) => r.availabilitySource === "registry") || undefined,
  };
}

/**
 * Lay checked items over existing rows (matched by domain), keeping row
 * order stable; items for unknown domains are appended.
 */
export function mergeResults(
  rows: DomainResult[],
  items: BackendCheckItem[],
  techniques: Record<string, string> = {}
): DomainResult[] {
  if (items.length === 0) return rows;
  const byDomain = new Map(items.map((i) => [`${i.domain}${dotted(i.tld)}`, i]));
  const next = rows.map((row) => {
    const item = byDomain.get(row.domain);
    if (!item) return row;
    byDomain.delete(row.domain);
    return checkedRow(item, row.technique ?? techniques[item.domain]);
  });
  for (const item of byDomain.values()) next.push(checkedRow(item, techniques[item.domain]));
  return next;
}

/** Add pending rows for these pairs (existing rows are reset to pending). */
export function markPending(
  rows: DomainResult[],
  pairs: Array<{ domain: string; tld: string }>,
  techniques: Record<string, string> = {}
): DomainResult[] {
  const wanted = new Map(pairs.map((p) => [`${p.domain}${dotted(p.tld)}`, p]));
  const next = rows.map((row) => {
    if (!wanted.has(row.domain)) return row;
    wanted.delete(row.domain);
    return { ...pendingRow(row.name, row.extension, row.technique), checkedAt: row.checkedAt };
  });
  for (const p of wanted.values()) next.push(pendingRow(p.domain, p.tld, techniques[p.domain]));
  return next;
}

/**
 * Rows for `basenames × tlds` with any backend results laid over them
 * (kept for callers that build a full grid at once).
 */
export function mapBackendToFrontend(
  backendResults: BackendCheckItem[],
  basenames: string[],
  tlds: string[],
  techniques: Record<string, string> = {}
): DomainResult[] {
  const rows = basenames.flatMap((name) => tlds.map((t) => pendingRow(name, t, techniques[name])));
  return mergeResults(rows, backendResults, techniques).filter((r) =>
    basenames.includes(r.name) && tlds.map(dotted).includes(r.extension)
  );
}
