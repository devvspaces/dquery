import { parseStringPromise } from 'xml2js';
import { NamecheapProvider } from '../providers/namecheap.provider';
import { GoDaddyProvider } from '../providers/godaddy.provider';
import { CloudflareProvider } from '../providers/cloudflare.provider';
import { SpaceshipProvider } from '../providers/spaceship.provider';
import { PorkbunProvider } from '../providers/porkbun.provider';
import { parseFqdn, multiYearTotal } from '../utils/domain.util';

const xml = (s: string) =>
  parseStringPromise(s, { explicitArray: false, mergeAttrs: true });

describe('parseFqdn', () => {
  it('keeps multi-label TLDs intact', () => {
    expect(parseFqdn('Example.CO.UK')).toEqual({
      domain: 'example',
      tld: 'co.uk',
    });
    expect(parseFqdn('shop.com.au')).toEqual({ domain: 'shop', tld: 'com.au' });
    expect(parseFqdn('a.com')).toEqual({ domain: 'a', tld: 'com' });
  });

  it('computes 3-year totals without float drift', () => {
    expect(multiYearTotal(8.98, 9.98, 3)).toBe(28.94);
  });
});

describe('Namecheap', () => {
  it('does not turn PremiumRegistrationPrice="0" into a $0 price', async () => {
    const parsed = await xml(
      `<DomainCheckResult Domain="example.com" Available="true" ErrorNo="0" Description=""
        IsPremiumName="false" PremiumRegistrationPrice="0" PremiumRenewalPrice="0"
        PremiumRestorePrice="0" PremiumTransferPrice="0" IcannFee="0" EapFee="0.0" />`,
    );
    const r = NamecheapProvider.mapCheckResult(parsed.DomainCheckResult);
    expect(r.status).toBe('available');
    expect(r.price).toBeUndefined();
    expect(r.premium).toBe(false);
    expect(r.extraFee).toBeUndefined();
  });

  it('returns premium price plus ICANN fee for premium names', async () => {
    const parsed = await xml(
      `<DomainCheckResult Domain="us.xyz" Available="true" ErrorNo="0" IsPremiumName="true"
        PremiumRegistrationPrice="13000.0000" PremiumRenewalPrice="13000.0000" IcannFee="0.18" EapFee="0" />`,
    );
    const r = NamecheapProvider.mapCheckResult(parsed.DomainCheckResult);
    expect(r).toMatchObject({
      status: 'available',
      premium: true,
      price: 13000.18,
      renewalPrice: 13000.18,
    });
  });

  it('flags the EAP fee and per-domain errors', async () => {
    const eap = NamecheapProvider.mapCheckResult(
      (
        await xml(
          `<D Domain="new.app" Available="true" ErrorNo="0" IsPremiumName="false" EapFee="250.00" />`,
        )
      ).D,
    );
    expect(eap).toMatchObject({
      status: 'available',
      extraFee: 250,
      reason: 'early_access_fee',
    });

    const err = NamecheapProvider.mapCheckResult(
      (
        await xml(
          `<D Domain="x.zz" Available="false" ErrorNo="2030280" Description="TLD not supported" />`,
        )
      ).D,
    );
    expect(err.status).toBe('unknown');
  });

  it('parses getPricing: 1-year term, ICANN fee, promo vs regular, renew and transfer', async () => {
    const parsed = await xml(`
      <CommandResponse><UserGetPricingResult><ProductType Name="domains">
        <ProductCategory Name="register">
          <Product Name="com">
            <Price Duration="2" DurationType="YEAR" Price="11.28" YourPrice="11.28" YourAdditonalCost="0.18" RegularPrice="13.98" Currency="USD" />
            <Price Duration="1" DurationType="YEAR" Price="9.58" YourPrice="9.58" YourAdditonalCost="0.18" RegularPrice="13.98" RegularAdditionalCost="0.18" Currency="USD" />
          </Product>
        </ProductCategory>
        <ProductCategory Name="renew">
          <Product Name="com"><Price Duration="1" DurationType="YEAR" YourPrice="14.98" YourAdditonalCost="0.18" Currency="USD" /></Product>
        </ProductCategory>
        <ProductCategory Name="transfer">
          <Product Name="com"><Price Duration="1" DurationType="YEAR" YourPrice="10.98" YourAdditonalCost="0.18" Currency="USD" /></Product>
        </ProductCategory>
      </ProductType></UserGetPricingResult></CommandResponse>`);
    const [q] = NamecheapProvider.parsePricing(parsed.CommandResponse);
    expect(q).toMatchObject({
      registrar: 'namecheap',
      tld: 'com',
      registerPrice: 9.76,
      renewalPrice: 15.16,
      transferPrice: 11.16,
      regularRegisterPrice: 14.16,
      isPromo: true,
    });
  });
});

