ALTER TABLE "purchases" ADD COLUMN "provider" varchar(30);--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "provider_reference" varchar(100);--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "pack_id" varchar(30);--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_provider_reference_unique" ON "purchases" USING btree ("provider_reference");