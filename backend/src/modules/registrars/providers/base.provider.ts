import { Logger } from '@nestjs/common';
import Bottleneck from 'bottleneck';
import type {
  AvailabilityResult,
  IRegistrarProvider,
  ProviderRateLimits,
} from '../interfaces/registrar-provider.interface';
import {
  errorMessage,
  normalizeName,
  normalizeTld,
} from '../utils/domain.util';

/**
 * Shared plumbing for registrar adapters: rate limiting, and mapping a failed
 * request to `unknown` (never `taken`).
 */
export abstract class BaseRegistrarProvider implements IRegistrarProvider {
  abstract readonly id: string;
  protected abstract readonly displayName: string;
  protected readonly logger: Logger;
  protected readonly limiter: Bottleneck;

  protected constructor(
    loggerName: string,
    private readonly limits: ProviderRateLimits,
    maxConcurrent = 2,
  ) {
    this.logger = new Logger(loggerName);
    this.limiter = new Bottleneck({
      reservoir: limits.requestsPerMinute,
      reservoirRefreshAmount: limits.requestsPerMinute,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent,
      minTime: Math.ceil(60000 / limits.requestsPerMinute),
    });
  }

  getProviderName(): string {
    return this.displayName;
  }

  /**
   * Search/checkout URL with `{domain}` as placeholder. Override per
   * deployment (e.g. with an affiliate link) via REGISTRAR_LINK_<ID>.
   */
  protected readonly purchaseUrlTemplate?: string;

  purchaseUrl(fqdn: string, override?: string): string | undefined {
    const template =
      override ||
      process.env[
        `REGISTRAR_LINK_${this.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
      ] ||
      this.purchaseUrlTemplate;
    return template?.replace(/\{domain\}/g, encodeURIComponent(fqdn));
  }

  getRateLimits(): ProviderRateLimits {
    return this.limits;
  }

  private suspendedUntil = 0;

  protected abstract hasCredentials(): boolean;

  /** Configured, and not suspended after an auth/permission error. */
  isConfigured(): boolean {
    return this.hasCredentials() && Date.now() >= this.suspendedUntil;
  }

  async getSupportedTlds(): Promise<string[]> {
    return [];
  }

  /**
   * On 401/403 (bad key, IP not whitelisted, GoDaddy's 50-domain rule...),
   * stop calling this provider for a while instead of failing every request.
   */
  protected noteAuthFailure(error: unknown, minutes = 60): void {
    const status = (error as any)?.response?.status;
    if (status === 401 || status === 403) {
      this.suspendedUntil = Date.now() + minutes * 60 * 1000;
      this.logger.error(
        `${this.displayName} rejected our credentials (HTTP ${status}); suspending for ${minutes} min`,
      );
    }
  }

  /** Build one `unknown` result per domain, used when a whole request fails. */
  protected unknownResults(
    domains: Array<{ domain: string; tld: string }>,
    error: unknown,
  ): AvailabilityResult[] {
    const message = errorMessage(error);
    this.logger.warn(
      `${this.displayName} check failed for ${domains.length} domain(s): ${message}`,
    );
    return domains.map((d) => ({
      domain: normalizeName(d.domain),
      tld: normalizeTld(d.tld),
      status: 'unknown' as const,
      error: message,
    }));
  }

  /**
   * Fill in `unknown` for any requested domain the provider silently omitted,
   * and drop anything it returned that we did not ask for.
   */
  protected reconcile(
    requested: Array<{ domain: string; tld: string }>,
    returned: AvailabilityResult[],
    missingMessage: string,
  ): AvailabilityResult[] {
    const byFqdn = new Map(returned.map((r) => [`${r.domain}.${r.tld}`, r]));
    return requested.map((d) => {
      const domain = normalizeName(d.domain);
      const tld = normalizeTld(d.tld);
      return (
        byFqdn.get(`${domain}.${tld}`) ?? {
          domain,
          tld,
          status: 'unknown' as const,
          error: missingMessage,
        }
      );
    });
  }
}
