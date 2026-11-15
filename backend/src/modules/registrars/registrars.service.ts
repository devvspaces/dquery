import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../redis/redis.service';
import { domainCache, registrarApiLogs } from '../../database/schema';
import {
  REGISTRAR_PROVIDERS,
  isAvailabilityChecker,
} from './interfaces/registrar-provider.interface';
import type {
  AvailabilityChecker,
  AvailabilityResult,
  DomainAvailability,
  IRegistrarProvider,
} from './interfaces/registrar-provider.interface';
import { TldPricesService } from './tld-prices.service';
import type { CatalogPrice } from './tld-prices.service';
import { buildOffers, pickBestOffer, resolveStatus } from './aggregation';
import {
  chunk,
  errorMessage,
  normalizeName,
  normalizeTld,
} from './utils/domain.util';

type DomainRef = { domain: string; tld: string };
type ApiLog = typeof registrarApiLogs.$inferInsert;

/** Default order in which providers are tried for the availability check. */
const DEFAULT_CHECKER_ORDER = [
  'cloudflare',
  'namecheap',
  'spaceship',
  'godaddy',
];

/**
 * Aggregates domain prices across registrars.
 *
 * Flow for N domains:
 *  1. Load catalog prices for the TLDs involved (Redis -> DB, one query).
 *  2. Availability is decided by the registry, so ask ONE checker per domain,
 *     failing over to the next checker only for domains that came back
 *     unknown/unsupported.
 *  3. For available domains, ask live-pricing registrars (no price list:
 *     Cloudflare, GoDaddy) for their price, and for premium domains ask every
 *     checker for its premium quote.
 *  4. Build one offer per registrar (see aggregation.ts).
 */
