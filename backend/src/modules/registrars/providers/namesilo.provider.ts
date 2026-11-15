import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type {
  PriceCatalogSource,
  TldPriceQuote,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import { parsePrice } from '../utils/domain.util';

/**
 * NameSilo: `GET https://www.namesilo.com/api/getPrices?version=1&type=json&key=…`.
 * Reply code 300 is success; every other key of `reply` is a TLD with
 * `registration` / `renew` / `transfer` prices in USD.
 * NOTE: response shape taken from NameSilo's API conventions; verify against
 * a real key before relying on it (unit test fixture mirrors that shape).
 */
@Injectable()
export class NameSiloProvider
  extends BaseRegistrarProvider
  implements PriceCatalogSource
{
  readonly id = 'namesilo';
  protected readonly displayName = 'NameSilo';
  protected readonly purchaseUrlTemplate =
    'https://www.namesilo.com/domain/search-domains?query={domain}';

  constructor() {
    super('NameSiloProvider', { requestsPerMinute: 30, maxBulkSize: 200 }, 1);
  }

  protected hasCredentials(): boolean {
    return !!process.env.NAMESILO_API_KEY;
  }

  async fetchTldPrices(): Promise<TldPriceQuote[]> {
    const response = await this.limiter.schedule(() =>
      axios.get('https://www.namesilo.com/api/getPrices', {
        params: { version: 1, type: 'json', key: process.env.NAMESILO_API_KEY },
        timeout: 60_000,
      }),
    );
    return NameSiloProvider.parsePrices(response.data);
  }

  static parsePrices(data: any): TldPriceQuote[] {
    const reply = data?.reply;
    if (String(reply?.code) !== '300') {
      throw new Error(
        `NameSilo getPrices error: ${reply?.detail ?? reply?.code ?? 'invalid response'}`,
      );
    }
    const quotes: TldPriceQuote[] = [];
    for (const [key, value] of Object.entries<any>(reply)) {
      if (key === 'code' || key === 'detail' || typeof value !== 'object')
        continue;
      const register = parsePrice(value?.registration);
      if (register === undefined) continue;
      const renewal = parsePrice(value?.renew) ?? register;
      quotes.push({
        registrar: 'namesilo',
        tld: key.toLowerCase(),
        currency: 'USD',
        registerPrice: register,
        renewalPrice: renewal,
        transferPrice: parsePrice(value?.transfer),
        isPromo: register < renewal,
        source: 'catalog-api',
      });
    }
    return quotes;
  }
}
