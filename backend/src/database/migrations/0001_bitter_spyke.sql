CREATE TABLE "tld_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registrar" varchar(100) NOT NULL,
	"tld" varchar(20) NOT NULL,
	"register_price" numeric(10, 2) NOT NULL,
	"renewal_price" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "registrar_tld_idx" ON "tld_prices" USING btree ("registrar","tld");