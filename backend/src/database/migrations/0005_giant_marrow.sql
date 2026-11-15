CREATE TABLE "fx_rates" (
	"currency" varchar(3) PRIMARY KEY NOT NULL,
	"per_usd" numeric(18, 8) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
