import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type {
  PriceCatalogSource,
  TldPriceQuote,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import { parsePrice } from '../utils/domain.util';

/**
 * Porkbun: price catalog only.
 *
 * `GET https://api.porkbun.com/api/json/v3/pricing/get` is public (no API key)
 * and returns registration / renewal / transfer prices in USD for every TLD
 * Porkbun sells. This is the smallest possible provider and a good template:
 * a registrar that only adds price points needs nothing more than this.
 */
@Injectable()
export class PorkbunProvider
  extends BaseRegistrarProvider
  implements PriceCatalogSource
{
  readonly id = 'porkbun';
  protected readonly displayName = 'Porkbun';
  protected readonly purchaseUrlTemplate =
    'https://porkbun.com/checkout/search?q={domain}';

  constructor() {
    super('PorkbunProvider', { requestsPerMinute: 10, maxBulkSize: 1 }, 1);
  }

  protected hasCredentials(): boolean {
    return true;
  }

  async fetchTldPrices(): Promise<TldPriceQuote[]> {
    const response = await this.limiter.schedule(() =>
      axios.get('https://api.porkbun.com/api/json/v3/pricing/get', {
        timeout: 30000,
      }),
    );
    return PorkbunProvider.parsePricing(response.data);
  }

  /** Exposed for unit tests. */
  static parsePricing(data: any): TldPriceQuote[] {
    if (data?.status !== 'SUCCESS' || typeof data?.pricing !== 'object') {
      throw new Error(
        `Porkbun pricing error: ${data?.message ?? data?.status ?? 'invalid response'}`,
      );
    }
    const quotes: TldPriceQuote[] = [];
    for (const [tld, p] of Object.entries<any>(data.pricing)) {
      const register = parsePrice(p?.registration);
      if (register === undefined) continue;
      const renewal = parsePrice(p?.renewal) ?? register;
      quotes.push({
        registrar: 'porkbun',
        tld: tld.toLowerCase(),
        currency: 'USD',
        registerPrice: register,
        renewalPrice: renewal,
        transferPrice: parsePrice(p?.transfer),
        isPromo: register < renewal,
        source: 'catalog-api',
      });
    }
    return quotes;
  }
}
