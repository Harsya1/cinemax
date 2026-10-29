CREATE TABLE "watchlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tmdb_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"poster_path" varchar(255),
	"overview" text,
	"vote_average" real DEFAULT 0 NOT NULL,
	"release_date" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watchlists_user_tmdb_unique_idx" ON "watchlists" USING btree ("user_id","tmdb_id");--> statement-breakpoint
CREATE INDEX "watchlists_user_id_idx" ON "watchlists" USING btree ("user_id");