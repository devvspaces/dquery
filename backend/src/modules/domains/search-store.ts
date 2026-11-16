import { and, eq, sql } from 'drizzle-orm';
import type { DatabaseService } from '../../database/database.service';
import { savedSearches, searchResults } from '../../database/schema';
import type { DomainAvailability } from '../registrars/interfaces/registrar-provider.interface';

type Db = ReturnType<DatabaseService['getDb']>;

/** One checked domain as the checker reports it (and as the client streams it). */
export interface StoredDomainResult {
  domain: string;
  tld: string;
  results: DomainAvailability[];
  availableCount: number;
  bestPrice: number | null;
  bestRegistrar: string | null;
  checkedAt: Date | string;
}

/** Registry-level status of one domain from its offers. */
export function domainStatus(offers: DomainAvailability[]): string {
  if (offers.some((o) => o.status === 'available')) return 'available';
  if (offers.some((o) => o.status === 'taken')) return 'taken';
  if (offers.length && offers.every((o) => o.status === 'unsupported'))
    return 'unsupported';
  return 'unknown';
}

/**
 * Save checked domains on a search (latest result wins) and bump its
 * timestamps. Used by the checking worker; never throws into the caller's
 * success path — the caller logs failures.
 */
export async function saveSearchResults(
  db: Db,
  searchId: string,
  rows: StoredDomainResult[],
  now = new Date(),
): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(searchResults)
    .values(
      rows.map((r) => {
        const status = domainStatus(r.results);
        return {
          searchId,
          domain: r.domain.toLowerCase(),
          tld: r.tld.toLowerCase().replace(/^\./, ''),
          status,
          available: status === 'available',
          offers: r.results,
          bestPrice: r.bestPrice !== null ? r.bestPrice.toFixed(2) : null,
          bestRegistrar: r.bestRegistrar,
          checkedAt: now,
          pricedAt: now,
        };
      }),
    )
    .onConflictDoUpdate({
      target: [searchResults.searchId, searchResults.domain, searchResults.tld],
      set: {
        status: sql`excluded.status`,
        available: sql`excluded.available`,
        offers: sql`excluded.offers`,
        bestPrice: sql`excluded.best_price`,
        bestRegistrar: sql`excluded.best_registrar`,
        checkedAt: sql`excluded.checked_at`,
        pricedAt: sql`excluded.priced_at`,
      },
    });
  await db
    .update(savedSearches)
    .set({ lastCheckedAt: now, updatedAt: now })
    .where(eq(savedSearches.id, searchId));
}

/** True when the search exists and belongs to the user. */
export async function ownsSearch(
  db: Db,
  searchId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: savedSearches.id })
    .from(savedSearches)
    .where(
      and(eq(savedSearches.id, searchId), eq(savedSearches.userId, userId)),
    )
    .limit(1);
  return !!row;
}
