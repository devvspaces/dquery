import { decimal, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

/** Daily reference exchange rates: how many units of `currency` one USD buys. */
export const fxRates = pgTable('fx_rates', {
  currency: varchar('currency', { length: 3 }).primaryKey(),
  perUsd: decimal('per_usd', { precision: 18, scale: 8 }).notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type FxRate = typeof fxRates.$inferSelect;
