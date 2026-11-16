import { buildBuyUrl } from '../providers/base.provider';
import { OvhProvider } from '../providers/ovh.provider';
import { WhmcsFeedProvider } from '../providers/whmcs-feed.provider';
import { toPublicCatalog, toPublicOffers } from '../public-catalog';
import type { CatalogPrice } from '../tld-prices.service';

describe('buildBuyUrl', () => {
  const deep = 'https://reg.example/search?domain={domain}';

  it('fills {domain} in the deep link', () => {
    expect(buildBuyUrl('acme.io', deep)).toBe(
      'https://reg.example/search?domain=acme.io',
    );
  });

  it('wraps the deep link for Impact ({url}) and CJ ({rawurl})', () => {
    expect(
      buildBuyUrl('acme.io', deep, 'https://x.pxf.io/c/1/2/3?u={url}'),
    ).toBe(
      'https://x.pxf.io/c/1/2/3?u=https%3A%2F%2Freg.example%2Fsearch%3Fdomain%3Dacme.io',
    );
    expect(
      buildBuyUrl(
        'acme.io',
        deep,
        'https://www.anrdoezrs.net/links/9/type/dlg/{rawurl}',
      ),
    ).toBe(
      'https://www.anrdoezrs.net/links/9/type/dlg/https://reg.example/search?domain=acme.io',
    );
  });

  it('appends an affiliate param with the right separator', () => {
    expect(buildBuyUrl('acme.io', deep, '{rawurl}&aff=42')).toBe(
      'https://reg.example/search?domain=acme.io&aff=42',
    );
    expect(
      buildBuyUrl(
        'acme.io',
        'https://reg.example/d/{domain}',
        '{rawurl}&aff=42',
      ),
    ).toBe('https://reg.example/d/acme.io?aff=42');
  });

  it('uses a placeholder-free affiliate link verbatim (WHMCS aff.php)', () => {
    expect(
      buildBuyUrl('acme.io', deep, 'https://host.example/aff.php?aff=7'),
    ).toBe('https://host.example/aff.php?aff=7');
  });

  it('gives nothing when a wrapper needs a deep link that does not exist', () => {
    expect(
      buildBuyUrl('acme.io', undefined, 'https://x/?u={url}'),
    ).toBeUndefined();
    expect(buildBuyUrl('acme.io', undefined)).toBeUndefined();
  });
});

describe('registrar deep links', () => {
  it('sends OVH to the order funnel in the priced region', () => {
    expect(OvhProvider.orderUrlTemplate('IE')).toBe(
      'https://order.eu.ovhcloud.com/en-ie/order/webcloud/?#/webCloud/domain/select?domain={domain}',
    );
    expect(OvhProvider.orderUrlTemplate('GB')).toContain('/en-gb/');
    expect(OvhProvider.orderUrlTemplate('XX')).toContain('/en-ie/');
  });

  it('sends WhoGoHost to its public checkout, not the login-gated cart', () => {
    const whogohost = WhmcsFeedProvider.fromEnv({}).find(
      (p) => p.id === 'whogohost',
    );
    expect(whogohost?.purchaseUrl('acme.ng')).toBe(
      'https://panel.whogohost.com/checkout/0?domain=acme.ng&currency=NGN',
    );
    const truehost = WhmcsFeedProvider.fromEnv({}).find(
      (p) => p.id === 'truehost',
    );
    expect(truehost?.purchaseUrl('acme.ng')).toContain(
      'cart.php?a=add&domain=register&query=acme.ng',
    );
  });
});

describe('public catalog', () => {
  const price = (
    registrar: string,
    register: number,
    renewal: number,
    currency = 'USD',
  ): CatalogPrice => ({
    registrar,
    tld: 'io',
    registerPrice: register,
    renewalPrice: renewal,
    isPromo: register < renewal,
    currency,
    source: 'catalog-api',
    updatedAt: '2026-11-16T00:00:00.000Z',
    stale: false,
  });
  const name = (id: string) => id.toUpperCase();

  it('keeps enabled USD prices, cheapest 3-year first', () => {
    const offers = toPublicOffers(
      [
        price('a', 10, 50),
        price('b', 30, 30),
        price('c', 1, 1, 'NGN'),
        price('off', 1, 1),
      ],
      new Set(['a', 'b', 'c']),
      name,
    );
    expect(offers.map((o) => o.registrarId)).toEqual(['b', 'a']);
    expect(offers[1]).toMatchObject({ registrar: 'A', threeYearTotal: 110 });
  });

  it('summarises each TLD with its cheapest prices and spread', () => {
    const cat = toPublicCatalog(
      new Map([
        ['io', [price('a', 10, 50), price('b', 30, 30)]],
        ['none', []],
      ]),
      new Set(['a', 'b']),
      name,
    );
    expect(cat.stats).toEqual({ prices: 2, tlds: 1, registrars: 2 });
    expect(cat.tlds[0]).toMatchObject({
      tld: 'io',
      registrars: 2,
      cheapestRegister: 10,
      cheapestRenewal: 30,
      cheapestThreeYear: 90,
      threeYearSpread: 20,
    });
  });
});
