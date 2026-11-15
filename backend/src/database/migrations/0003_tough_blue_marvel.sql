ALTER TABLE "credit_transactions" ADD COLUMN "idempotency_key" varchar(191);--> statement-breakpoint
CREATE UNIQUE INDEX "credit_transactions_idempotency_key_unique" ON "credit_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "credits_user_id_unique" ON "credits" USING btree ("user_id");