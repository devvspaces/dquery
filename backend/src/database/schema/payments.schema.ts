import {
  pgTable,
  uuid,
  decimal,
  varchar,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amountUsd: decimal('amount_usd', { precision: 10, scale: 2 }).notNull(),
    creditsPurchased: decimal('credits_purchased', {
      precision: 10,
      scale: 2,
    }).notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // 'stripe', 'usdc', etc.
    /** @deprecated unused; kept to avoid a destructive migration. */
    stripePaymentId: varchar('stripe_payment_id', { length: 255 }),
    status: varchar('status', { length: 50 }).notNull(), // 'pending', 'completed', 'failed', 'refunded'
    /** Payment provider, e.g. 'paystack'. */
    provider: varchar('provider', { length: 30 }),
    /** Our reference sent to the provider; unique so a payment is credited once. */
    providerReference: varchar('provider_reference', { length: 100 }),
    packId: varchar('pack_id', { length: 30 }),
    /** Amount charged in `currency`, in major units (e.g. 5.00 USD, 8000.00 NGN). */
    amount: decimal('amount', { precision: 12, scale: 2 }),
    currency: varchar('currency', { length: 3 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    uniqueIndex('purchases_provider_reference_unique').on(t.providerReference),
  ],
);

export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;
