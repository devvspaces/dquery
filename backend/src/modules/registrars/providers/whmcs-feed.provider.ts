import axios from 'axios';
import type {
  PriceCatalogSource,
  TldPriceQuote,
} from '../interfaces/registrar-provider.interface';
import { BaseRegistrarProvider } from './base.provider';
import { errorMessage } from '../utils/domain.util';

export interface WhmcsFeedConfig {
  /** Stable id, e.g. "truehost". */
  id: string;
  name: string;
  /** WHMCS install root, e.g. "https://truehost.com/cloud". */
  baseUrl: string;
  /** Currency the feed returns (the install's default currency). */
  currency: string;
  /** TLDs to price; the feed answers one TLD at a time. */
  tlds?: string[];
}

/** Popular gTLDs plus African ccTLDs; most WHMCS registrars serve these. */
export const DEFAULT_WHMCS_TLDS = [
  'com',
  'net',
  'org',
  'info',
  'biz',
  'co',
  'io',
  'ai',
  'app',
  'dev',
  'online',
  'store',
  'shop',
  'tech',
  'site',
  'xyz',
  'me',
  'tv',
  'africa',
  'ng',
  'com.ng',
  'org.ng',
  'ke',
  'co.ke',
  'co.za',
  'gh',
  'com.gh',
  'co.uk',
  'uk',
  'us',
];

/**
 * Registrars built on WHMCS (common with African and Asian hosts) publish a
 * public price "data feed": `/feeds/domainprice.php?tld=.com&type=register`
 * answers `document.write('9.00');`, or an empty string when the TLD isn't sold.
 * One class serves the whole family; add registrars with REGISTRARS_WHMCS.
 */
export class WhmcsFeedProvider
  extends BaseRegistrarProvider
  implements PriceCatalogSource
{
  readonly id: string;
  protected readonly displayName: string;
  protected readonly purchaseUrlTemplate: string;

  constructor(private readonly config: WhmcsFeedConfig) {
    super(
      `WhmcsFeedProvider:${config.id}`,
      { requestsPerMinute: 60, maxBulkSize: 1 },
      2,
    );
    this.id = config.id;
    this.displayName = config.name;
    this.purchaseUrlTemplate = `${config.baseUrl}/cart.php?a=add&domain=register&query={domain}`;
  }

  /** Built-in registrars plus any from REGISTRARS_WHMCS (JSON array of WhmcsFeedConfig). */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): WhmcsFeedProvider[] {
    const builtIn: WhmcsFeedConfig[] = [
      {
        id: 'truehost',
        name: 'Truehost',
        baseUrl: 'https://truehost.com/cloud',
        currency: 'USD',
      },
      {
        id: 'whogohost',
        name: 'WhoGoHost',
        baseUrl: 'https://www.whogohost.com/host',
        currency: 'NGN',
      },
    ];
    let extra: WhmcsFeedConfig[] = [];
    if (env.REGISTRARS_WHMCS) {
      try {
        extra = JSON.parse(env.REGISTRARS_WHMCS) as WhmcsFeedConfig[];
      } catch {
        // Ignore a malformed override rather than failing the whole app.
      }
    }
    const byId = new Map([...builtIn, ...extra].map((c) => [c.id, c]));
    return [...byId.values()].map((c) => new WhmcsFeedProvider(c));
  }

  protected hasCredentials(): boolean {
    return true;
  }

  async fetchTldPrices(): Promise<TldPriceQuote[]> {
    const quotes: TldPriceQuote[] = [];
    for (const tld of this.config.tlds ?? DEFAULT_WHMCS_TLDS) {
      try {
        const [register, renew, transfer] = await Promise.all(
          (['register', 'renew', 'transfer'] as const).map((type) =>
            this.feed(tld, type),
          ),
        );
        if (register === undefined) continue; // not sold here
        const renewal = renew ?? register;
        quotes.push({
          registrar: this.id,
          tld,
          currency: this.config.currency,
          registerPrice: register,
          renewalPrice: renewal,
          transferPrice: transfer,
          regularRegisterPrice: register < renewal ? renewal : undefined,
          isPromo: register < renewal,
          source: 'catalog-api',
        });
      } catch (error) {
        this.logger.warn(`${this.displayName} .${tld}: ${errorMessage(error)}`);
      }
    }
    return quotes;
  }

  private async feed(
    tld: string,
    type: 'register' | 'renew' | 'transfer',
  ): Promise<number | undefined> {
    const response = await this.limiter.schedule(() =>
      axios.get<string>(`${this.config.baseUrl}/feeds/domainprice.php`, {
        params: { tld: `.${tld}`, type, regperiod: 1 },
        timeout: 20_000,
        responseType: 'text',
      }),
    );
    return WhmcsFeedProvider.parseFeed(response.data);
  }

  /** `document.write('14999.00');` → 14999; `document.write('');` → undefined. */
  static parseFeed(body: string): number | undefined {
    const m = /document\.write\('([^']*)'\)/.exec(body ?? '');
    if (!m) throw new Error('unexpected feed response');
    const value = parseFloat(m[1].replace(/[^0-9.]/g, ''));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
}
