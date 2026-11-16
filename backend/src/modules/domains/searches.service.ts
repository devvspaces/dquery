import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  creditTransactions,
  savedSearches,
  searchResults,
  type SearchResultRow,
} from '../../database/schema';
import { CreditsService } from '../credits/credits.service';
import { CreditPricingService } from '../credits/credit-pricing.service';
import { InsufficientCreditsException } from '../credits/exceptions/insufficient-credits.exception';
import { DomainCheckingProducer } from '../../queues/producers/domain-checking.producer';
import { DomainGenerationProducer } from '../../queues/producers/domain-generation.producer';
import { RegistrarsService } from '../registrars/registrars.service';
import { pickBestOffer } from '../registrars/aggregation';
import type { DomainAvailability } from '../registrars/interfaces/registrar-provider.interface';
import type { PaginatedResponse } from '../../common/dto/pagination.dto';
import { domainStatus } from './search-store';

export interface DomainPairInput {
  domain: string;
  tld: string;
}

export interface SearchSummary {
  id: string;
  kind: string;
  title: string;
  names: number;
  tlds: string[];
  checked: number;
  available: number;
  cheapest: number | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt: Date | null;
}

/** One saved domain, in the same shape the live check stream sends. */
export interface SavedDomainResult {
  domain: string;
  tld: string;
  status: string;
  results: DomainAvailability[];
  availableCount: number;
  bestPrice: number | null;
  bestRegistrar: string | null;
  checkedAt: Date;
  pricedAt: Date;
}

const CHUNK = 20;
const parseTlds = (raw: string | null): string[] => {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};
const norm = (p: DomainPairInput) => ({
  domain: p.domain.trim().toLowerCase(),
  tld: p.tld.trim().toLowerCase().replace(/^\./, ''),
});

/**
 * Saved searches: every search is stored with its results so it can be
 * reopened for free. Refreshing costs credits by the work it takes:
 * prices (catalog re-read) < availability (live registrar checks) < names.
 */
@Injectable()
export class SearchesService {
  private readonly logger = new Logger(SearchesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly credits: CreditsService,
    private readonly pricing: CreditPricingService,
    private readonly checking: DomainCheckingProducer,
    private readonly generation: DomainGenerationProducer,
    private readonly registrars: RegistrarsService,
  ) {}

