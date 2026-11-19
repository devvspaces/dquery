import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import Bottleneck from 'bottleneck';
import { RedisService } from '../../redis/redis.service';
import { SettingsService } from '../settings/settings.service';
import type { AvailabilityResult } from './interfaces/registrar-provider.interface';
import { errorMessage, toFqdn } from './utils/domain.util';

const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const ROOT_ZONE_URL = 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt';
const DAY = 24 * 60 * 60;

/** Last label of a TLD: "com.ng" → "ng". */
export const topLabel = (tld: string) =>
  tld.toLowerCase().replace(/^\./, '').split('.').pop() ?? '';

/** IANA's RDAP bootstrap file → TLD → base URL (https preferred, trailing slash). */
export function parseBootstrap(json: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const services = (json as { services?: unknown })?.services;
  if (!Array.isArray(services)) return out;
  for (const entry of services) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [tlds, urls] = entry as [unknown, unknown];
    if (!Array.isArray(tlds) || !Array.isArray(urls)) continue;
    const strUrls = urls.filter((u): u is string => typeof u === 'string');
    const url = strUrls.find((u) => u.startsWith('https://')) ?? strUrls[0];
    if (!url) continue;
    const base = url.endsWith('/') ? url : `${url}/`;
    for (const t of tlds)
      if (typeof t === 'string') out[t.toLowerCase()] = base;
  }
  return out;
}

/** IANA's root zone list (one TLD per line, # comments) → lowercase TLDs. */
export function parseRootZone(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith('#'));
}

/** Map an RDAP HTTP status to registry availability. */
export function rdapStatus(httpStatus: number): AvailabilityResult['status'] {
  if (httpStatus === 200) return 'taken';
  if (httpStatus === 404) return 'available';
  return 'unknown';
}

/**
 * Public registry lookup (RDAP), used as a last resort for TLDs no registrar
 * checker covers. It decides availability only: never prices or Buy links.
 *
 * 200 = registered, 404 = not registered. Anything else is "unknown"
 * (never "taken"). Premium / reserved names may still show as available,
 * so results carry reason "registry_lookup" and the UI says so.
 */
@Injectable()
export class RdapService {
  private readonly logger = new Logger(RdapService.name);
  private readonly http: AxiosInstance;
  private bootstrap: Record<string, string> | null = null;
  private rootZone: Set<string> | null = null;
  private loadedAt = 0;
  private rootLoadedAt = 0;
  private loading: Promise<void> | null = null;
  private readonly limiters = new Map<string, Bottleneck>();

  constructor(
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
  ) {
    this.http = axios.create({
      timeout: 8000,
      headers: { Accept: 'application/rdap+json, application/json' },
      // We read the status ourselves.
      validateStatus: () => true,
      maxRedirects: 3,
    });
  }

  enabled(): boolean {
    return this.settings.get<string>('registrars.rdapFallback') === 'on';
  }

  /** TLDs we can look up (top labels), loading the bootstrap if needed. */
  async supportedTlds(): Promise<Set<string>> {
    if (!this.enabled()) return new Set();
    await this.ensureBootstrap();
    return new Set(Object.keys(this.bootstrap ?? {}));
  }

  async supports(tld: string): Promise<boolean> {
    if (!this.enabled()) return false;
    await this.ensureBootstrap();
    return Boolean(this.bootstrap?.[topLabel(tld)]);
  }

  async check(
    domains: Array<{ domain: string; tld: string }>,
  ): Promise<AvailabilityResult[]> {
    await this.ensureBootstrap();
    return Promise.all(domains.map((d) => this.checkOne(d.domain, d.tld)));
  }

  private async checkOne(
    domain: string,
    tld: string,
  ): Promise<AvailabilityResult> {
    const base = this.bootstrap?.[topLabel(tld)];
    if (!base) return { domain, tld, status: 'unsupported' };
    const fqdn = toFqdn(domain, tld);
    try {
      const res = await this.limiter(base).schedule(() =>
        this.http.get(`${base}domain/${encodeURIComponent(fqdn)}`),
      );
      const status = rdapStatus(res.status);
      return status === 'unknown'
        ? { domain, tld, status, error: `RDAP HTTP ${res.status}` }
        : status === 'available'
          ? { domain, tld, status, reason: 'registry_lookup' }
          : { domain, tld, status };
    } catch (error) {
      return { domain, tld, status: 'unknown', error: errorMessage(error) };
    }
  }

  /** One queue per RDAP host: rdap.dns.pl alone serves ~150 TLDs. */
  private limiter(base: string): Bottleneck {
    const host = new URL(base).host;
    let l = this.limiters.get(host);
    if (!l) {
      l = new Bottleneck({
        maxConcurrent: 2,
        minTime: 250,
        reservoir: 60,
        reservoirRefreshAmount: 60,
        reservoirRefreshInterval: 60_000,
      });
      this.limiters.set(host, l);
    }
    return l;
  }

  /**
   * The IANA root zone, so price feeds can't add names that don't exist on the
   * normal internet (Handshake etc.). Null when it can't be loaded.
   */
  async rootZoneTlds(): Promise<Set<string> | null> {
    // Same switch as the lookup: "off" means no IANA calls at all (and tests use made-up TLDs).
    if (!this.enabled()) return null;
    if (this.rootZone && Date.now() - this.rootLoadedAt < DAY * 1000)
      return this.rootZone;
    const key = 'iana:root-zone';
    try {
      let list = await this.redis.getJson<string[]>(key).catch(() => null);
      if (!list?.length) {
        const res = await axios.get<string>(ROOT_ZONE_URL, {
          timeout: 15000,
          responseType: 'text',
        });
        list = parseRootZone(String(res.data));
        // A real root zone has 1,000+ TLDs; anything tiny is a bad response.
        if (list.length < 500) throw new Error(`only ${list.length} TLDs`);
        await this.redis.setJson(key, list, DAY).catch(() => undefined);
      }
      this.rootZone = new Set(list);
      this.rootLoadedAt = Date.now();
    } catch (error) {
      this.logger.warn(`IANA root zone unavailable: ${errorMessage(error)}`);
    }
    return this.rootZone;
  }

  private async ensureBootstrap(): Promise<void> {
    if (this.bootstrap && Date.now() - this.loadedAt < DAY * 1000) return;
    this.loading ??= this.loadBootstrap().finally(() => (this.loading = null));
    await this.loading;
  }

  private async loadBootstrap(): Promise<void> {
    const key = 'rdap:bootstrap';
    try {
      const cached = await this.redis
        .getJson<Record<string, string>>(key)
        .catch(() => null);
      if (cached && Object.keys(cached).length) {
        this.bootstrap = cached;
      } else {
        const res = await axios.get(BOOTSTRAP_URL, { timeout: 15000 });
        const map = parseBootstrap(res.data);
        if (Object.keys(map).length < 100)
          throw new Error('bootstrap looks empty');
        this.bootstrap = map;
        await this.redis.setJson(key, map, DAY).catch(() => undefined);
      }
      this.loadedAt = Date.now();
    } catch (error) {
      // Keep the previous copy if we had one; try again in 10 minutes.
      this.logger.warn(`RDAP bootstrap unavailable: ${errorMessage(error)}`);
      this.loadedAt = Date.now() - DAY * 1000 + 10 * 60 * 1000;
    }
  }
}
