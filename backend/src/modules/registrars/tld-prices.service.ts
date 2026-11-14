import { Inject, Injectable, Logger } from '@nestjs/common';
import { inArray, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../redis/redis.service';
import { tldPrices } from '../../database/schema/domains.schema';
import {
  REGISTRAR_PROVIDERS,
  isPriceCatalogSource,
} from './interfaces/registrar-provider.interface';
import type {
  IRegistrarProvider,
  PriceSource,
  TldPriceQuote,
} from './interfaces/registrar-provider.interface';
import { errorMessage, normalizeTld, chunk } from './utils/domain.util';

export interface CatalogPrice {
  registrar: string;
  tld: string;
  registerPrice: number;
  renewalPrice: number;
  transferPrice?: number;
  regularRegisterPrice?: number;
  isPromo: boolean;
  currency: string;
  source: PriceSource;
  updatedAt: string;
  stale: boolean;
}

export interface SyncReport {
  registrar: string;
  ok: boolean;
  count: number;
  error?: string;
}

/**
 * The TLD price catalog: one standard price per registrar per TLD.
 *
 * Most searches are priced from here, so the live APIs only need to answer
 * "is it available / is it premium". Synced daily by the price-sync job.
 */
@Injectable()
export class TldPricesService {
  private readonly logger = new Logger(TldPricesService.name);
  private readonly cacheTTL = 3600;
  /** A catalog row older than this is flagged `stale` in results. */
  private readonly staleAfterMs = 48 * 60 * 60 * 1000;
  private static readonly VERSION_KEY = 'pricing:catalog:version';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    @Inject(REGISTRAR_PROVIDERS)
    private readonly providers: IRegistrarProvider[],
  ) {}

  /** Sync every price-catalog provider. One provider failing doesn't stop the others. */
  async syncAllPrices(only?: string[]): Promise<SyncReport[]> {
    const sources = this.providers
      .filter(isPriceCatalogSource)
      .filter((p) => p.isConfigured())
      .filter((p) => !only?.length || only.includes(p.id));

    const reports: SyncReport[] = [];
    for (const source of sources) {
      try {
        const quotes = await source.fetchTldPrices();
        if (quotes.length === 0) throw new Error('provider returned no prices');
        const count = await this.upsertQuotes(quotes);
        this.logger.log(
          `Synced ${count} TLD prices from ${source.getProviderName()}`,
        );
        reports.push({ registrar: source.id, ok: true, count });
      } catch (error) {
        const message = errorMessage(error);
        this.logger.error(
          `Price sync failed for ${source.getProviderName()}: ${message}`,
        );
        reports.push({
          registrar: source.id,
          ok: false,
          count: 0,
          error: message,
        });
      }
    }

    await this.bumpCacheVersion();
    return reports;
  }

  /** Upsert in batches. Rows set by hand (`source = manual`) are never overwritten. */
  async upsertQuotes(quotes: TldPriceQuote[]): Promise<number> {
    const db = this.databaseService.getDb();
    const now = new Date();
    let count = 0;

    for (const batch of chunk(quotes, 500)) {
      await db
        .insert(tldPrices)
        .values(
          batch.map((q) => ({
            registrar: q.registrar,
            tld: normalizeTld(q.tld),
            registerPrice: q.registerPrice.toFixed(2),
            renewalPrice: q.renewalPrice.toFixed(2),
            transferPrice: q.transferPrice?.toFixed(2) ?? null,
            regularRegisterPrice: q.regularRegisterPrice?.toFixed(2) ?? null,
            isPromo: q.isPromo,
            source: q.source,
            currency: q.currency,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [tldPrices.registrar, tldPrices.tld],
          set: {
            registerPrice: sql`excluded.register_price`,
            renewalPrice: sql`excluded.renewal_price`,
            transferPrice: sql`excluded.transfer_price`,
            regularRegisterPrice: sql`excluded.regular_register_price`,
            isPromo: sql`excluded.is_promo`,
            source: sql`excluded.source`,
            currency: sql`excluded.currency`,
            updatedAt: sql`excluded.updated_at`,
          },
          setWhere: ne(tldPrices.source, 'manual'),
        });
      count += batch.length;
    }
    return count;
  }

  /** Manually set a price (CLI `prices:set`). Marked `manual` so sync won't overwrite it. */
  async setTldPrice(
    registrar: string,
    tld: string,
    registerPrice: number,
    renewalPrice: number,
    currency = 'USD',
  ): Promise<void> {
    const db = this.databaseService.getDb();
    const values = {
      registrar: registrar.trim().toLowerCase(),
      tld: normalizeTld(tld),
      registerPrice: registerPrice.toFixed(2),
      renewalPrice: renewalPrice.toFixed(2),
      isPromo: registerPrice < renewalPrice,
      source: 'manual',
      currency: currency.toUpperCase(),
      updatedAt: new Date(),
    };
    await db
      .insert(tldPrices)
      .values(values)
      .onConflictDoUpdate({
        target: [tldPrices.registrar, tldPrices.tld],
        set: values,
      });
    await this.bumpCacheVersion();
  }

  async getTldPrice(
    registrar: string,
    tld: string,
  ): Promise<CatalogPrice | null> {
    const map = await this.getPricesForTlds([tld]);
    const reg = registrar.trim().toLowerCase();
    return map.get(normalizeTld(tld))?.find((p) => p.registrar === reg) ?? null;
  }

  /**
   * All registrars' catalog prices for the given TLDs, in one DB query for the
   * TLDs that are not cached yet.
   */
  async getPricesForTlds(tlds: string[]): Promise<Map<string, CatalogPrice[]>> {
    const wanted = [...new Set(tlds.map(normalizeTld).filter(Boolean))];
    const result = new Map<string, CatalogPrice[]>();
    if (wanted.length === 0) return result;

    const version = await this.getCacheVersion();
    const misses: string[] = [];

    await Promise.all(
      wanted.map(async (tld) => {
        try {
          const cached = await this.redisService.getJson<CatalogPrice[]>(
            `pricing:v${version}:tld:${tld}`,
          );
          if (cached) {
            result.set(
              tld,
              cached.map((p) => ({ ...p, stale: this.isStale(p.updatedAt) })),
            );
            return;
          }
        } catch (err) {
          this.logger.warn(
            `Redis lookup failed for TLD prices: ${errorMessage(err)}`,
          );
        }
        misses.push(tld);
      }),
    );

    if (misses.length > 0) {
      try {
        const rows = await this.databaseService
          .getDb()
          .select()
          .from(tldPrices)
          .where(inArray(tldPrices.tld, misses));

        for (const tld of misses) result.set(tld, []);
        for (const row of rows) {
          const updatedAt = row.updatedAt.toISOString();
          result.get(row.tld)?.push({
            registrar: row.registrar,
            tld: row.tld,
            registerPrice: parseFloat(row.registerPrice),
            renewalPrice: parseFloat(row.renewalPrice),
            transferPrice: row.transferPrice
              ? parseFloat(row.transferPrice)
              : undefined,
            regularRegisterPrice: row.regularRegisterPrice
              ? parseFloat(row.regularRegisterPrice)
              : undefined,
            isPromo: row.isPromo,
            currency: row.currency,
            source: row.source as PriceSource,
            updatedAt,
            stale: this.isStale(updatedAt),
          });
        }

        await Promise.all(
          misses.map((tld) =>
            this.redisService
              .setJson(
                `pricing:v${version}:tld:${tld}`,
                result.get(tld),
                this.cacheTTL,
              )
              .catch(() => undefined),
          ),
        );
      } catch (dbError) {
        this.logger.error(
          `Database TLD price lookup failed: ${errorMessage(dbError)}`,
        );
      }
    }

    return result;
  }

  private isStale(updatedAt: string): boolean {
    return Date.now() - new Date(updatedAt).getTime() > this.staleAfterMs;
  }

  private async getCacheVersion(): Promise<string> {
    try {
      return (await this.redisService.get(TldPricesService.VERSION_KEY)) ?? '0';
    } catch {
      return '0';
    }
  }

  /** Changing the version makes every cached price key miss, without a key scan. */
  private async bumpCacheVersion(): Promise<void> {
    try {
      await this.redisService.increment(TldPricesService.VERSION_KEY);
    } catch (err) {
      this.logger.warn(
        `Could not bump pricing cache version: ${errorMessage(err)}`,
      );
    }
  }
}
