import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { fxRates } from '../../database/schema';
import { errorMessage, roundMoney } from './utils/domain.util';

/** Free daily reference rates (no key). Attribution: "Rates By Exchange Rate API". */
const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_MS = 60 * 60 * 1000;

/**
 * Converts registrar prices to USD so offers in EUR, NGN, KES… can be sorted
 * and compared. Rates are refreshed by the daily price sync and read from the
 * DB (cached in memory for an hour).
 */
@Injectable()
export class FxRatesService {
  private readonly logger = new Logger(FxRatesService.name);
  private rates = new Map<string, number>([['USD', 1]]);
  private loadedAt = 0;

  constructor(private readonly db: DatabaseService) {}

  /** Fetch today's rates and store them. Failures keep the previous rates. */
  async sync(): Promise<number> {
    try {
      const { data } = await axios.get(FX_URL, { timeout: 20_000 });
      const rates = FxRatesService.parse(data);
      const rows = [...rates].map(([currency, perUsd]) => ({
        currency,
        perUsd: perUsd.toString(),
        updatedAt: new Date(),
      }));
      await this.db
        .getDb()
        .insert(fxRates)
        .values(rows)
        .onConflictDoUpdate({
          target: fxRates.currency,
          set: {
            perUsd: sql`excluded.per_usd`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      this.rates = new Map([...rates, ['USD', 1]]);
      this.loadedAt = Date.now();
      this.logger.log(`Synced ${rows.length} exchange rates`);
      return rows.length;
    } catch (error) {
      this.logger.error(`Exchange-rate sync failed: ${errorMessage(error)}`);
      return 0;
    }
  }

  static parse(data: any): Map<string, number> {
    if (
      data?.result !== 'success' ||
      data?.base_code !== 'USD' ||
      !data?.rates
    ) {
      throw new Error(`unexpected FX response: ${data?.result ?? 'no result'}`);
    }
    const out = new Map<string, number>();
    for (const [code, value] of Object.entries<unknown>(data.rates)) {
      const rate = Number(value);
      if (/^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0) {
        out.set(code, rate);
      }
    }
    return out;
  }

  private async ensureLoaded(): Promise<void> {
    if (Date.now() - this.loadedAt < CACHE_MS) return;
    try {
      const rows = await this.db.getDb().select().from(fxRates);
      if (rows.length) {
        this.rates = new Map([
          ...rows.map((r) => [r.currency, parseFloat(r.perUsd)] as const),
          ['USD', 1],
        ]);
      }
      this.loadedAt = Date.now();
    } catch (error) {
      this.logger.warn(`Could not load exchange rates: ${errorMessage(error)}`);
    }
  }

  /** A converter for the current rates; returns undefined for unknown currencies. */
  async converter(): Promise<
    (amount: number, currency: string) => number | undefined
  > {
    await this.ensureLoaded();
    const rates = this.rates;
    return (amount, currency) => {
      const rate = rates.get(currency.toUpperCase());
      return rate ? roundMoney(amount / rate) : undefined;
    };
  }
}
