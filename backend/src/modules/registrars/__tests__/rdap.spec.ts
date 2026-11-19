import axios from 'axios';
import {
  parseBootstrap,
  parseRootZone,
  RdapService,
  rdapStatus,
  topLabel,
} from '../rdap.service';
import { buildOffers, REGISTRY_ID } from '../aggregation';
import type { AvailabilityResult } from '../interfaces/registrar-provider.interface';
import type { CatalogPrice } from '../tld-prices.service';
import type { RedisService } from '../../../redis/redis.service';
import { settingsStub } from '../../settings/testing';

const bootstrap = {
  services: [
    [
      ['pl', 'com.pl'],
      ['http://rdap.dns.pl/', 'https://rdap.dns.pl/'],
    ],
    [['fr'], ['https://rdap.nic.fr']],
    [['broken']],
  ],
};

describe('RDAP helpers', () => {
  it('maps each TLD to an https base URL with a trailing slash', () => {
    expect(parseBootstrap(bootstrap)).toEqual({
      pl: 'https://rdap.dns.pl/',
      'com.pl': 'https://rdap.dns.pl/',
      fr: 'https://rdap.nic.fr/',
    });
    expect(parseBootstrap({ nope: 1 })).toEqual({});
  });

  it('reads the root zone list without comments', () => {
    expect(parseRootZone('# Version 1\nCOM\nNG\n\nXN--P1AI\n')).toEqual([
      'com',
      'ng',
      'xn--p1ai',
    ]);
  });

  it('uses the last label of second-level TLDs', () => {
    expect(topLabel('.com.NG')).toBe('ng');
  });

  it('200 is registered, 404 is free, anything else is unknown', () => {
    expect(rdapStatus(200)).toBe('taken');
    expect(rdapStatus(404)).toBe('available');
    expect(rdapStatus(429)).toBe('unknown');
    expect(rdapStatus(500)).toBe('unknown');
    expect(rdapStatus(400)).toBe('unknown');
  });
});

describe('RdapService', () => {
  const redis = {
    getJson: jest.fn().mockResolvedValue(null),
    setJson: jest.fn().mockResolvedValue(undefined),
  } as unknown as RedisService;

  const make = (on = 'on') =>
    new RdapService(redis, settingsStub({ 'registrars.rdapFallback': on }));

  afterEach(() => jest.restoreAllMocks());

  it('checks via the TLD registry and never calls a missing TLD taken', async () => {
    const many = Object.fromEntries(
      Array.from({ length: 120 }, (_, i) => [`x${i}`, 'https://r.example/']),
    );
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        services: [
          ...bootstrap.services,
          [Object.keys(many), ['https://r.example/']],
        ],
      },
    });
    const svc = make();
    const get = jest.fn((url: string) =>
      url.includes('free.pl')
        ? Promise.resolve({ status: 404 })
        : url.includes('slow.fr')
          ? Promise.reject(new Error('timeout of 8000ms exceeded'))
          : Promise.resolve({ status: 200 }),
    );
    (svc as unknown as { http: { get: typeof get } }).http.get = get;

    expect(await svc.supports('com.pl')).toBe(true);
    expect(await svc.supports('zz')).toBe(false);

    const out = await svc.check([
      { domain: 'free', tld: 'pl' },
      { domain: 'google', tld: 'com.pl' },
      { domain: 'slow', tld: 'fr' },
      { domain: 'acme', tld: 'zz' },
    ]);
    expect(out.map((r) => r.status)).toEqual([
      'available',
      'taken',
      'unknown',
      'unsupported',
    ]);
    expect(out[0].reason).toBe('registry_lookup');
    expect(get).toHaveBeenCalledWith('https://rdap.dns.pl/domain/free.pl');
    expect(get).toHaveBeenCalledWith(
      'https://rdap.dns.pl/domain/google.com.pl',
    );
  });

  it('does nothing when switched off', async () => {
    const spy = jest.spyOn(axios, 'get');
    const svc = make('off');
    expect(await svc.supportedTlds()).toEqual(new Set());
    expect(await svc.rootZoneTlds()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a suspiciously small root zone list', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({ data: 'COM\nNET\n' });
    expect(await make().rootZoneTlds()).toBeNull();
  });
});

describe('buildOffers with a registry answer', () => {
  const catalog: CatalogPrice[] = [
    {
      registrar: 'ovh',
      tld: 'pl',
      registerPrice: 5,
      renewalPrice: 12,
      isPromo: true,
      currency: 'USD',
      source: 'catalog-api',
      updatedAt: new Date().toISOString(),
      stale: false,
    },
  ];
  const run = (entries: Array<[string, AvailabilityResult['status']]>) =>
    buildOffers({
      domain: 'acme',
      tld: 'pl',
      live: new Map(
        entries.map(([id, status]) => [
          id,
          { domain: 'acme', tld: 'pl', status },
        ]),
      ),
      catalog,
      enabled: new Set(['ovh', 'namecheap']),
      displayName: (id) => id.toUpperCase(),
    });

  it('prices from the catalog and marks the answer as from the registry', () => {
    const offers = run([
      ['namecheap', 'unsupported'],
      [REGISTRY_ID, 'available'],
    ]);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      registrar: 'OVH',
      status: 'available',
      price: 5,
      availabilitySource: 'registry',
    });
  });

  it('a registrar answer is not labelled', () => {
    const [offer] = run([['namecheap', 'available']]);
    expect(offer.availabilitySource).toBeUndefined();
  });
});
