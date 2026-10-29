CREATE TYPE "public"."studio_type" AS ENUM('regular', '3d', 'premier');--> statement-breakpoint
CREATE TABLE "movies" (
	"id" serial PRIMARY KEY NOT NULL,
	"tmdb_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"overview" text DEFAULT '' NOT NULL,
	"poster_path" varchar(255),
	"backdrop_path" varchar(255),
	"release_date" varchar(20),
	"runtime_minutes" integer DEFAULT 120 NOT NULL,
	"vote_average" real DEFAULT 0 NOT NULL,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"trailer_youtube_key" varchar(64),
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movies_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
CREATE TABLE "showtimes" (
	"id" serial PRIMARY KEY NOT NULL,
	"movie_id" integer NOT NULL,
	"studio_id" integer NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studios" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"type" "studio_type" DEFAULT 'regular' NOT NULL,
	"rows_count" integer NOT NULL,
	"cols_count" integer NOT NULL,
	"disabled_seats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_seats" integer NOT NULL,
	"base_price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studios_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movies_tmdb_id_idx" ON "movies" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "showtimes_studio_time_idx" ON "showtimes" USING btree ("studio_id","start_time","end_time");--> statement-breakpoint
CREATE INDEX "showtimes_movie_time_idx" ON "showtimes" USING btree ("movie_id","start_time");