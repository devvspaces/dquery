import { readFileSync } from 'fs';
import { join } from 'path';
import { OvhProvider } from '../providers/ovh.provider';
import { WhmcsFeedProvider } from '../providers/whmcs-feed.provider';
import { NameComProvider } from '../providers/namecom.provider';
import { NameSiloProvider } from '../providers/namesilo.provider';
import { DynadotProvider } from '../providers/dynadot.provider';
import { HostingerProvider } from '../providers/hostinger.provider';
import { PorkbunProvider } from '../providers/porkbun.provider';
import { FxRatesService } from '../fx-rates.service';
import {
  isPlausibleCatalogPrice,
  isPlausibleQuote,
  toUsd,
  type CatalogPrice,
} from '../tld-prices.service';
import { buildOffers } from '../aggregation';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));

describe('OvhProvider.parseCatalog (real catalog sample)', () => {
  const quotes = OvhProvider.parseCatalog(fixture('ovh-catalog.json'));
  it('reads 1-year create/renew/transfer prices in the subsidiary currency', () => {
    const com = quotes.find((q) => q.tld === 'com')!;
    expect(com).toEqual(
      expect.objectContaining({
        currency: 'EUR',
        registerPrice: 8.49,
        renewalPrice: 14.29,
        transferPrice: 8.49,
        isPromo: true,
      }),
    );
  });
  it('ignores premium placeholder prices', () => {
    expect(quotes.every((q) => q.registerPrice < 1000)).toBe(true);
  });
});

describe('WhmcsFeedProvider', () => {
  it('parses the document.write feed', () => {
    expect(WhmcsFeedProvider.parseFeed("document.write('14999.00');")).toBe(
      14999,
    );
    expect(WhmcsFeedProvider.parseFeed("document.write('');")).toBeUndefined();
    expect(() => WhmcsFeedProvider.parseFeed('<html>')).toThrow();
  });
  it('treats -1.00 and 0.00 as "not sold" and strips currency formatting', () => {
    expect(
      WhmcsFeedProvider.parseFeed("document.write('-1.00');"),
    ).toBeUndefined();
    expect(
      WhmcsFeedProvider.parseFeed("document.write('0.00');"),
    ).toBeUndefined();
    expect(WhmcsFeedProvider.parseFeed("document.write('₦14,999.00');")).toBe(
      14999,
    );
  });
  it('builds the built-in family plus REGISTRARS_WHMCS extras', () => {
    const providers = WhmcsFeedProvider.fromEnv({
      REGISTRARS_WHMCS: JSON.stringify([
        {
          id: 'hostafrica',
          name: 'HostAfrica',
          baseUrl: 'https://x.test',
          currency: 'ZAR',
        },
      ]),
    });
    expect(providers.map((p) => p.id)).toEqual([
      'truehost',
      'whogohost',
      'hostafrica',
    ]);
    expect(providers[0].purchaseUrl('acme.com')).toBe(
      'https://truehost.com/cloud/cart.php?a=add&domain=register&query=acme.com',
    );
  });
});

describe('keyed catalog providers (documented response shapes)', () => {
  it('Name.com uses retail prices', () => {
    const [q] = NameComProvider.parsePricing({
      pricing: [
        {
          tld: 'com',
          duration: 1,
          registrationPrice: 9.99,
          registrationRetailPrice: 10.99,
          registrationOriginalPrice: 11.99,
          renewalPrice: 9.99,
          renewalRetailPrice: 10.99,
          transferInPrice: 19.99,
          transferInRetailPrice: 20.99,
        },
      ],
    });
    expect(q).toEqual(
      expect.objectContaining({
        tld: 'com',
        registerPrice: 10.99,
        renewalPrice: 10.99,
        transferPrice: 20.99,
        regularRegisterPrice: 11.99,
        isPromo: true,
      }),
    );
  });

  it('NameSilo reads every TLD in the reply', () => {
    const quotes = NameSiloProvider.parsePrices({
      reply: {
        code: 300,
        detail: 'success',
        com: { registration: '10.95', transfer: '10.95', renew: '10.95' },
        xyz: { registration: '1.99', transfer: '11.00', renew: '12.99' },
      },
    });
    expect(quotes.map((q) => [q.tld, q.registerPrice, q.isPromo])).toEqual([
      ['com', 10.95, false],
      ['xyz', 1.99, true],
    ]);
    expect(() =>
      NameSiloProvider.parsePrices({ reply: { code: 110, detail: 'bad key' } }),
    ).toThrow('bad key');
  });

  it('Dynadot reads TldPrice entries', () => {
    const [q] = DynadotProvider.parsePrices({
      TldPriceResponse: {
        ResponseCode: 0,
        Status: 'success',
        Currency: 'USD',
        TldPrice: [
          {
            Tld: 'com',
            Price: { Register: '10.88', Renew: '10.88', Transfer: '10.88' },
          },
        ],
      },
    });
    expect(q).toEqual(
      expect.objectContaining({
        tld: 'com',
        registerPrice: 10.88,
        currency: 'USD',
      }),
    );
  });

  it('Hostinger converts cents and picks the 1-year price', () => {
    const [q] = HostingerProvider.parseCatalog([
      {
        id: 'hostingercom-domain-com',
        name: '.COM',
        category: 'DOMAIN',
        prices: [
          {
            id: 'a',
            currency: 'USD',
            price: 1599,
            first_period_price: 999,
            period: 1,
            period_unit: 'year',
          },
          {
            id: 'b',
            currency: 'USD',
            price: 2998,
            first_period_price: 2598,
            period: 2,
            period_unit: 'year',
          },
        ],
      },
    ]);
    expect(q).toEqual(
      expect.objectContaining({
        tld: 'com',
        registerPrice: 9.99,
        renewalPrice: 15.99,
        isPromo: true,
      }),
    );
  });
});

