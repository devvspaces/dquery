import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type {
  AvailabilityChecker,
  AvailabilityResult,
  AvailabilityStatus,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import { CLOUDFLARE_TLDS } from '../constants/tlds';
import { parseFqdn, parsePrice, toFqdn } from '../utils/domain.util';

/**
 * Cloudflare Registrar API (beta): POST /accounts/{id}/registrar/domain-check.
 *
 * Edge cases:
 * - Max 20 domains per request; only a subset of TLDs is supported.
 * - Every result has `pricing` (Cloudflare sells at cost), but there is no
 *   price-list endpoint, so prices are fetched live per domain.
 * - Names that can't be registered come with a `reason`:
 *     domain_unavailable                -> taken
 *     extension_disallows_registration  -> taken (registry won't allow it)
 *     extension_not_supported(_via_api) -> unsupported (other registrars may sell it)
 * - Premium names are flagged with `tier: "premium"`, but the API cannot
 *   register them, so they are shown without being treated as a Cloudflare offer.
 * - Testing: set CLOUDFLARE_REGISTRAR_PATH=registrar-sandbox to use the sandbox.
 */
@Injectable()
export class CloudflareProvider
  extends BaseRegistrarProvider
  implements AvailabilityChecker
{
  readonly id = 'cloudflare';
  protected readonly displayName = 'Cloudflare';
  protected readonly purchaseUrlTemplate =
    'https://domains.cloudflare.com/?domain={domain}';
  readonly providesLivePricing = true;

  private readonly client: AxiosInstance;
  private readonly apiToken?: string;
  private readonly accountId?: string;
  private readonly registrarPath: string;

  constructor(configService: ConfigService) {
    super(
      'CloudflareProvider',
      { requestsPerMinute: 240, maxBulkSize: 20 },
      10,
    );
    this.apiToken = configService.get<string>('CLOUDFLARE_API_TOKEN');
    this.accountId = configService.get<string>('CLOUDFLARE_ACCOUNT_ID');
    this.registrarPath =
      configService.get<string>('CLOUDFLARE_REGISTRAR_PATH') || 'registrar';
    this.client = axios.create({
      baseURL:
        configService.get<string>('CLOUDFLARE_API_URL') ||
        'https://api.cloudflare.com/client/v4',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  protected hasCredentials(): boolean {
    return Boolean(this.apiToken && this.accountId);
  }

  async getSupportedTlds(): Promise<string[]> {
    return CLOUDFLARE_TLDS;
  }

  async checkAvailability(
    domains: Array<{ domain: string; tld: string }>,
  ): Promise<AvailabilityResult[]> {
    if (domains.length === 0) return [];
    return this.limiter.schedule(async () => {
      try {
        const response = await this.client.post(
          `/accounts/${this.accountId}/${this.registrarPath}/domain-check`,
          { domains: domains.map((d) => toFqdn(d.domain, d.tld)) },
        );
        const data = response.data;
        if (!data?.success || !Array.isArray(data?.result?.domains)) {
          throw new Error(
            `Invalid Cloudflare response: ${JSON.stringify(data?.errors ?? data).slice(0, 300)}`,
          );
        }
        return this.reconcile(
          domains,
          data.result.domains.map((r: any) => CloudflareProvider.mapResult(r)),
          'Domain not returned by Cloudflare',
        );
      } catch (error) {
        this.noteAuthFailure(error);
        return this.unknownResults(domains, error);
      }
    });
  }

  /** Exposed for unit tests. */
  static mapResult(r: any): AvailabilityResult {
    const { domain, tld } = parseFqdn(String(r.name ?? ''));
    const premium = r.tier === 'premium';
    const reason: string | undefined = r.reason;

    let status: AvailabilityStatus;
    if (r.registrable === true) status = 'available';
    else if (
      reason === 'extension_not_supported_via_api' ||
      reason === 'extension_not_supported'
    )
      status = 'unsupported';
    else if (
      reason === 'domain_unavailable' ||
      reason === 'extension_disallows_registration'
    )
      status = 'taken';
    else if (premium)
      status = 'available'; // premium but not registrable via API
    else status = 'unknown';

    return {
      domain,
      tld,
      status,
      premium,
      price:
        status === 'available'
          ? parsePrice(r.pricing?.registration_cost)
          : undefined,
      renewalPrice:
        status === 'available'
          ? parsePrice(r.pricing?.renewal_cost)
          : undefined,
      currency: r.pricing?.currency || 'USD',
      reason:
        premium && r.registrable !== true
          ? 'premium_not_supported_via_api'
          : reason,
    };
  }
}
