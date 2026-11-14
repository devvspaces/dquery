import { buildOffers, pickBestOffer, resolveStatus } from '../aggregation';
import type { AvailabilityResult } from '../interfaces/registrar-provider.interface';
import type { CatalogPrice } from '../tld-prices.service';

const cat = (
  registrar: string,
  registerPrice: number,
  renewalPrice: number,
  extra: Partial<CatalogPrice> = {},
): CatalogPrice => ({
  registrar,
  tld: 'com',
  registerPrice,
  renewalPrice,
  isPromo: registerPrice < renewalPrice,
  currency: 'USD',
  source: 'catalog-api',
  updatedAt: new Date().toISOString(),
  stale: false,
  ...extra,
});

const live = (
  entries: Array<[string, Partial<AvailabilityResult>]>,
): Map<string, AvailabilityResult> =>
  new Map(
    entries.map(([id, r]): [string, AvailabilityResult] => [
      id,
      { domain: 'acme', tld: 'com', status: 'available', ...r },
    ]),
  );

const base = {
  domain: 'acme',
  tld: 'com',
  enabled: new Set([
    'namecheap',
    'spaceship',
    'cloudflare',
    'porkbun',
    'godaddy',
  ]),
  displayName: (id: string) => id,
};

describe('resolveStatus', () => {
  it('a provider error is unknown, never taken', () => {
    expect(
      resolveStatus([
        { domain: 'a', tld: 'com', status: 'unknown', error: 'timeout' },
      ]),
    ).toBe('unknown');
  });
  it('a definite answer beats unknown, and taken beats available', () => {
    expect(
      resolveStatus([
        { domain: 'a', tld: 'com', status: 'unknown' },
        { domain: 'a', tld: 'com', status: 'available' },
      ]),
    ).toBe('available');
    expect(
      resolveStatus([
        { domain: 'a', tld: 'com', status: 'available' },
        { domain: 'a', tld: 'com', status: 'taken' },
      ]),
    ).toBe('taken');
  });
});

describe('buildOffers', () => {
  it('prices every registrar from one availability answer + catalog, live price wins', () => {
    const offers = buildOffers({
      ...base,
      live: live([
        ['namecheap', { premium: false }],
        ['cloudflare', { price: 10.44, renewalPrice: 10.44 }],
      ]),
      catalog: [
        cat('namecheap', 9.76, 15.16),
        cat('spaceship', 8.98, 9.98),
        cat('porkbun', 11.08, 11.08),
      ],
    });
    expect(offers.map((o) => [o.registrar, o.price, o.priceSource])).toEqual([
      ['spaceship', 8.98, 'catalog-api'],
      ['namecheap', 9.76, 'catalog-api'],
      ['cloudflare', 10.44, 'live'],
      ['porkbun', 11.08, 'catalog-api'],
    ]);
    expect(offers.every((o) => o.status === 'available')).toBe(true);
    expect(
      offers.find((o) => o.registrar === 'spaceship')!.threeYearTotal,
    ).toBe(28.94);
  });

  it('never applies catalog prices to premium names', () => {
    const offers = buildOffers({
      ...base,
      live: live([
        ['spaceship', { premium: true, price: 2500, renewalPrice: 12 }],
      ]),
      catalog: [cat('namecheap', 9.76, 15.16), cat('spaceship', 8.98, 9.98)],
    });
    const nc = offers.find((o) => o.registrar === 'namecheap')!;
    expect(nc.price).toBeUndefined();
    expect(nc.reason).toBe('premium_price_unavailable');
    expect(offers.find((o) => o.registrar === 'spaceship')!.price).toBe(2500);
  });

  it('adds the EAP fee on top of the catalog price', () => {
    const offers = buildOffers({
      ...base,
      live: live([
        ['namecheap', { extraFee: 100, reason: 'early_access_fee' }],
      ]),
      catalog: [cat('namecheap', 20, 20)],
    });
    expect(offers[0].price).toBe(120);
  });

  it('hides disabled and unsupported registrars', () => {
    const offers = buildOffers({
      ...base,
      enabled: new Set(['namecheap']),
      live: live([
        ['namecheap', {}],
        ['cloudflare', { status: 'unsupported' }],
      ]),
      catalog: [cat('namecheap', 9, 9), cat('porkbun', 8, 8)],
    });
    expect(offers.map((o) => o.registrar)).toEqual(['namecheap']);
  });

  it('when the check failed, offers are unknown and unpriced', () => {
    const offers = buildOffers({
      ...base,
      live: live([['cloudflare', { status: 'unknown', error: 'HTTP 500' }]]),
      catalog: [cat('namecheap', 9, 9)],
    });
    expect(
      offers.every(
        (o) =>
          o.status === 'unknown' &&
          o.available === false &&
          o.price === undefined,
      ),
    ).toBe(true);
  });
});

describe('pickBestOffer', () => {
  it('ignores premium names Cloudflare cannot sell and prefers USD', () => {
    const now = new Date();
    const best = pickBestOffer([
      {
        domain: 'a',
        tld: 'com',
        status: 'available',
        available: true,
        registrar: 'cloudflare',
        price: 1,
        currency: 'USD',
        reason: 'premium_not_supported_via_api',
        checkedAt: now,
      },
      {
        domain: 'a',
        tld: 'com',
        status: 'available',
        available: true,
        registrar: 'x',
        price: 2,
        currency: 'EUR',
        checkedAt: now,
      },
      {
        domain: 'a',
        tld: 'com',
        status: 'available',
        available: true,
        registrar: 'namecheap',
        price: 9,
        currency: 'USD',
        checkedAt: now,
      },
    ]);
    expect(best?.registrar).toBe('namecheap');
  });
});
