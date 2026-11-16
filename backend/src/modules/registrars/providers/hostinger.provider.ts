import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type {
  PriceCatalogSource,
  TldPriceQuote,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import { roundMoney } from '../utils/domain.util';

/**
 * Hostinger: `GET https://developers.hostinger.com/api/billing/v1/catalog?category=DOMAIN`
 * (Bearer token from hPanel). Each item has `prices[]` in cents with
 * `first_period_price` (the promo) and `price` (renewal) per `period`/`period_unit`.
 * We take the 1-year price. Item names look like ".COM".
 * Spec: https://developers.hostinger.com/openapi/openapi.json
 */
@Injectable()
export class HostingerProvider
  extends BaseRegistrarProvider
  implements PriceCatalogSource
{
  readonly id = 'hostinger';
  protected readonly displayName = 'Hostinger';
  protected readonly purchaseUrlTemplate =
    'https://www.hostinger.com/domain-name-search?domain={domain}';

  constructor() {
    super('HostingerProvider', { requestsPerMinute: 10, maxBulkSize: 1 }, 1);
  }

  protected hasCredentials(): boolean {
    return !!process.env.HOSTINGER_API_TOKEN;
  }

  async fetchTldPrices(): Promise<TldPriceQuote[]> {
    const response = await this.limiter.schedule(() =>
      axios.get('https://developers.hostinger.com/api/billing/v1/catalog', {
        params: { category: 'DOMAIN' },
        headers: { Authorization: `Bearer ${process.env.HOSTINGER_API_TOKEN}` },
        timeout: 60_000,
      }),
    );
    return HostingerProvider.parseCatalog(response.data);
  }

  static parseCatalog(data: any): TldPriceQuote[] {
    if (!Array.isArray(data))
      throw new Error('Hostinger catalog: invalid response');
    const quotes: TldPriceQuote[] = [];
    for (const item of data) {
      const tld = String(item?.name ?? '')
        .trim()
        .replace(/^\./, '')
        .toLowerCase();
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(tld)) continue;
      const yearly = (item.prices ?? []).find(
        (p: any) =>
          (p.period === 1 && p.period_unit === 'year') ||
          (p.period === 12 && p.period_unit === 'month'),
      );
      if (!yearly || !Number.isFinite(yearly.price)) continue;
      const renewal = roundMoney(yearly.price / 100);
      const register = Number.isFinite(yearly.first_period_price)
        ? roundMoney(yearly.first_period_price / 100)
        : renewal;
      quotes.push({
        registrar: 'hostinger',
        tld,
        currency: String(yearly.currency ?? 'USD').toUpperCase(),
        registerPrice: register,
        renewalPrice: renewal,
        regularRegisterPrice: register < renewal ? renewal : undefined,
        isPromo: register < renewal,
        source: 'catalog-api',
      });
    }
    return quotes;
  }
}
