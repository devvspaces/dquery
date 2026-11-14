export const QUEUE_NAMES = {
  DOMAIN_GENERATION: 'domain-generation',
  DOMAIN_CHECKING: 'domain-checking',
  PRICE_SYNC: 'price-sync',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
