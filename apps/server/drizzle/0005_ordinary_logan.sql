CREATE TYPE "public"."booking_status" AS ENUM('held', 'booked', 'paid', 'redeemed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'qris');--> statement-breakpoint
CREATE TABLE "booking_seats" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"showtime_id" integer NOT NULL,
	"seat_code" varchar(10) NOT NULL,
	"price" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_code" varchar(32) NOT NULL,
	"user_id" integer,
	"cashier_id" integer,
	"showtime_id" integer NOT NULL,
	"status" "booking_status" DEFAULT 'held' NOT NULL,
	"total_seats" integer NOT NULL,
	"total_price" integer NOT NULL,
	"payment_method" "payment_method",
	"held_expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_code_unique" UNIQUE("booking_code")
);
--> statement-breakpoint
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_showtime_id_showtimes_id_fk" FOREIGN KEY ("showtime_id") REFERENCES "public"."showtimes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_showtime_id_showtimes_id_fk" FOREIGN KEY ("showtime_id") REFERENCES "public"."showtimes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_seats_active_idx" ON "booking_seats" USING btree ("showtime_id","seat_code") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "booking_seats_booking_id_idx" ON "booking_seats" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_seats_showtime_active_idx" ON "booking_seats" USING btree ("showtime_id","is_active");--> statement-breakpoint
CREATE INDEX "bookings_showtime_status_idx" ON "bookings" USING btree ("showtime_id","status");--> statement-breakpoint
CREATE INDEX "bookings_user_id_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookings_code_idx" ON "bookings" USING btree ("booking_code");