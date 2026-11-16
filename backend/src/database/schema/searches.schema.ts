import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/**
 * A user's search: what they asked for, the names it produced, and (via
 * search_results) every domain checked for it, so it can be reopened later.
 */
export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'generate' (names were generated) or 'check' (typed name/domain). */
    kind: varchar('kind', { length: 20 }).notNull().default('generate'),
    title: varchar('title', { length: 255 }),
    businessName: varchar('business_name', { length: 255 }).notNull(),
    description: text('description'),
    tlds: text('tlds').notNull(), // JSON array of selected TLDs
    /** Generation input (engine, style, word-engine config) for "more names". */
    input: jsonb('input'),
    /** Generated (and user-added) names, in display order. */
    names: jsonb('names').$type<string[]>(),
    /** Word engine: name → technique. */
    techniques: jsonb('techniques').$type<Record<string, string>>(),
    resultsCount: integer('results_count').notNull().default(0),
    pinned: boolean('pinned').notNull().default(false),
    lastCheckedAt: timestamp('last_checked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('saved_searches_user_updated_idx').on(t.userId, t.updatedAt)],
);

/** One checked domain within a saved search (latest result wins). */
export const searchResults = pgTable(
  'search_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    searchId: uuid('search_id')
      .notNull()
      .references(() => savedSearches.id, { onDelete: 'cascade' }),
    domain: varchar('domain', { length: 63 }).notNull(),
    tld: varchar('tld', { length: 63 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    available: boolean('available').notNull().default(false),
    /** Offers per registrar, as returned by the checker. */
    offers: jsonb('offers').notNull(),
    bestPrice: numeric('best_price', { precision: 10, scale: 2 }),
    bestRegistrar: varchar('best_registrar', { length: 100 }),
    /** When availability was last checked live. */
    checkedAt: timestamp('checked_at').notNull(),
    /** When prices were last refreshed from the catalog. */
    pricedAt: timestamp('priced_at').notNull(),
  },
  (t) => [
    uniqueIndex('search_results_search_domain_tld_idx').on(
      t.searchId,
      t.domain,
      t.tld,
    ),
  ],
);

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
export type SearchResultRow = typeof searchResults.$inferSelect;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