describe('GoDaddy', () => {
  it('matches by domain (not index), converts micro-units, reads errors[]', () => {
    const results = GoDaddyProvider.mapBulkResponse({
      domains: [
        { domain: 'beta.com', available: false, definitive: false, price: 0 },
        {
          domain: 'alpha.com',
          available: true,
          definitive: false,
          price: 11990000,
          currency: 'USD',
        },
      ],
      errors: [
        { domain: 'gamma.zz', code: 'UNSUPPORTED_TLD', message: 'nope' },
      ],
    });
    const alpha = results.find((r) => r.domain === 'alpha')!;
    expect(alpha).toMatchObject({ status: 'available', price: 11.99 });
    // `definitive: false` must NOT mark the name premium
    expect(alpha.premium).toBeUndefined();
    expect(alpha.renewalPrice).toBeUndefined();
    expect(results.find((r) => r.domain === 'beta')!.status).toBe('taken');
    expect(results.find((r) => r.domain === 'gamma')!.status).toBe(
      'unsupported',
    );
  });
});

describe('Cloudflare', () => {
  it('maps reasons to taken / unsupported, and keeps at-cost pricing', () => {
    expect(
      CloudflareProvider.mapResult({
        name: 'free.dev',
        registrable: true,
        pricing: {
          currency: 'USD',
          registration_cost: '10.18',
          renewal_cost: '10.18',
        },
      }),
    ).toMatchObject({ status: 'available', price: 10.18, renewalPrice: 10.18 });

    expect(
      CloudflareProvider.mapResult({
        name: 'g.com',
        registrable: false,
        reason: 'domain_unavailable',
      }).status,
    ).toBe('taken');
    expect(
      CloudflareProvider.mapResult({
        name: 'x.co.uk',
        registrable: false,
        reason: 'extension_not_supported_via_api',
      }),
    ).toMatchObject({ status: 'unsupported', tld: 'co.uk' });
    expect(
      CloudflareProvider.mapResult({
        name: 'p.com',
        registrable: false,
        tier: 'premium',
        pricing: { registration_cost: '5000' },
      }),
    ).toMatchObject({
      status: 'available',
      premium: true,
      reason: 'premium_not_supported_via_api',
    });
  });
});

describe('Spaceship', () => {
  it('only returns a price for premium names', () => {
    expect(
      SpaceshipProvider.mapResult({ domain: 'plain.com', result: 'available' }),
    ).toMatchObject({
      status: 'available',
      premium: false,
      price: undefined,
    });
    expect(
      SpaceshipProvider.mapResult({
        domain: 'gold.com',
        result: 'available',
        premiumPricing: [
          { operation: 'register', price: 2500, currency: 'USD' },
          { operation: 'renew', price: 12 },
        ],
      }),
    ).toMatchObject({ premium: true, price: 2500, renewalPrice: 12 });
    expect(
      SpaceshipProvider.mapResult({ domain: 'x.com', result: 'weird' }).status,
    ).toBe('unknown');
  });
});

describe('Porkbun', () => {
  it('parses the public pricing endpoint', () => {
    const quotes = PorkbunProvider.parsePricing({
      status: 'SUCCESS',
      pricing: {
        com: { registration: '11.08', renewal: '11.08', transfer: '11.08' },
        xyz: { registration: '2.04', renewal: '12.98', transfer: '12.98' },
      },
    });
    expect(quotes.find((q) => q.tld === 'xyz')).toMatchObject({
      registerPrice: 2.04,
      renewalPrice: 12.98,
      isPromo: true,
    });
    expect(() =>
      PorkbunProvider.parsePricing({ status: 'ERROR', message: 'x' }),
    ).toThrow();
  });
});