@Injectable()
export class RegistrarsService {
  private readonly logger = new Logger(RegistrarsService.name);
  private readonly availabilityCacheTTL = 15 * 60;
  /** Short TTL when a check was inconclusive, so we retry soon. */
  private readonly unknownCacheTTL = 60;
  private readonly providersById: Map<string, IRegistrarProvider>;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly tldPricesService: TldPricesService,
    @Inject(REGISTRAR_PROVIDERS) providers: IRegistrarProvider[],
  ) {
    this.providersById = new Map(providers.map((p) => [p.id, p]));
  }

  async checkDomainAvailability(
    domain: string,
    tld: string,
    userId?: string,
  ): Promise<DomainAvailability[]> {
    const map = await this.checkDomainsBulk([{ domain, tld }], userId);
    return map.get(`${normalizeName(domain)}.${normalizeTld(tld)}`) ?? [];
  }

  /**
   * Returns a map of `name.tld` (lowercased) -> one offer per registrar.
   */
  async checkDomainsBulk(
    domains: DomainRef[],
    userId?: string,
  ): Promise<Map<string, DomainAvailability[]>> {
    const startTime = Date.now();
    const unique = new Map<string, DomainRef>();
    for (const d of domains) {
      const ref = { domain: normalizeName(d.domain), tld: normalizeTld(d.tld) };
      if (ref.domain && ref.tld) unique.set(`${ref.domain}.${ref.tld}`, ref);
    }

    const results = new Map<string, DomainAvailability[]>();
    const misses: DomainRef[] = [];

    // 0. Per-domain cache
    await Promise.all(
      [...unique.entries()].map(async ([fqdn, ref]) => {
        const cached = await this.redisService
          .getJson<DomainAvailability[]>(this.cacheKey(fqdn))
          .catch(() => null);
        if (cached) results.set(fqdn, cached);
        else misses.push(ref);
      }),
    );
    if (misses.length === 0) return results;

    const logs: ApiLog[] = [];
    const enabled = this.getEnabledProviderIds();

    // 1. Catalog
    const catalog = await this.tldPricesService.getPricesForTlds(
      misses.map((d) => d.tld),
    );

    // 2. Availability with failover
    const live = new Map<string, Map<string, AvailabilityResult>>();
    const record = (providerId: string, r: AvailabilityResult) => {
      const fqdn = `${r.domain}.${r.tld}`;
      if (!live.has(fqdn)) live.set(fqdn, new Map());
      live.get(fqdn)!.set(providerId, r);
    };

    const checkers = await this.getOrderedCheckers();
    let pending = misses;
    for (const checker of checkers) {
      if (pending.length === 0) break;
      const eligible = await this.filterSupported(checker, pending, catalog);
      if (eligible.length === 0) continue;

      const checked = await this.runChecker(checker, eligible, logs, userId);
      checked.forEach((r) => record(checker.id, r));

      const resolved = new Set(
        checked
          .filter((r) => r.status === 'available' || r.status === 'taken')
          .map((r) => `${r.domain}.${r.tld}`),
      );
      pending = pending.filter((d) => !resolved.has(`${d.domain}.${d.tld}`));
    }

    // 3. Live prices for available names
    const available = misses.filter((d) => {
      const fqdn = `${d.domain}.${d.tld}`;
      return (
        resolveStatus([...(live.get(fqdn)?.values() ?? [])]) === 'available'
      );
    });
    const isPremium = (d: DomainRef) =>
      [...(live.get(`${d.domain}.${d.tld}`)?.values() ?? [])].some(
        (r) => r.premium,
      );

    await Promise.all(
      checkers.map(async (checker) => {
        const targets = available.filter(
          (d) =>
            !live.get(`${d.domain}.${d.tld}`)?.has(checker.id) &&
            (checker.providesLivePricing || isPremium(d)),
        );
        const eligible = await this.filterSupported(checker, targets, catalog);
        if (eligible.length === 0) return;
        const priced = await this.runChecker(checker, eligible, logs, userId);
        // A secondary checker only contributes a price; the registry status was already decided.
        priced
          .filter((r) => r.status === 'available' || r.status === 'unsupported')
          .forEach((r) => record(checker.id, r));
      }),
    );

    // 4. Offers
    const checkedAt = new Date();
    const cacheRows: Array<typeof domainCache.$inferInsert> = [];

    await Promise.all(
      misses.map(async (d) => {
        const fqdn = `${d.domain}.${d.tld}`;
        const liveForDomain =
          live.get(fqdn) ?? new Map<string, AvailabilityResult>();
        let offers = buildOffers({
          domain: d.domain,
          tld: d.tld,
          live: liveForDomain,
          catalog: catalog.get(d.tld) ?? [],
          enabled,
          displayName: (id) => this.displayName(id),
          purchaseUrl: (id) =>
            this.providersById.get(id)?.purchaseUrl?.(`${d.domain}.${d.tld}`),
          checkedAt,
        });

        if (offers.length === 0) {
          // Nobody could tell us anything (no checker supports this TLD and no catalog price).
          const status = resolveStatus([...liveForDomain.values()]);
          offers = [
            {
              domain: d.domain,
              tld: d.tld,
              status,
              available: status === 'available',
              registrar: 'None',
              error:
                [...liveForDomain.values()].find((r) => r.error)?.error ??
                'No enabled registrar supports this TLD',
              checkedAt,
            },
          ];
        }

        results.set(fqdn, offers);

        const ttl =
          offers[0].status === 'unknown'
            ? this.unknownCacheTTL
            : this.availabilityCacheTTL;
        await this.redisService
          .setJson(this.cacheKey(fqdn), offers, ttl)
          .catch(() => undefined);

        const best = pickBestOffer(offers);
        cacheRows.push({
          domain: fqdn,
          registrar: best?.registrar ?? 'Unknown',
          available: offers[0].status === 'available',
          registerPrice: best?.price?.toFixed(2) ?? null,
          renewalPrice: best?.renewalPrice?.toFixed(2) ?? null,
          checkedAt,
          expiresAt: new Date(checkedAt.getTime() + ttl * 1000),
        });
      }),
    );

    await this.persist(cacheRows, logs);

    this.logger.log(
      `Checked ${misses.length} domain(s) (${unique.size - misses.length} cached) in ${Date.now() - startTime}ms`,
    );
    return results;
  }

  async getBestPrice(
    domain: string,
    tld: string,
  ): Promise<DomainAvailability | null> {
    return pickBestOffer(await this.checkDomainAvailability(domain, tld));
  }

  async getAllSupportedTlds(): Promise<string[]> {
    const all = new Set<string>();
    for (const p of this.providersById.values()) {
      (await p.getSupportedTlds()).forEach((t) => all.add(t));
    }
    return [...all].sort();
  }

  async getProviderTlds(providerName: string): Promise<string[]> {
    return (
      (await this.providersById
        .get(providerName.toLowerCase())
        ?.getSupportedTlds()) ?? []
    );
  }

  // ---------------------------------------------------------------------------

  private cacheKey(fqdn: string): string {
    return `domain:v2:${fqdn}:offers`;
  }

  private displayName(id: string): string {
    return (
      this.providersById.get(id)?.getProviderName() ??
      id.charAt(0).toUpperCase() + id.slice(1)
    );
  }

  /** ENABLED_REGISTRARS (comma-separated ids); empty means all. */
  private getEnabledProviderIds(): Set<string> {
    const configured = (
      this.configService.get<string>('ENABLED_REGISTRARS') ?? ''
    )
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    return new Set(
      configured.length > 0 ? configured : [...this.providersById.keys()],
    );
  }

  /** Enabled, configured checkers in AVAILABILITY_CHECKER_ORDER. */
  private async getOrderedCheckers(): Promise<AvailabilityChecker[]> {
    const enabled = this.getEnabledProviderIds();
    const order = (
      this.configService.get<string>('AVAILABILITY_CHECKER_ORDER') ?? ''
    )
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    const ids = [
      ...new Set([
        ...(order.length ? order : DEFAULT_CHECKER_ORDER),
        ...this.providersById.keys(),
      ]),
    ];

    return ids
      .map((id) => this.providersById.get(id))
      .filter((p): p is AvailabilityChecker => !!p && isAvailabilityChecker(p))
      .filter((p) => enabled.has(p.id) && p.isConfigured());
  }

  /**
   * Only send a checker TLDs it can handle: its static list if it has one,
   * otherwise the TLDs it has a catalog price for (Namecheap fails a whole
   * request if a single TLD is not sold through its API).
   */
  private async filterSupported(
    checker: AvailabilityChecker,
    domains: DomainRef[],
    catalog: Map<string, CatalogPrice[]>,
  ): Promise<DomainRef[]> {
    const staticList = await checker.getSupportedTlds();
    if (staticList.length > 0) {
      const set = new Set(staticList);
      return domains.filter((d) => set.has(d.tld));
    }
    return domains.filter((d) =>
      catalog.get(d.tld)?.some((c) => c.registrar === checker.id),
    );
  }

  private async runChecker(
    checker: AvailabilityChecker,
    domains: DomainRef[],
    logs: ApiLog[],
    userId?: string,
  ): Promise<AvailabilityResult[]> {
    const batches = chunk(domains, checker.getRateLimits().maxBulkSize);
    const all = await Promise.all(
      batches.map(async (batch) => {
        const started = Date.now();
        let results: AvailabilityResult[];
        try {
          results = await checker.checkAvailability(batch);
        } catch (error) {
          // Providers should not throw, but never let one break the whole search.
          results = batch.map((d) => ({
            ...d,
            status: 'unknown' as const,
            error: errorMessage(error),
          }));
        }
        const perDomain = Math.round(
          (Date.now() - started) / Math.max(1, batch.length),
        );
        for (const r of results) {
          logs.push({
            registrar: checker.getProviderName(),
            domain: `${r.domain}.${r.tld}`,
            success: r.status !== 'unknown',
            responseTime: perDomain,
            errorMessage: r.error?.slice(0, 500),
            createdAt: new Date(),
          });
        }
        return results;
      }),
    );
    void userId; // registrar_api_logs has no user column yet
    return all.flat();
  }

  /** One insert per table instead of one per domain. */
  private async persist(
    cacheRows: Array<typeof domainCache.$inferInsert>,
    logs: ApiLog[],
  ): Promise<void> {
    const db = this.databaseService.getDb();
    await Promise.all([
      cacheRows.length
        ? db
            .insert(domainCache)
            .values(cacheRows)
            .catch((e) =>
              this.logger.error(
                `Error storing domain cache: ${errorMessage(e)}`,
              ),
            )
        : undefined,
      ...chunk(logs, 500).map((batch) =>
        db
          .insert(registrarApiLogs)
          .values(batch)
          .catch((e) =>
            this.logger.error(`Error logging API calls: ${errorMessage(e)}`),
          ),
      ),
    ]);
  }
}
