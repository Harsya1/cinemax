import { z } from 'zod';
import { STUDIO_TYPES } from '../enums.js';

export function getRowLetter(rowIndex: number): string {
  return String.fromCharCode(65 + rowIndex);
}

export function parseSeatCode(seatCode: string): { row: string; col: number } | null {
  const match = /^([A-Z])([1-9][0-9]?)$/.exec(seatCode.toUpperCase());
  if (!match) return null;
  return {
    row: match[1]!,
    col: Number(match[2]),
  };
}

export function isSeatWithinGrid(
  seatCode: string,
  rowsCount: number,
  colsCount: number,
): boolean {
  const parsed = parseSeatCode(seatCode);
  if (!parsed) return false;
  const rowIndex = parsed.row.charCodeAt(0) - 65;
  return rowIndex >= 0 && rowIndex < rowsCount && parsed.col >= 1 && parsed.col <= colsCount;
}

export function sanitizeDisabledSeats(
  disabledSeats: string[],
  rowsCount: number,
  colsCount: number,
): string[] {
  const unique = new Set<string>();
  for (const seat of disabledSeats) {
    const trimmed = seat.trim().toUpperCase();
    if (isSeatWithinGrid(trimmed, rowsCount, colsCount)) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique).sort();
}

export function generateStudioSeatCodes(
  rowsCount: number,
  colsCount: number,
  disabledSeats: string[] = [],
): string[] {
  const disabledSet = new Set(disabledSeats.map((s) => s.trim().toUpperCase()));
  const seats: string[] = [];
  for (let r = 0; r < rowsCount; r++) {
    const letter = getRowLetter(r);
    for (let c = 1; c <= colsCount; c++) {
      const code = `${letter}${c}`;
      if (!disabledSet.has(code)) {
        seats.push(code);
      }
    }
  }
  return seats;
}

export function buildTmdbImageUrl(
  path: string | null | undefined,
  size: 'w92' | 'w185' | 'w342' | 'w500' | 'w1280' | 'original' = 'w500',
): string | null {
  if (!path) return null;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `https://image.tmdb.org/t/p/${size}${cleanPath}`;
}

export const studioRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  type: z.enum(STUDIO_TYPES),
  rowsCount: z.number().int().min(1).max(26),
  colsCount: z.number().int().min(1).max(24),
  disabledSeats: z.array(z.string()),
  totalSeats: z.number().int().nonnegative(),
  basePrice: z.number().int().positive(),
  createdAt: z.string(),
});

export type StudioRow = z.infer<typeof studioRowSchema>;

export const createStudioSchema = z
  .object({
    name: z.string().trim().min(2, 'Nama studio minimal 2 karakter').max(80),
    type: z.enum(STUDIO_TYPES),
    rowsCount: z.coerce.number().int().min(1).max(26),
    colsCount: z.coerce.number().int().min(1).max(24),
    disabledSeats: z.array(z.string()).default([]),
    basePrice: z.coerce.number().int().positive('Harga dasar harus lebih besar dari 0'),
  })
  .transform((data) => ({
    ...data,
    disabledSeats: sanitizeDisabledSeats(data.disabledSeats, data.rowsCount, data.colsCount),
    totalSeats: data.rowsCount * data.colsCount - sanitizeDisabledSeats(data.disabledSeats, data.rowsCount, data.colsCount).length,
  }));

export type CreateStudioInput = z.input<typeof createStudioSchema>;
export type ParsedCreateStudioInput = z.output<typeof createStudioSchema>;

export const updateStudioSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    type: z.enum(STUDIO_TYPES).optional(),
    rowsCount: z.coerce.number().int().min(1).max(26).optional(),
    colsCount: z.coerce.number().int().min(1).max(24).optional(),
    disabledSeats: z.array(z.string()).optional(),
    basePrice: z.coerce.number().int().positive().optional(),
  });

export type UpdateStudioInput = z.input<typeof updateStudioSchema>;
export type ParsedUpdateStudioInput = z.output<typeof updateStudioSchema>;

