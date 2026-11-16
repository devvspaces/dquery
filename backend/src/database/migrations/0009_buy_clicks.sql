CREATE TABLE "buy_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registrar" varchar(50) NOT NULL,
	"tld" varchar(63) NOT NULL,
	"affiliate" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "buy_clicks_created_at_idx" ON "buy_clicks" USING btree ("created_at");