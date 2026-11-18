import { categorizeTld } from '../tld-categories';
import { toTldIndex, type PublicCatalog } from '../public-catalog';

describe('categorizeTld', () => {
  it.each([
    ['com', 'Popular'],
    ['.AI', 'Popular'],
    ['tech', 'Tech'],
    ['store', 'Commerce'],
    ['ng', 'Country'],
    ['com.ng', 'Country'],
    ['co.uk', 'Country'],
    ['xyz', 'Popular'],
    ['guru', 'Other'],
  ])('%s → %s', (tld, cat) => {
    expect(categorizeTld(tld)).toBe(cat);
  });
});

describe('toTldIndex', () => {
  const row = (tld: string, registrars: number, from: number) => ({
    tld,
    registrars,
    cheapestRegister: from,
    cheapestRenewal: from,
    cheapestThreeYear: from * 3,
    threeYearSpread: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const catalog: PublicCatalog = {
    stats: { prices: 9, tlds: 4, registrars: 3 },
    tlds: [
      row('guru', 3, 4),
      row('ng', 1, 20),
      row('io', 2, 30),
      row('com', 3, 9),
    ],
  };

  it('puts popular first, then most-compared, then A–Z', () => {
    const idx = toTldIndex(catalog, new Set(['com', 'io', 'guru']));
    expect(idx.tlds.map((t) => t.tld)).toEqual(['com', 'io', 'guru', 'ng']);
    expect(idx).toMatchObject({ count: 4, checkable: 3 });
    expect(idx.tlds[3]).toEqual({
      tld: 'ng',
      from: 20,
      registrars: 1,
      category: 'Country',
      checkable: false,
    });
  });
});
