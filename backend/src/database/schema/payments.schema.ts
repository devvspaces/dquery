import {
  pgTable,
  uuid,
  decimal,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const purchases = pgTable('purchases', {
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
  stripePaymentId: varchar('stripe_payment_id', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull(), // 'pending', 'completed', 'failed', 'refunded'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;
