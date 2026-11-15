import type { AvailabilityStatus, DomainResult } from "@/lib/types";

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
}

/** One domain's entry in a checking job result. */
export interface BackendCheckItem {
  domain: string;
  tld: string;
  results: BackendOffer[];
  bestPrice: number | null;
}

/**
 * Turn backend checking-job results into the rows the UI renders.
 *
 * Every `basename × tld` gets a placeholder row first (so the list order stays
 * stable while results stream in), then any backend results are laid over
 * their matching placeholder.
 */
export function mapBackendToFrontend(
  backendResults: BackendCheckItem[],
  basenames: string[],
  tlds: string[],
  techniques: Record<string, string> = {}
): DomainResult[] {
  const resultsMap = new Map<string, DomainResult>();

  for (const name of basenames) {
    for (const rawTld of tlds) {
      const tld = rawTld.startsWith(".") ? rawTld : `.${rawTld}`;
      const domain = `${name}${tld}`;

      resultsMap.set(domain, {
        domain,
        name,
        extension: tld,
        available: false,
        prices: [],
        bestPrice: null,
        technique: techniques[name],
      });
    }
  }

  for (const item of backendResults) {
    const rawTld = item.tld.startsWith(".") ? item.tld : `.${item.tld}`;
    const domain = `${item.domain}${rawTld}`;

    const existing = resultsMap.get(domain);
    if (!existing) continue;

    resultsMap.set(domain, {
      ...existing,
      // Only a definite "available" counts; "unknown" (a failed check) does not.
      available: item.results.some((r) => r.available),
      bestPrice: item.bestPrice,
      prices: item.results.map((r) => ({
        registrar: r.registrar,
        available: r.available,
        registerPrice: r.price ?? null,
        renewalPrice: r.renewalPrice ?? null,
        status: r.status,
        threeYearTotal: r.threeYearTotal ?? null,
        isPromo: r.isPromo,
        premium: r.premiumDomain,
      })),
    });
  }

  return Array.from(resultsMap.values());
}
