/**
 * Groups for the extension picker. Curated sets for the well-known ones;
 * everything else is a country code (ccTLD, incl. second-level like com.ng)
 * or "Other".
 */
export type TldCategory =
  | 'Popular'
  | 'Tech'
  | 'Business'
  | 'Creative'
  | 'Commerce'
  | 'Country'
  | 'Other';

const CURATED: Record<Exclude<TldCategory, 'Country' | 'Other'>, string[]> = {
  Popular: [
    'com',
    'net',
    'org',
    'io',
    'co',
    'ai',
    'dev',
    'app',
    'xyz',
    'me',
    'info',
  ],
  Tech: [
    'tech',
    'cloud',
    'digital',
    'software',
    'systems',
    'codes',
    'network',
    'data',
    'host',
    'hosting',
    'computer',
    'technology',
    'online',
    'site',
    'website',
    'page',
    'link',
    'web',
    'bot',
    'build',
    'tools',
    'engineering',
  ],
  Business: [
    'biz',
    'company',
    'agency',
    'consulting',
    'services',
    'solutions',
    'group',
    'team',
    'enterprises',
    'partners',
    'ventures',
    'capital',
    'finance',
    'llc',
    'inc',
    'ltd',
    'pro',
    'business',
    'work',
    'works',
    'global',
    'world',
  ],
  Creative: [
    'design',
    'studio',
    'art',
    'media',
    'gallery',
    'photography',
    'graphics',
    'blog',
    'news',
    'live',
    'music',
    'film',
    'video',
    'audio',
    'fm',
    'tv',
    'space',
    'ink',
    'social',
    'fun',
  ],
  Commerce: [
    'store',
    'shop',
    'market',
    'buy',
    'sale',
    'deals',
    'discount',
    'boutique',
    'shopping',
    'supply',
    'trade',
    'money',
    'pay',
    'delivery',
    'fashion',
  ],
};

const BY_TLD = new Map<string, TldCategory>();
for (const [cat, tlds] of Object.entries(CURATED))
  for (const t of tlds) if (!BY_TLD.has(t)) BY_TLD.set(t, cat as TldCategory);

/** Popular ones in this order; used to sort the picker. */
export const POPULAR_ORDER = CURATED.Popular;

export function categorizeTld(raw: string): TldCategory {
  const tld = raw.toLowerCase().replace(/^\./, '');
  const curated = BY_TLD.get(tld);
  if (curated) return curated;
  const parts = tld.split('.');
  const top = parts[parts.length - 1];
  // ccTLDs are exactly two letters; "com.ng", "co.uk" belong to their country.
  if (/^[a-z]{2}$/.test(top)) return 'Country';
  return 'Other';
}
