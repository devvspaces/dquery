import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type {
  AvailabilityChecker,
  AvailabilityResult,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import { GODADDY_TLDS } from '../constants/tlds';
import { parseFqdn, roundMoney, toFqdn } from '../utils/domain.util';

/**
 * GoDaddy Domains API.
 *
 * Edge cases:
 * - Since May 2024 the availability API only works for accounts with 50+
 *   domains. Other accounts get 403 ACCESS_DENIED, and we then suspend the
 *   provider instead of failing every request.
 * - Limit of 20,000 calls/month on qualifying accounts.
 * - Prices are in micro-units (1/1,000,000 of the currency unit).
 * - The response has no renewal price and no premium flag. `definitive` only
 *   means "checked live, not from cache"; it says nothing about premium.
 * - Bulk results are not guaranteed to be in request order, and names that
 *   failed go into a separate `errors[]`. Match on the `domain` field.
 * - No price-list API, so GoDaddy prices are only known per domain (live).
 */
@Injectable()
export class GoDaddyProvider
  extends BaseRegistrarProvider
  implements AvailabilityChecker
{
  readonly id = 'godaddy';
  protected readonly displayName = 'GoDaddy';
  protected readonly purchaseUrlTemplate =
    'https://www.godaddy.com/domainsearch/find?domainToCheck={domain}';
  readonly providesLivePricing = true;

  private readonly client: AxiosInstance;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;

  constructor(configService: ConfigService) {
    super('GoDaddyProvider', { requestsPerMinute: 60, maxBulkSize: 500 }, 5);
    this.apiKey = configService.get<string>('GODADDY_API_KEY');
    this.apiSecret = configService.get<string>('GODADDY_API_SECRET');
    this.client = axios.create({
      baseURL:
        configService.get<string>('GODADDY_API_URL') ||
        'https://api.godaddy.com',
      headers: {
        Authorization: `sso-key ${this.apiKey}:${this.apiSecret}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  protected hasCredentials(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  async getSupportedTlds(): Promise<string[]> {
    return GODADDY_TLDS;
  }

  async checkAvailability(
    domains: Array<{ domain: string; tld: string }>,
  ): Promise<AvailabilityResult[]> {
    if (domains.length === 0) return [];
    return this.limiter.schedule(async () => {
      try {
        const response = await this.client.post(
          '/v1/domains/available',
          domains.map((d) => toFqdn(d.domain, d.tld)),
          { params: { checkType: 'FAST' } },
        );
        return this.reconcile(
          domains,
          GoDaddyProvider.mapBulkResponse(response.data),
          'Domain not returned by GoDaddy',
        );
      } catch (error) {
        this.noteAuthFailure(error);
        return this.unknownResults(domains, error);
      }
    });
  }

  /** Exposed for unit tests. */
  static mapBulkResponse(data: any): AvailabilityResult[] {
    const results: AvailabilityResult[] = [];

    for (const r of data?.domains ?? []) {
      const { domain, tld } = parseFqdn(String(r.domain ?? ''));
      const price =
        typeof r.price === 'number' && r.price > 0
          ? roundMoney(r.price / 1_000_000)
          : undefined;
      results.push({
        domain,
        tld,
        status: r.available === true ? 'available' : 'taken',
        price: r.available === true ? price : undefined,
        currency: r.currency || 'USD',
      });
    }

    for (const e of data?.errors ?? []) {
      const { domain, tld } = parseFqdn(String(e.domain ?? ''));
      const code = String(e.code ?? '');
      const unsupported = /UNSUPPORTED_TLD|TLD_NOT_SUPPORTED/i.test(code);
      results.push({
        domain,
        tld,
        status: unsupported ? 'unsupported' : 'unknown',
        reason: code || undefined,
        error: e.message,
      });
    }

    return results;
  }
}
