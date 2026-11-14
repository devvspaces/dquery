import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  domain: varchar('domain', { length: 255 }).notNull(),
  extension: varchar('extension', { length: 50 }).notNull(),
  pricesSnapshot: text('prices_snapshot'), // JSON string of prices at time of bookmark
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
