import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type {
  PriceCatalogSource,
  TldPriceQuote,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import { parsePrice } from '../utils/domain.util';

/**
 * Dynadot API3: `GET https://api.dynadot.com/api3.json?key=…&command=tld_price&currency=usd`.
 * Response: `TldPriceResponse.TldPrice[]` with `Price.Register/Renew/Transfer`
 * strings per 1 year. api3 is scheduled for retirement; this adapter is
 * isolated so moving to Dynadot's REST API only touches this file.
 * Docs: https://www.dynadot.com/domain/api-commands
 */
@Injectable()
export class DynadotProvider
  extends BaseRegistrarProvider
  implements PriceCatalogSource
{
  readonly id = 'dynadot';
  protected readonly displayName = 'Dynadot';
  protected readonly purchaseUrlTemplate =
    'https://www.dynadot.com/domain/search?domain={domain}';

  constructor() {
    super('DynadotProvider', { requestsPerMinute: 30, maxBulkSize: 1 }, 1);
  }

  protected hasCredentials(): boolean {
    return !!process.env.DYNADOT_API_KEY;
  }

  async fetchTldPrices(): Promise<TldPriceQuote[]> {
    const response = await this.limiter.schedule(() =>
      axios.get(
        process.env.DYNADOT_API_URL || 'https://api.dynadot.com/api3.json',
        {
          params: {
            key: process.env.DYNADOT_API_KEY,
            command: 'tld_price',
            currency: 'usd',
          },
          timeout: 60_000,
        },
      ),
    );
    return DynadotProvider.parsePrices(response.data);
  }

  static parsePrices(data: any): TldPriceQuote[] {
    const res = data?.TldPriceResponse;
    if (
      !res ||
      String(res.ResponseCode) !== '0' ||
      !Array.isArray(res.TldPrice)
    ) {
      throw new Error(
        `Dynadot tld_price error: ${res?.Error ?? res?.Status ?? 'invalid response'}`,
      );
    }
    const currency = String(res.Currency ?? 'USD').toUpperCase();
    const quotes: TldPriceQuote[] = [];
    for (const t of res.TldPrice) {
      const register = parsePrice(t?.Price?.Register);
      if (register === undefined) continue;
      const renewal = parsePrice(t?.Price?.Renew) ?? register;
      quotes.push({
        registrar: 'dynadot',
        tld: String(t.Tld).replace(/^\./, '').toLowerCase(),
        currency,
        registerPrice: register,
        renewalPrice: renewal,
        transferPrice: parsePrice(t?.Price?.Transfer),
        isPromo: register < renewal,
        source: 'catalog-api',
      });
    }
    return quotes;
  }
}
