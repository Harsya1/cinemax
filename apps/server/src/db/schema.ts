import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  STUDIO_TYPES,
  USER_ROLES,
} from '@cinemax/shared';

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const studioTypeEnum = pgEnum('studio_type', STUDIO_TYPES);
export const bookingStatusEnum = pgEnum('booking_status', BOOKING_STATUSES);
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  phoneNumber: varchar('phone_number', { length: 25 }),
  dateOfBirth: date('date_of_birth'),
  role: userRoleEnum('role').notNull().default('user'),
  points: integer('points').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 80 }).notNull(),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetId: varchar('target_id', { length: 50 }),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_created_at_idx').on(t.createdAt),
    index('audit_logs_action_idx').on(t.action),
  ],
);

export const studios = pgTable('studios', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 80 }).notNull().unique(),
  type: studioTypeEnum('type').notNull().default('regular'),
  rowsCount: integer('rows_count').notNull(),
  colsCount: integer('cols_count').notNull(),
  disabledSeats: jsonb('disabled_seats').$type<string[]>().notNull().default([]),
  totalSeats: integer('total_seats').notNull(),
  basePrice: integer('base_price').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const movies = pgTable(
  'movies',
  {
    id: serial('id').primaryKey(),
    tmdbId: integer('tmdb_id').notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    overview: text('overview').notNull().default(''),
    posterPath: varchar('poster_path', { length: 255 }),
    backdropPath: varchar('backdrop_path', { length: 255 }),
    releaseDate: varchar('release_date', { length: 20 }),
    runtimeMinutes: integer('runtime_minutes').notNull().default(120),
    voteAverage: real('vote_average').notNull().default(0),
    genres: jsonb('genres').$type<string[]>().notNull().default([]),
    trailerYoutubeKey: varchar('trailer_youtube_key', { length: 64 }),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('movies_tmdb_id_idx').on(t.tmdbId)],
);

export const showtimes = pgTable(
  'showtimes',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'restrict' }),
    studioId: integer('studio_id')
      .notNull()
      .references(() => studios.id, { onDelete: 'restrict' }),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    price: integer('price').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('showtimes_studio_time_idx').on(t.studioId, t.startTime, t.endTime),
    index('showtimes_movie_time_idx').on(t.movieId, t.startTime),
  ],
);

export const watchlists = pgTable(
  'watchlists',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tmdbId: integer('tmdb_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    posterPath: varchar('poster_path', { length: 255 }),
    overview: text('overview'),
    voteAverage: real('vote_average').notNull().default(0),
    releaseDate: varchar('release_date', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('watchlists_user_tmdb_unique_idx').on(t.userId, t.tmdbId),
    index('watchlists_user_id_idx').on(t.userId),
  ],
);

export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    bookingCode: varchar('booking_code', { length: 32 }).notNull().unique(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    cashierId: integer('cashier_id').references(() => users.id, { onDelete: 'set null' }),
    showtimeId: integer('showtime_id')
      .notNull()
      .references(() => showtimes.id, { onDelete: 'restrict' }),
    status: bookingStatusEnum('status').notNull().default('held'),
    totalSeats: integer('total_seats').notNull(),
    totalPrice: integer('total_price').notNull(),
    paymentMethod: paymentMethodEnum('payment_method'),
    heldExpiresAt: timestamp('held_expires_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bookings_showtime_status_idx').on(t.showtimeId, t.status),
    index('bookings_user_id_idx').on(t.userId),
    index('bookings_code_idx').on(t.bookingCode),
  ],
);

export const bookingSeats = pgTable(
  'booking_seats',
  {
    id: serial('id').primaryKey(),
    bookingId: integer('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    showtimeId: integer('showtime_id')
      .notNull()
      .references(() => showtimes.id, { onDelete: 'restrict' }),
    seatCode: varchar('seat_code', { length: 10 }).notNull(),
    price: integer('price').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('booking_seats_active_idx')
      .on(t.showtimeId, t.seatCode)
      .where(sql`is_active = true`),
    index('booking_seats_booking_id_idx').on(t.bookingId),
    index('booking_seats_showtime_active_idx').on(t.showtimeId, t.isActive),
  ],
);
