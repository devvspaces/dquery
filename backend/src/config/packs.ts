export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  /** Price in USD; other currencies are derived from it. */
  usd: number;
  popular?: boolean;
}

/** Credit packs on sale. The server is the source of truth; the UI fetches these. */
export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: 'starter', label: 'Starter', credits: 10, usd: 1 },
  { id: 'standard', label: 'Standard', credits: 50, usd: 5, popular: true },
  { id: 'pro', label: 'Pro', credits: 120, usd: 10 },
  { id: 'power', label: 'Power', credits: 300, usd: 20 },
];

export function findPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

/**
 * Price of a pack in the checkout currency. USD is charged as-is; NGN uses a
 * configured rate, rounded up to the nearest ₦100 so prices look deliberate.
 */
export function packPrice(
  pack: CreditPack,
  currency: string,
  ngnPerUsd: number,
): number {
  if (currency === 'NGN') return Math.ceil((pack.usd * ngnPerUsd) / 100) * 100;
  return pack.usd;
}
