import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type {
  AvailabilityChecker,
  AvailabilityResult,
  AvailabilityStatus,
  PriceCatalogSource,
  TldPriceQuote,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import { SPACESHIP_TLDS } from '../constants/tlds';
import { SPACESHIP_STATIC_PRICES } from '../constants/spaceship-static-prices';
import { parseFqdn, parsePrice, toFqdn } from '../utils/domain.util';

/**
 * Spaceship API (https://spaceship.dev/api/v1).
 *
 * Edge cases:
 * - Availability: POST /domains/available, max 20 domains, 30 requests / 30 s.
 * - Only premium names carry a price (`premiumPricing[]`). There is no
 *   price-list API, so standard prices come from a hand-maintained static list
 *   (constants/spaceship-prices.ts). Keep it current with
 *   `pnpm command prices:set --registrar spaceship ...` for overrides.
 *   (The old Puppeteer scraper was removed: it only ran on macOS, was blocked
 *   by Cloudflare Turnstile, and scraping may breach Spaceship's terms.)
 */
@Injectable()
export class SpaceshipProvider
  extends BaseRegistrarProvider
  implements AvailabilityChecker, PriceCatalogSource
{
  readonly id = 'spaceship';
  protected readonly displayName = 'Spaceship';
  protected readonly purchaseUrlTemplate =
    'https://www.spaceship.com/domain-search/?query={domain}';
  readonly providesLivePricing = false;

  private readonly client: AxiosInstance;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;

  constructor(configService: ConfigService) {
    super('SpaceshipProvider', { requestsPerMinute: 60, maxBulkSize: 20 }, 2);
    this.apiKey = configService.get<string>('SPACESHIP_API_KEY');
    this.apiSecret = configService.get<string>('SPACESHIP_API_SECRET');
    this.client = axios.create({
      baseURL:
        configService.get<string>('SPACESHIP_API_URL') ||
        'https://spaceship.dev/api/v1',
      headers: {
        'X-API-Key': this.apiKey ?? '',
        'X-API-Secret': this.apiSecret ?? '',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  protected hasCredentials(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  async getSupportedTlds(): Promise<string[]> {
    return SPACESHIP_TLDS;
  }

  async checkAvailability(
    domains: Array<{ domain: string; tld: string }>,
  ): Promise<AvailabilityResult[]> {
    if (domains.length === 0) return [];
    return this.limiter.schedule(async () => {
      try {
        const response = await this.client.post('/domains/available', {
          domains: domains.map((d) => toFqdn(d.domain, d.tld)),
        });
        if (!Array.isArray(response.data?.domains)) {
          throw new Error('Invalid response from Spaceship API');
        }
        return this.reconcile(
          domains,
          response.data.domains.map((r: any) => SpaceshipProvider.mapResult(r)),
          'Domain not returned by Spaceship',
        );
      } catch (error) {
        this.noteAuthFailure(error);
        return this.unknownResults(domains, error);
      }
    });
  }

  /** Exposed for unit tests. */
  static mapResult(r: any): AvailabilityResult {
    const { domain, tld } = parseFqdn(String(r.domain ?? ''));
    const raw = String(r.result ?? '').toLowerCase();

    let status: AvailabilityStatus;
    if (raw === 'available') status = 'available';
    else if (['taken', 'registered', 'unavailable', 'reserved'].includes(raw))
      status = 'taken';
    else if (raw.includes('unsupported') || raw.includes('not_supported'))
      status = 'unsupported';
    else status = 'unknown';

    const premiumPricing: any[] = Array.isArray(r.premiumPricing)
      ? r.premiumPricing
      : [];
    const reg = premiumPricing.find((p) => p.operation === 'register');
    const renew = premiumPricing.find((p) => p.operation === 'renew');

    return {
      domain,
      tld,
      status,
      premium: Boolean(reg),
      price: status === 'available' ? parsePrice(reg?.price) : undefined,
      renewalPrice:
        status === 'available' ? parsePrice(renew?.price) : undefined,
      currency: reg?.currency || 'USD',
      reason:
        status === 'unknown' && raw ? `spaceship_result:${raw}` : undefined,
    };
  }

  async fetchTldPrices(): Promise<TldPriceQuote[]> {
    return Object.entries(SPACESHIP_STATIC_PRICES).map(([tld, p]) => ({
      registrar: 'spaceship',
      tld,
      currency: 'USD',
      registerPrice: p.register,
      renewalPrice: p.renew,
      // A first year cheaper than renewal is a launch/promo price.
      isPromo: p.register < p.renew,
      source: 'catalog-static' as const,
    }));
  }
}