  async list(
    userId: string,
    page = 1,
    limit = 20,
    q?: string,
  ): Promise<PaginatedResponse<SearchSummary>> {
    const db = this.db.getDb();
    const filter = q?.trim()
      ? and(
          eq(savedSearches.userId, userId),
          or(
            ilike(savedSearches.title, `%${q.trim()}%`),
            ilike(savedSearches.businessName, `%${q.trim()}%`),
          ),
        )
      : eq(savedSearches.userId, userId);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(savedSearches)
      .where(filter);

    const rows = await db
      .select({
        s: savedSearches,
        checked: sql<number>`(select count(*)::int from search_results r where r.search_id = "saved_searches"."id")`,
        available: sql<number>`(select count(*)::int from search_results r where r.search_id = "saved_searches"."id" and r.available)`,
        cheapest: sql<
          string | null
        >`(select min(r.best_price) from search_results r where r.search_id = "saved_searches"."id" and r.available)`,
      })
      .from(savedSearches)
      .where(filter)
      .orderBy(desc(savedSearches.pinned), desc(savedSearches.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      data: rows.map(({ s, checked, available, cheapest }) => ({
        id: s.id,
        kind: s.kind,
        title: s.title ?? s.businessName,
        names: s.names?.length ?? s.resultsCount,
        tlds: parseTlds(s.tlds),
        checked,
        available,
        cheapest: cheapest !== null ? Number(cheapest) : null,
        pinned: s.pinned,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        lastCheckedAt: s.lastCheckedAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(userId: string, id: string) {
    const search = await this.owned(userId, id);
    const rows = await this.db
      .getDb()
      .select()
      .from(searchResults)
      .where(eq(searchResults.searchId, id));
    return {
      id: search.id,
      kind: search.kind,
      title: search.title ?? search.businessName,
      businessName: search.businessName,
      description: search.description,
      input: search.input,
      names: search.names ?? [],
      techniques: search.techniques ?? {},
      tlds: parseTlds(search.tlds),
      pinned: search.pinned,
      createdAt: search.createdAt,
      updatedAt: search.updatedAt,
      lastCheckedAt: search.lastCheckedAt,
      results: rows.map(toSaved),
    };
  }

  async update(
    userId: string,
    id: string,
    patch: { title?: string; pinned?: boolean },
  ) {
    await this.owned(userId, id);
    const set: Partial<typeof savedSearches.$inferInsert> = {};
    if (patch.title !== undefined) set.title = patch.title.trim().slice(0, 255);
    if (patch.pinned !== undefined) set.pinned = patch.pinned;
    if (Object.keys(set).length === 0) return { ok: true };
    await this.db
      .getDb()
      .update(savedSearches)
      .set(set)
      .where(eq(savedSearches.id, id));
    return { ok: true };
  }

  async remove(userId: string, id: string) {
    await this.owned(userId, id);
    await this.db.getDb().delete(savedSearches).where(eq(savedSearches.id, id));
    return { ok: true };
  }

  /**
   * Re-price saved available domains from today's catalog. Charged per domain
   * actually re-priced; taken/unknown domains are free and left as they are.
   */
  async refreshPrices(
    userId: string,
    id: string,
    pairs: DomainPairInput[] | undefined,
    requestId: string,
  ) {
    await this.owned(userId, id);
    const key = `search:prices:${id}:${requestId}`;
    const rows = (await this.selectRows(id, pairs)).filter((r) => r.available);

    if (await this.alreadyCharged(key)) {
      return { creditsDeducted: 0, repriced: 0, duplicate: true, results: [] };
    }
    if (rows.length === 0) {
      return { creditsDeducted: 0, repriced: 0, duplicate: false, results: [] };
    }

    const cost = this.pricing.quotePriceRefresh(rows.length);
    await this.charge(
      userId,
      cost,
      `Price refresh: ${rows.length} saved domain${rows.length === 1 ? '' : 's'}`,
      { searchId: id, domains: rows.length },
      key,
    );

    const now = new Date();
    const db = this.db.getDb();
    const updated: SavedDomainResult[] = [];
    for (const row of rows) {
      const offers = await this.registrars.repriceOffers(
        row.domain,
        row.tld,
        row.offers as DomainAvailability[],
      );
      const best = pickBestOffer(offers);
      const [saved] = await db
        .update(searchResults)
        .set({
          offers,
          bestPrice: best?.price !== undefined ? best.price.toFixed(2) : null,
          bestRegistrar: best?.registrar ?? null,
          pricedAt: now,
        })
        .where(eq(searchResults.id, row.id))
        .returning();
      updated.push(toSaved(saved));
    }
    await db
      .update(savedSearches)
      .set({ updatedAt: now })
      .where(eq(savedSearches.id, id));
    return {
      creditsDeducted: cost,
      repriced: rows.length,
      duplicate: false,
      results: updated,
    };
  }

  /**
   * Re-check availability live (skipping the short cache) for the chosen
   * domains, or every saved/known domain of the search. Results stream in
   * via the usual batch endpoint and are stored on the search.
   */
  async refreshAvailability(
    userId: string,
    id: string,
    pairs: DomainPairInput[] | undefined,
    requestId: string,
  ) {
    const search = await this.owned(userId, id);
    const key = `search:availability:${id}:${requestId}`;
    const previous = await this.chargedMetadata(key);
    if (previous) {
      return {
        batchId: typeof previous.batchId === 'string' ? previous.batchId : '',
        creditsDeducted: 0,
        domains: Number(previous.domains ?? 0),
        duplicate: true,
      };
    }

    let targets: DomainPairInput[];
    if (pairs?.length) {
      targets = pairs.map(norm);
    } else {
      const rows = await this.selectRows(id);
      targets = rows.length
        ? rows.map((r) => ({ domain: r.domain, tld: r.tld }))
        : (search.names ?? []).flatMap((domain) =>
            parseTlds(search.tlds).map((tld) => norm({ domain, tld })),
          );
    }
    targets = dedupe(targets);
    if (targets.length === 0)
      throw new BadRequestException('Nothing to re-check in this search');
    if (targets.length > 500)
      throw new BadRequestException('At most 500 domains per re-check');

    const cost = this.pricing.quoteChecks(targets.length).total;
    const batchId = `batch-${randomUUID()}`;
    await this.charge(
      userId,
      cost,
      `Availability re-check: ${targets.length} saved domain${targets.length === 1 ? '' : 's'}`,
      { searchId: id, batchId, domains: targets.length },
      key,
    );
    await this.enqueueChecks(userId, id, targets, batchId, true);
    return {
      batchId,
      creditsDeducted: cost,
      domains: targets.length,
      duplicate: false,
    };
  }

  /** Generate more names for a saved search (never repeats its names). */
  async moreNames(userId: string, id: string, requestId: string) {
    const search = await this.owned(userId, id);
    if (search.kind !== 'generate' || !search.input)
      throw new BadRequestException(
        'Only generated searches can make more names',
      );
    const key = `search:names:${id}:${requestId}`;
    const previous = await this.chargedMetadata(key);
    if (previous) {
      return {
        jobId: typeof previous.jobId === 'string' ? previous.jobId : '',
        creditsDeducted: 0,
        duplicate: true,
      };
    }

    const input = search.input as {
      engine?: 'ai' | 'words';
      businessName?: string;
      description?: string;
      style?: 'creative' | 'professional' | 'short' | 'descriptive';
      count?: number;
      wordEngine?: Parameters<
        DomainGenerationProducer['addJob']
      >[0]['wordEngine'];
    };
    const engine = input.engine ?? 'ai';
    const cost = this.pricing.quoteGeneration(engine, 0, 0).total;
    const jobId = `gen-${randomUUID()}`;
    await this.charge(
      userId,
      cost,
      `${engine === 'words' ? 'Word engine' : 'AI'} generation: more names for "${search.title ?? search.businessName}"`,
      { searchId: id, jobId, engine },
      key,
    );

    const queued = await this.generation.addJob(
      {
        userId,
        engine,
        autoCheck: false,
        wordEngine: input.wordEngine,
        businessName: input.businessName ?? search.businessName,
        description: input.description ?? search.description ?? undefined,
        count: input.count ?? 20,
        style: input.style,
        tlds: parseTlds(search.tlds),
        creditsDeducted: cost,
        searchId: id,
        exclude: search.names ?? [],
      },
      jobId,
    );
    return { jobId: queued, creditsDeducted: cost, duplicate: false };
  }

  /**
   * The search to store a bulk check on: the user's existing search (names
   * and extensions merged in), or a new "check" search.
   */
  async attachCheck(
    userId: string,
    pairs: DomainPairInput[],
    searchId?: string,
    title?: string,
  ): Promise<string> {
    const db = this.db.getDb();
    const names = [...new Set(pairs.map((p) => norm(p).domain))];
    const tlds = [...new Set(pairs.map((p) => norm(p).tld))];
    const now = new Date();
    if (searchId) {
      const search = await this.owned(userId, searchId);
      const mergedNames = [...(search.names ?? [])];
      for (const n of names) if (!mergedNames.includes(n)) mergedNames.push(n);
      const mergedTlds = [...parseTlds(search.tlds)];
      for (const t of tlds) if (!mergedTlds.includes(t)) mergedTlds.push(t);
      await db
        .update(savedSearches)
        .set({
          names: mergedNames,
          tlds: JSON.stringify(mergedTlds),
          resultsCount: mergedNames.length,
          updatedAt: now,
        })
        .where(eq(savedSearches.id, searchId));
      return searchId;
    }
    const label =
      title?.trim().slice(0, 255) ||
      (names.length === 1 ? names[0] : `${names.length} names`);
    const [row] = await db
      .insert(savedSearches)
      .values({
        userId,
        kind: 'check',
        title: label,
        businessName: label,
        tlds: JSON.stringify(tlds),
        names,
        resultsCount: names.length,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: savedSearches.id });
    return row.id;
  }

  /** Queue checking jobs (chunks of 20) whose results are stored on the search. */
  async enqueueChecks(
    userId: string,
    searchId: string,
    pairs: DomainPairInput[],
    batchId: string,
    force = false,
  ): Promise<void> {
    for (let i = 0; i < pairs.length; i += CHUNK) {
      const batch = pairs.slice(i, i + CHUNK);
      await this.checking.addJob({
        userId,
        domains: batch,
        creditsDeducted: this.pricing.quoteChecks(batch.length).total,
        parentJobId: batchId,
        searchHistoryId: searchId,
        force,
      });
    }
  }

  private async owned(userId: string, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new NotFoundException('Search not found');
    const [search] = await this.db
      .getDb()
      .select()
      .from(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
      .limit(1);
    if (!search) throw new NotFoundException('Search not found');
    return search;
  }

  private async selectRows(
    searchId: string,
    pairs?: DomainPairInput[],
  ): Promise<SearchResultRow[]> {
    const db = this.db.getDb();
    const rows = await db
      .select()
      .from(searchResults)
      .where(eq(searchResults.searchId, searchId));
    if (!pairs?.length) return rows;
    const wanted = new Set(pairs.map(norm).map((p) => `${p.domain}.${p.tld}`));
    return rows.filter((r) => wanted.has(`${r.domain}.${r.tld}`));
  }

  /** Charge once per idempotency key; a concurrent duplicate is rejected cleanly. */
  private async charge(
    userId: string,
    amount: number,
    description: string,
    metadata: Record<string, unknown>,
    key: string,
  ): Promise<void> {
    if (amount <= 0) return;
    const balance = await this.credits.getBalance(userId);
    if (balance.balance < amount)
      throw new InsufficientCreditsException(amount, balance.balance);
    try {
      await this.credits.deductCredits(
        userId,
        amount,
        description,
        metadata,
        key,
      );
    } catch (err) {
      if (await this.alreadyCharged(key)) {
        throw new BadRequestException('This request was already processed');
      }
      throw err;
    }
  }

  private async alreadyCharged(key: string): Promise<boolean> {
    return (await this.chargedMetadata(key)) !== null;
  }

  private async chargedMetadata(
    key: string,
  ): Promise<Record<string, unknown> | null> {
    const [row] = await this.db
      .getDb()
      .select({ metadata: creditTransactions.metadata })
      .from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, key))
      .limit(1);
    if (!row) return null;
    try {
      return (
        (JSON.parse(row.metadata ?? '{}') as Record<string, unknown>) ?? {}
      );
    } catch {
      return {};
    }
  }
}

function dedupe(pairs: DomainPairInput[]): DomainPairInput[] {
  const seen = new Set<string>();
  return pairs.filter((p) => {
    const k = `${p.domain}.${p.tld}`;
    if (!p.domain || !p.tld || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function toSaved(r: SearchResultRow): SavedDomainResult {
  const offers = r.offers as DomainAvailability[];
  return {
    domain: r.domain,
    tld: r.tld,
    status: r.status || domainStatus(offers),
    results: offers,
    availableCount: offers.filter((o) => o.status === 'available').length,
    bestPrice: r.bestPrice !== null ? Number(r.bestPrice) : null,
    bestRegistrar: r.bestRegistrar,
    checkedAt: r.checkedAt,
    pricedAt: r.pricedAt,
  };
}
