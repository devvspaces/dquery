CREATE TABLE "search_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"domain" varchar(63) NOT NULL,
	"tld" varchar(63) NOT NULL,
	"status" varchar(20) NOT NULL,
	"available" boolean DEFAULT false NOT NULL,
	"offers" jsonb NOT NULL,
	"best_price" numeric(10, 2),
	"best_registrar" varchar(100),
	"checked_at" timestamp NOT NULL,
	"priced_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "kind" varchar(20) DEFAULT 'generate' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "input" jsonb;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "names" jsonb;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "techniques" jsonb;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "last_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_search_id_saved_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "search_results_search_domain_tld_idx" ON "search_results" USING btree ("search_id","domain","tld");--> statement-breakpoint
CREATE INDEX "saved_searches_user_updated_idx" ON "saved_searches" USING btree ("user_id","updated_at");--> statement-breakpoint
UPDATE "saved_searches" SET "updated_at" = "created_at";--> statement-breakpoint
-- Recover names/techniques of earlier generations from the job log.
UPDATE "saved_searches" s
SET "names" = j."result"->'domains',
    "techniques" = j."result"->'techniques',
    "title" = s."business_name"
FROM "job_queue_logs" j
WHERE j."job_type" = 'generate-domains'
  AND j."result"->>'searchHistoryId' = s."id"::text
  AND s."names" IS NULL;
