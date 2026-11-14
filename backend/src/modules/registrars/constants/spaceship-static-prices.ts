/**
 * Hand-maintained Spaceship standard prices (USD, 1 year), since Spaceship has
 * no price-list API. Synced into `tld_prices` by the daily price-sync job.
 * Rows set with `prices:set` (source "manual") take precedence over this list.
 */
export const SPACESHIP_STATIC_PRICES: Record<
  string,
  { register: number; renew: number }
> = {
  com: { register: 8.98, renew: 9.98 },
  net: { register: 10.98, renew: 12.98 },
  org: { register: 7.98, renew: 11.98 },
  io: { register: 31.98, renew: 34.98 },
  co: { register: 7.98, renew: 22.98 },
  ai: { register: 54.98, renew: 62.98 },
  app: { register: 12.98, renew: 14.98 },
  dev: { register: 10.98, renew: 12.98 },
  tech: { register: 1.98, renew: 24.98 },
  online: { register: 0.98, renew: 26.98 },
  store: { register: 1.98, renew: 38.98 },
  site: { register: 0.98, renew: 24.98 },
  xyz: { register: 0.98, renew: 9.98 },
  me: { register: 3.98, renew: 15.98 },
  info: { register: 2.98, renew: 14.98 },
  biz: { register: 3.98, renew: 15.98 },
  cloud: { register: 3.98, renew: 18.98 },
  digital: { register: 2.98, renew: 28.98 },
  studio: { register: 3.98, renew: 19.98 },
  design: { register: 1.98, renew: 38.98 },
  us: { register: 1.98, renew: 7.98 },
  uk: { register: 4.98, renew: 6.98 },
  ca: { register: 7.98, renew: 10.98 },
  au: { register: 7.98, renew: 9.98 },
};
