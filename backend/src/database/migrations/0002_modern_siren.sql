ALTER TABLE "tld_prices" ADD COLUMN "transfer_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "tld_prices" ADD COLUMN "regular_register_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "tld_prices" ADD COLUMN "is_promo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tld_prices" ADD COLUMN "source" varchar(20) DEFAULT 'catalog-api' NOT NULL;