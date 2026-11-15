import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from 'drizzle-orm/pg-core';

/** Runtime settings edited in the admin panel; they override .env defaults. */
export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Every change an admin makes: who, what, to what, with details. */
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminEmail: varchar('admin_email', { length: 255 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    target: varchar('target', { length: 255 }),
    details: jsonb('details'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('admin_audit_log_created_at_idx').on(t.createdAt)],
);

/** One row per registrar per price-sync run. */
export const priceSyncRuns = pgTable(
  'price_sync_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    registrar: varchar('registrar', { length: 50 }).notNull(),
    ok: boolean('ok').notNull(),
    count: integer('count').notNull().default(0),
    error: text('error'),
    durationMs: integer('duration_ms').notNull().default(0),
    startedAt: timestamp('started_at').notNull().defaultNow(),
  },
  (t) => [index('price_sync_runs_started_at_idx').on(t.startedAt)],
);

export type AppSetting = typeof appSettings.$inferSelect;
export type AdminAuditEntry = typeof adminAuditLog.$inferSelect;
export type PriceSyncRun = typeof priceSyncRuns.$inferSelect;
