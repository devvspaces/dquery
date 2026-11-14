import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const apiUsageLogs = pgTable('api_usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(),
  statusCode: integer('status_code').notNull(),
  responseTime: integer('response_time').notNull(), // in milliseconds
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const registrarApiLogs = pgTable('registrar_api_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  registrar: varchar('registrar', { length: 100 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  success: boolean('success').notNull(),
  responseTime: integer('response_time').notNull(), // in milliseconds
  errorMessage: varchar('error_message', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const llmUsageLogs = pgTable('llm_usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  provider: varchar('provider', { length: 50 }).notNull(), // 'openai', 'anthropic'
  model: varchar('model', { length: 100 }).notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  estimatedCost: integer('estimated_cost').notNull(), // in cents
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type NewApiUsageLog = typeof apiUsageLogs.$inferInsert;
export type RegistrarApiLog = typeof registrarApiLogs.$inferSelect;
export type NewRegistrarApiLog = typeof registrarApiLogs.$inferInsert;
export type LlmUsageLog = typeof llmUsageLogs.$inferSelect;
export type NewLlmUsageLog = typeof llmUsageLogs.$inferInsert;
