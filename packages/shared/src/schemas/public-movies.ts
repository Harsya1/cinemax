import { z } from 'zod';
import { STUDIO_TYPES } from '../enums.js';

export const publicMovieSummarySchema = z.object({
  id: z.number().int().positive(),
  tmdbId: z.number().int().positive(),
  title: z.string(),
  overview: z.string(),
  posterUrl: z.string().nullable(),
  backdropUrl: z.string().nullable(),
  releaseDate: z.string().nullable(),
  voteAverage: z.number(),
  runtimeMinutes: z.number(),
  genres: z.array(z.string()),
  activeShowtimeCount: z.number().nonnegative(),
});

export type PublicMovieSummary = z.infer<typeof publicMovieSummarySchema>;

export const publicNowPlayingResponseSchema = z.object({
  heroMovie: publicMovieSummarySchema.nullable(),
  movies: z.array(publicMovieSummarySchema),
});

export type PublicNowPlayingResponse = z.infer<typeof publicNowPlayingResponseSchema>;

export const publicComingSoonResponseSchema = z.object({
  movies: z.array(publicMovieSummarySchema),
});

export type PublicComingSoonResponse = z.infer<typeof publicComingSoonResponseSchema>;

export const publicShowtimeSlotSchema = z.object({
  id: z.number().int().positive(),
  studioId: z.number().int().positive(),
  studioName: z.string(),
  studioType: z.enum(STUDIO_TYPES),
  startTime: z.string(),
  endTime: z.string(),
  price: z.number().int().positive(),
  availableSeatsCount: z.number().int().nonnegative(),
});

export type PublicShowtimeSlot = z.infer<typeof publicShowtimeSlotSchema>;

export const publicShowtimeDateGroupSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  dateLabel: z.string(),
  showtimes: z.array(publicShowtimeSlotSchema),
});

export type PublicShowtimeDateGroup = z.infer<typeof publicShowtimeDateGroupSchema>;

export const publicMovieDetailSchema = z.object({
  id: z.number().int().positive(),
  tmdbId: z.number().int().positive(),
  title: z.string(),
  overview: z.string(),
  posterUrl: z.string().nullable(),
  backdropUrl: z.string().nullable(),
  releaseDate: z.string().nullable(),
  runtimeMinutes: z.number(),
  voteAverage: z.number(),
  genres: z.array(z.string()),
  trailerYoutubeKey: z.string().nullable(),
  isInWatchlist: z.boolean(),
  showtimeDates: z.array(publicShowtimeDateGroupSchema),
});

export type PublicMovieDetail = z.infer<typeof publicMovieDetailSchema>;

export const watchlistToggleSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
});

export type WatchlistToggleInput = z.infer<typeof watchlistToggleSchema>;

export const watchlistRowSchema = z.object({
  id: z.number().int().positive(),
  tmdbId: z.number().int().positive(),
  title: z.string(),
  posterUrl: z.string().nullable(),
  overview: z.string().nullable(),
  voteAverage: z.number(),
  releaseDate: z.string().nullable(),
  createdAt: z.string(),
});

export type WatchlistRow = z.infer<typeof watchlistRowSchema>;
