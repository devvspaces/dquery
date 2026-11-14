import {
  pgTable,
  uuid,
  decimal,
  timestamp,
  varchar,
  text,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const credits = pgTable('credits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  balance: decimal('balance', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  totalPurchased: decimal('total_purchased', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  totalUsed: decimal('total_used', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'purchase', 'deduction', 'refund', 'bonus'
  description: text('description').notNull(),
  balanceBefore: decimal('balance_before', {
    precision: 10,
    scale: 2,
  }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  metadata: text('metadata'), // JSON string for additional data
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Credit = typeof credits.$inferSelect;
export type NewCredit = typeof credits.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
