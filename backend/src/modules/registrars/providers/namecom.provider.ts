import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type {
  PriceCatalogSource,
  TldPriceQuote,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import { parsePrice } from '../utils/domain.util';

/**
 * Name.com Core API: `GET /core/v1/tldpricing` (HTTP Basic, username + token).
 * We publish `*RetailPrice` (the public site price), not the account price.
 * Docs: https://docs.name.com/api/v1/reference/tld-pricing/tld-price-list
 * Sandbox: NAMECOM_API_URL=https://api.dev.name.com and a "-test" username.
 */
@Injectable()
export class NameComProvider
  extends BaseRegistrarProvider
  implements PriceCatalogSource
{
  readonly id = 'namecom';
  protected readonly displayName = 'Name.com';
  protected readonly purchaseUrlTemplate =
    'https://www.name.com/domain/search/{domain}';

  constructor() {
    super('NameComProvider', { requestsPerMinute: 60, maxBulkSize: 50 }, 2);
  }

  protected hasCredentials(): boolean {
    return !!(process.env.NAMECOM_USERNAME && process.env.NAMECOM_API_TOKEN);
  }

  async fetchTldPrices(): Promise<TldPriceQuote[]> {
    const base = process.env.NAMECOM_API_URL || 'https://api.name.com';
    const quotes: TldPriceQuote[] = [];
    for (let page: number | null = 1; page; ) {
      const response = await this.limiter.schedule(() =>
        axios.get(`${base}/core/v1/tldpricing`, {
          params: { perPage: 1000, page, duration: 1 },
          auth: {
            username: process.env.NAMECOM_USERNAME!,
            password: process.env.NAMECOM_API_TOKEN!,
          },
          timeout: 60_000,
        }),
      );
      quotes.push(...NameComProvider.parsePricing(response.data));
      page = response.data?.nextPage ?? null;
    }
    return quotes;
  }

  static parsePricing(data: any): TldPriceQuote[] {
    if (!Array.isArray(data?.pricing))
      throw new Error('Name.com pricing: invalid response');
    const quotes: TldPriceQuote[] = [];
    for (const p of data.pricing) {
      if (p?.duration !== undefined && p.duration !== 1) continue;
      const register = parsePrice(
        p?.registrationRetailPrice ?? p?.registrationPrice,
      );
      if (register === undefined) continue;
      const renewal =
        parsePrice(p?.renewalRetailPrice ?? p?.renewalPrice) ?? register;
      const regular = parsePrice(p?.registrationOriginalPrice);
      quotes.push({
        registrar: 'namecom',
        tld: String(p.tld).toLowerCase(),
        currency: 'USD',
        registerPrice: register,
        renewalPrice: renewal,
        transferPrice: parsePrice(
          p?.transferInRetailPrice ?? p?.transferInPrice,
        ),
        regularRegisterPrice:
          regular && regular > register ? regular : undefined,
        isPromo:
          register < renewal || (regular !== undefined && register < regular),
        source: 'catalog-api',
      });
    }
    return quotes;
  }
}