describe('currency conversion', () => {
  const rates = FxRatesService.parse({
    result: 'success',
    base_code: 'USD',
    rates: { USD: 1, EUR: 0.9, NGN: 1500, BAD: 'x' },
  });
  const convert = (amount: number, currency: string) => {
    const r = rates.get(currency);
    return r ? Math.round((amount / r) * 100) / 100 : undefined;
  };
  const price = (currency: string, register: number): CatalogPrice => ({
    registrar: 'whogohost',
    tld: 'com',
    registerPrice: register,
    renewalPrice: register,
    isPromo: false,
    currency,
    source: 'catalog-api',
    updatedAt: new Date().toISOString(),
    stale: false,
  });

  it('parses only valid rates', () => {
    expect([...rates.keys()].sort()).toEqual(['EUR', 'NGN', 'USD']);
  });

  it('converts to USD and keeps the original price', () => {
    expect(toUsd(price('NGN', 15000), convert)).toEqual(
      expect.objectContaining({
        registerPrice: 10,
        currency: 'USD',
        originalCurrency: 'NGN',
        originalRegisterPrice: 15000,
      }),
    );
  });

  it('leaves prices alone when no rate is known', () => {
    expect(toUsd(price('XYZ', 5), convert).currency).toBe('XYZ');
  });

  it('carries the original price and buy link into offers', () => {
    const [offer] = buildOffers({
      domain: 'acme',
      tld: 'com',
      live: new Map([
        ['cloudflare', { domain: 'acme', tld: 'com', status: 'available' }],
      ]),
      catalog: [toUsd(price('NGN', 15000), convert)],
      enabled: new Set(['whogohost']),
      displayName: (id) => id,
      purchaseUrl: (id) => `https://buy.test/${id}`,
    });
    expect(offer).toEqual(
      expect.objectContaining({
        price: 10,
        originalCurrency: 'NGN',
        originalPrice: 15000,
        purchaseUrl: 'https://buy.test/whogohost',
      }),
    );
  });
});

describe('purchase links', () => {
  it('use the provider template and can be overridden per deployment', () => {
    const porkbun = new PorkbunProvider();
    expect(porkbun.purchaseUrl('acme.com')).toBe(
      'https://porkbun.com/checkout/search?q=acme.com',
    );
    process.env.REGISTRAR_LINK_PORKBUN = 'https://aff.test/?d={domain}&ref=dq';
    expect(porkbun.purchaseUrl('acme.com')).toBe(
      'https://aff.test/?d=acme.com&ref=dq',
    );
    delete process.env.REGISTRAR_LINK_PORKBUN;
  });
});

describe('price sanity guards', () => {
  const quote = (registerPrice: number, renewalPrice = registerPrice) => ({
    registrar: 'x',
    tld: 'ai',
    currency: 'NGN',
    registerPrice,
    renewalPrice,
    isPromo: false,
    source: 'catalog-api' as const,
  });
  const catalog = (
    registerPrice: number,
    currency = 'USD',
    source: 'catalog-api' | 'manual' = 'catalog-api',
  ) => ({
    registrar: 'x',
    tld: 'ai',
    registerPrice,
    renewalPrice: registerPrice,
    isPromo: false,
    currency,
    source,
    updatedAt: new Date().toISOString(),
    stale: false,
  });

  it('drops zero, negative and NaN quotes at sync', () => {
    expect(isPlausibleQuote(quote(14999))).toBe(true);
    expect(isPlausibleQuote(quote(0))).toBe(false);
    expect(isPlausibleQuote(quote(-1))).toBe(false);
    expect(isPlausibleQuote(quote(10, 0))).toBe(false);
    expect(isPlausibleQuote(quote(NaN))).toBe(false);
  });

  it('hides converted prices that round to nothing, but trusts manual ones', () => {
    const toUsdFrom = (rate: number) => (amount: number, cur: string) =>
      cur === 'NGN' ? amount * rate : undefined;
    // 1 NGN (the old "-1.00" bug) → ~$0.0007: hidden.
    expect(
      isPlausibleCatalogPrice(toUsd(catalog(1, 'NGN'), toUsdFrom(1 / 1500))),
    ).toBe(false);
    // A real NGN price converts and stays.
    expect(
      isPlausibleCatalogPrice(
        toUsd(catalog(14999, 'NGN'), toUsdFrom(1 / 1500)),
      ),
    ).toBe(true);
    expect(isPlausibleCatalogPrice(catalog(0))).toBe(false);
    expect(isPlausibleCatalogPrice(catalog(0.05))).toBe(false);
    expect(isPlausibleCatalogPrice(catalog(0.99))).toBe(true);
    expect(isPlausibleCatalogPrice(catalog(0.05, 'USD', 'manual'))).toBe(true);
  });
});
