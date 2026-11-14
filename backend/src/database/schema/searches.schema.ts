import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const savedSearches = pgTable('saved_searches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  description: text('description'),
  tlds: text('tlds').notNull(), // JSON array of selected TLDs
  resultsCount: integer('results_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const searchHistory = pgTable('search_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  searchType: varchar('search_type', { length: 50 }).notNull(), // 'generate', 'check'
  query: text('query').notNull(), // JSON string of search parameters
  resultsCount: integer('results_count').notNull(),
  creditsUsed: integer('credits_used').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type SavedSearch = typeof savedSearches.$inferSelect;
export type NewSavedSearch = typeof savedSearches.$inferInsert;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
