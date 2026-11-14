import {
  pgTable,
  uuid,
  varchar,
  boolean,
  decimal,
  timestamp,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const domainCache = pgTable('domain_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  domain: varchar('domain', { length: 255 }).notNull(),
  registrar: varchar('registrar', { length: 100 }).notNull(),
  available: boolean('available').notNull(),
  registerPrice: decimal('register_price', { precision: 10, scale: 2 }),
  renewalPrice: decimal('renewal_price', { precision: 10, scale: 2 }),
  checkedAt: timestamp('checked_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const domainPopularity = pgTable('domain_popularity', {
  id: uuid('id').primaryKey().defaultRandom(),
  domain: varchar('domain', { length: 255 }).notNull().unique(),
  searchCount: integer('search_count').notNull().default(1),
  lastSearched: timestamp('last_searched').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const tldPrices = pgTable(
  'tld_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    registrar: varchar('registrar', { length: 100 }).notNull(),
    tld: varchar('tld', { length: 20 }).notNull(),
    registerPrice: decimal('register_price', {
      precision: 10,
      scale: 2,
    }).notNull(),
    renewalPrice: decimal('renewal_price', {
      precision: 10,
      scale: 2,
    }).notNull(),
    transferPrice: decimal('transfer_price', { precision: 10, scale: 2 }),
    /** Regular first-year price when register_price is a promo. */
    regularRegisterPrice: decimal('regular_register_price', {
      precision: 10,
      scale: 2,
    }),
    isPromo: boolean('is_promo').notNull().default(false),
    /** catalog-api | catalog-static | manual. Manual rows are never overwritten by sync. */
    source: varchar('source', { length: 20 }).notNull().default('catalog-api'),
    currency: varchar('currency', { length: 10 }).notNull().default('USD'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      registrarTldIdx: uniqueIndex('registrar_tld_idx').on(
        table.registrar,
        table.tld,
      ),
    };
  },
);

export type DomainCache = typeof domainCache.$inferSelect;
export type NewDomainCache = typeof domainCache.$inferInsert;
export type DomainPopularity = typeof domainPopularity.$inferSelect;
export type NewDomainPopularity = typeof domainPopularity.$inferInsert;
export type TldPrice = typeof tldPrices.$inferSelect;
export type NewTldPrice = typeof tldPrices.$inferInsert;
