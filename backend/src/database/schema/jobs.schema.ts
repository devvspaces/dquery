import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  text,
  decimal,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const jobQueueLogs = pgTable('job_queue_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  jobId: varchar('job_id', { length: 255 }).notNull().unique(),
  queueName: varchar('queue_name', { length: 100 }).notNull(),
  jobType: varchar('job_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('queued'), // 'queued' | 'active' | 'completed' | 'failed'
  data: jsonb('data'), // Job input data
  result: jsonb('result'), // Job output data
  error: text('error'),
  creditsDeducted: decimal('credits_deducted', {
    precision: 10,
    scale: 2,
  }).default('0'),
  creditsRefunded: decimal('credits_refunded', {
    precision: 10,
    scale: 2,
  }).default('0'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type JobQueueLog = typeof jobQueueLogs.$inferSelect;
export type NewJobQueueLog = typeof jobQueueLogs.$inferInsert;