export const tmdbBrowseQuerySchema = z.object({
  category: z.enum(['now_playing', 'upcoming', 'popular']).default('now_playing'),
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  page: z.coerce.number().int().positive().default(1),
});

export type TmdbBrowseQuery = z.infer<typeof tmdbBrowseQuerySchema>;

export const tmdbMovieSummarySchema = z.object({
  tmdbId: z.number().int().positive(),
  title: z.string(),
  overview: z.string(),
  posterPath: z.string().nullable(),
  posterUrl: z.string().nullable(),
  backdropPath: z.string().nullable(),
  backdropUrl: z.string().nullable(),
  releaseDate: z.string().nullable(),
  voteAverage: z.number(),
  isSynced: z.boolean(),
  localMovieId: z.number().nullable(),
});

export type TmdbMovieSummary = z.infer<typeof tmdbMovieSummarySchema>;
export type TmdbBrowseItem = TmdbMovieSummary;

export const movieRowSchema = z.object({
  id: z.number().int().positive(),
  tmdbId: z.number().int().positive(),
  title: z.string(),
  overview: z.string(),
  posterPath: z.string().nullable(),
  posterUrl: z.string().nullable(),
  backdropPath: z.string().nullable(),
  backdropUrl: z.string().nullable(),
  releaseDate: z.string().nullable(),
  runtimeMinutes: z.number().int().positive(),
  voteAverage: z.number(),
  genres: z.array(z.string()),
  trailerYoutubeKey: z.string().nullable(),
  syncedAt: z.string(),
});

export type MovieRow = z.infer<typeof movieRowSchema>;

export const syncMovieInputSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
});

export type SyncMovieInput = z.infer<typeof syncMovieInputSchema>;

export const showtimeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  studioId: z.coerce.number().int().positive().optional(),
  timeFilter: z.enum(['all', 'upcoming', 'today']).default('all'),
});

export type ShowtimeListQuery = z.infer<typeof showtimeListQuerySchema>;

export const createShowtimeSchema = z
  .object({
    movieId: z.coerce.number().int().positive().optional(),
    tmdbId: z.coerce.number().int().positive().optional(),
    studioId: z.coerce.number().int().positive('Studio wajib dipilih'),
    startTime: z.string().datetime({ message: 'Format waktu mulai tidak valid (ISO datetime)' }),
    endTime: z.string().datetime({ message: 'Format waktu selesai tidak valid (ISO datetime)' }).optional(),
    price: z.coerce.number().int().positive('Harga tiket harus valid').optional(),
  })
  .refine((data) => Boolean(data.movieId || data.tmdbId), {
    message: 'movieId atau tmdbId harus disertakan',
    path: ['tmdbId'],
  });

export type CreateShowtimeInput = z.input<typeof createShowtimeSchema>;
export type ParsedCreateShowtimeInput = z.output<typeof createShowtimeSchema>;

export const updateShowtimeSchema = z.object({
  studioId: z.coerce.number().int().positive().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  price: z.coerce.number().int().positive().optional(),
});

export type UpdateShowtimeInput = z.input<typeof updateShowtimeSchema>;
export type ParsedUpdateShowtimeInput = z.output<typeof updateShowtimeSchema>;

export const showtimeRowSchema = z.object({
  id: z.number().int().positive(),
  movieId: z.number().int().positive(),
  studioId: z.number().int().positive(),
  startTime: z.string(),
  endTime: z.string(),
  price: z.number().int().positive(),
  status: z.enum(['upcoming', 'playing', 'ended']),
  movie: z.object({
    id: z.number(),
    tmdbId: z.number(),
    title: z.string(),
    posterUrl: z.string().nullable(),
    runtimeMinutes: z.number(),
  }),
  studio: z.object({
    id: z.number(),
    name: z.string(),
    type: z.enum(STUDIO_TYPES),
    totalSeats: z.number(),
  }),
});

export type ShowtimeRow = z.infer<typeof showtimeRowSchema>;
