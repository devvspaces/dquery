import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type {
  PriceCatalogSource,
  TldPriceQuote,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import { roundMoney } from '../utils/domain.util';
import { SettingsService } from '../../settings/settings.service';

/** OVH subsidiary → its order-site locale. */
const OVH_LOCALES: Record<string, string> = {
  IE: 'en-ie',
  GB: 'en-gb',
  FR: 'fr',
  DE: 'de',
  ES: 'es-es',
  IT: 'it',
  NL: 'nl',
  PL: 'pl',
  PT: 'pt',
};

/** OVH prices are integers in 1e-8 of the currency unit (849000000 = 8.49). */
const OVH_PRICE_UNIT = 1e8;

/**
 * OVHcloud: public order catalog, no auth.
 * `GET https://eu.api.ovh.com/1.0/order/catalog/public/domain?ovhSubsidiary=IE`
 * returns ~950 TLD plans. Prices exclude VAT and are in the subsidiary's
 * currency (IE → EUR, GB → GBP); `OVH_SUBSIDIARY` picks which one.
 */
@Injectable()
export class OvhProvider
  extends BaseRegistrarProvider
  implements PriceCatalogSource
{
  readonly id = 'ovh';
  protected readonly displayName = 'OVHcloud';
  constructor(private readonly settings: SettingsService) {
    super('OvhProvider', { requestsPerMinute: 5, maxBulkSize: 1 }, 1);
  }

  /** The order funnel's domain step, in the same OVH region we price from. */
  protected linkTemplate(): string {
    return OvhProvider.orderUrlTemplate(
      this.settings.get<string>('registrars.ovhSubsidiary'),
    );
  }

  static orderUrlTemplate(subsidiary: string): string {
    const sub = (subsidiary || 'IE').toUpperCase();
    const locale = OVH_LOCALES[sub] ?? 'en-ie';
    return `https://order.eu.ovhcloud.com/${locale}/order/webcloud/?#/webCloud/domain/select?domain={domain}`;
  }

  protected hasCredentials(): boolean {
    return true;
  }

  async fetchTldPrices(): Promise<TldPriceQuote[]> {
    const subsidiary = this.settings.get<string>('registrars.ovhSubsidiary');
    const response = await this.limiter.schedule(() =>
      axios.get('https://eu.api.ovh.com/1.0/order/catalog/public/domain', {
        params: { ovhSubsidiary: subsidiary },
        timeout: 120_000,
        maxContentLength: 100 * 1024 * 1024,
      }),
    );
    return OvhProvider.parseCatalog(response.data);
  }

  /** Exposed for unit tests. */
  static parseCatalog(data: any): TldPriceQuote[] {
    const currency = data?.locale?.currencyCode;
    if (!Array.isArray(data?.plans) || typeof currency !== 'string') {
      throw new Error(
        `OVH catalog error: ${data?.message ?? 'invalid response'}`,
      );
    }
    const quotes: TldPriceQuote[] = [];
    for (const plan of data.plans) {
      const tld = String(plan?.planCode ?? '').toLowerCase();
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(tld)) continue;
      const pricings: any[] = plan.pricings ?? [];
      const yearly = (mode: string, phase: number) =>
        pricings.find(
          (p) =>
            p.mode === mode &&
            p.phase === phase &&
            p.interval === 12 &&
            p.intervalUnit === 'month',
        )?.price as number | undefined;

      const create = yearly('create-default', 0);
      const renew = yearly('create-default', 1) ?? create;
      if (!create || !renew) continue;
      const transfer = yearly('transfer-default', 0);
      const register = roundMoney(create / OVH_PRICE_UNIT);
      const renewal = roundMoney(renew / OVH_PRICE_UNIT);
      quotes.push({
        registrar: 'ovh',
        tld,
        currency,
        registerPrice: register,
        renewalPrice: renewal,
        transferPrice: transfer
          ? roundMoney(transfer / OVH_PRICE_UNIT)
          : undefined,
        regularRegisterPrice: register < renewal ? renewal : undefined,
        isPromo: register < renewal,
        source: 'catalog-api',
      });
    }
    return quotes;
  }
}
