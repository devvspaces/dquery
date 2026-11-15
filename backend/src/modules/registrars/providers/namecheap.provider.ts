import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { parseStringPromise } from 'xml2js';
import type {
  AvailabilityChecker,
  AvailabilityResult,
  PriceCatalogSource,
  TldPriceQuote,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import {
  parseFqdn,
  parsePrice,
  roundMoney,
  toFqdn,
} from '../utils/domain.util';

const asArray = <T>(v: T | T[] | undefined | null): T[] =>
  v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];

/**
 * Namecheap XML API.
 *
 * Edge cases:
 * - The API only works from a whitelisted client IP, and the account needs
 *   $50+ balance or 20+ domains before API access is enabled.
 * - `domains.check` returns PremiumRegistrationPrice="0" for normal names.
 *   That is NOT a $0 price: standard pricing comes from `users.getPricing`.
 * - `EapFee` > 0 means the TLD is in its Early Access launch phase and the fee
 *   is added to the normal price.
 * - `users.getPricing` lists a price per duration (1..10 years). Prices are per
 *   year, and the ICANN fee is a separate `AdditionalCost`.
 * - A TLD the API cannot sell makes the whole request fail, so callers only
 *   send TLDs that appear in Namecheap's price catalog.
 */
@Injectable()
export class NamecheapProvider
  extends BaseRegistrarProvider
  implements AvailabilityChecker, PriceCatalogSource
{
  readonly id = 'namecheap';
  protected readonly displayName = 'Namecheap';
  protected readonly purchaseUrlTemplate =
    'https://www.namecheap.com/domains/registration/results/?domain={domain}';
  readonly providesLivePricing = false;

  private readonly client: AxiosInstance;
  private readonly apiUser?: string;
  private readonly apiKey?: string;
  private readonly username?: string;
  private readonly clientIp: string;

  constructor(configService: ConfigService) {
    // Namecheap limits: 20/min, 700/hour, 8000/day.
    super('NamecheapProvider', { requestsPerMinute: 20, maxBulkSize: 50 }, 2);
    this.apiUser = configService.get<string>('NAMECHEAP_API_USER');
    this.apiKey = configService.get<string>('NAMECHEAP_API_KEY');
    this.username =
      configService.get<string>('NAMECHEAP_USERNAME') || this.apiUser;
    this.clientIp =
      configService.get<string>('NAMECHEAP_CLIENT_IP') || '127.0.0.1';
    this.client = axios.create({
      baseURL:
        configService.get<string>('NAMECHEAP_API_URL') ||
        'https://api.namecheap.com/xml.response',
      timeout: 20000,
    });
  }

  protected hasCredentials(): boolean {
    return Boolean(this.apiUser && this.apiKey && this.username);
  }

  private async call(
    command: string,
    params: Record<string, string> = {},
  ): Promise<any> {
    const response = await this.client.get('', {
      params: {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.username,
        ClientIp: this.clientIp,
        Command: command,
        ...params,
      },
    });
    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
      mergeAttrs: true,
    });
    const api = parsed?.ApiResponse;
    if (!api || api.Status !== 'OK') {
      const errors = asArray(api?.Errors?.Error).map((e: any) =>
        typeof e === 'string' ? e : `${e.Number ?? ''} ${e._ ?? ''}`.trim(),
      );
      throw new Error(
        `Namecheap ${command} error: ${errors.join('; ') || 'unknown'}`,
      );
    }
    return api.CommandResponse;
  }

  async checkAvailability(
    domains: Array<{ domain: string; tld: string }>,
  ): Promise<AvailabilityResult[]> {
    if (domains.length === 0) return [];
    return this.limiter.schedule(async () => {
      try {
        const commandResponse = await this.call('namecheap.domains.check', {
          DomainList: domains.map((d) => toFqdn(d.domain, d.tld)).join(','),
        });
        const results = asArray(commandResponse?.DomainCheckResult).map(
          (r: any) => NamecheapProvider.mapCheckResult(r),
        );
        return this.reconcile(
          domains,
          results,
          'Domain not returned by Namecheap',
        );
      } catch (error) {
        this.noteAuthFailure(error);
        return this.unknownResults(domains, error);
      }
    });
  }

  /** Exposed for unit tests. */
  static mapCheckResult(r: any): AvailabilityResult {
    const { domain, tld } = parseFqdn(String(r.Domain ?? ''));
    if (r.ErrorNo && r.ErrorNo !== '0') {
      return {
        domain,
        tld,
        status: 'unknown',
        error: `Namecheap error ${r.ErrorNo}: ${r.Description ?? ''}`.trim(),
      };
    }

    const available = String(r.Available).toLowerCase() === 'true';
    const isPremium = String(r.IsPremiumName).toLowerCase() === 'true';
    const eapFee = parsePrice(r.EapFee);

    const result: AvailabilityResult = {
      domain,
      tld,
      status: available ? 'available' : 'taken',
      premium: isPremium,
      currency: 'USD',
    };

    // Only premium names carry a live price. For everything else the "0" is a
    // placeholder and the standard catalog price applies.
    if (isPremium) {
      const icann = parsePrice(r.IcannFee) ?? 0;
      const reg = parsePrice(r.PremiumRegistrationPrice);
      const renew = parsePrice(r.PremiumRenewalPrice);
      if (reg !== undefined && reg > 0) result.price = roundMoney(reg + icann);
      if (renew !== undefined && renew > 0)
        result.renewalPrice = roundMoney(renew + icann);
    }

    if (eapFee !== undefined && eapFee > 0) {
      result.extraFee = eapFee;
      result.reason = 'early_access_fee';
    }
    return result;
  }

  async fetchTldPrices(): Promise<TldPriceQuote[]> {
    const commandResponse = await this.limiter.schedule(() =>
      this.call('namecheap.users.getPricing', { ProductType: 'DOMAIN' }),
    );
    return NamecheapProvider.parsePricing(commandResponse);
  }

  /** Exposed for unit tests. */
  static parsePricing(commandResponse: any): TldPriceQuote[] {
    const productType = commandResponse?.UserGetPricingResult?.ProductType;
    const categories = asArray(productType?.ProductCategory);

    // tld -> category -> price info for a 1-year term
    const byTld = new Map<
      string,
      Record<string, { total: number; regular?: number; currency: string }>
    >();

    for (const category of categories) {
      const categoryName = String(category.Name ?? '').toLowerCase();
      if (!['register', 'renew', 'transfer'].includes(categoryName)) continue;

      for (const product of asArray(category.Product)) {
        const tld = String(product.Name ?? '').toLowerCase();
        if (!tld) continue;

        const oneYear = asArray(product.Price).find(
          (p: any) =>
            String(p.Duration) === '1' &&
            String(p.DurationType ?? 'YEAR').toUpperCase() === 'YEAR',
        );
        if (!oneYear) continue;

        const yourPrice =
          parsePrice(oneYear.YourPrice) ?? parsePrice(oneYear.Price);
        if (yourPrice === undefined) continue;
        // Note: Namecheap spells it "YourAdditonalCost" in the API.
        const additional =
          parsePrice(oneYear.YourAdditonalCost) ??
          parsePrice(oneYear.YourAdditionalCost) ??
          parsePrice(oneYear.AdditionalCost) ??
          0;
        const regular = parsePrice(oneYear.RegularPrice);
        const regularAdditional =
          parsePrice(oneYear.RegularAdditionalCost) ?? additional;

        const entry = byTld.get(tld) ?? {};
        entry[categoryName] = {
          total: roundMoney(yourPrice + additional),
          regular:
            regular !== undefined
              ? roundMoney(regular + regularAdditional)
              : undefined,
          currency: String(oneYear.Currency || 'USD'),
        };
        byTld.set(tld, entry);
      }
    }

    const quotes: TldPriceQuote[] = [];
    for (const [tld, cats] of byTld) {
      const register = cats.register;
      if (!register) continue;
      const renew = cats.renew?.total ?? register.regular ?? register.total;
      const isPromo =
        register.regular !== undefined && register.total < register.regular;
      quotes.push({
        registrar: 'namecheap',
        tld,
        currency: register.currency,
        registerPrice: register.total,
        renewalPrice: renew,
        transferPrice: cats.transfer?.total,
        regularRegisterPrice: isPromo ? register.regular : undefined,
        isPromo,
        source: 'catalog-api',
      });
    }
    return quotes;
  }
}
