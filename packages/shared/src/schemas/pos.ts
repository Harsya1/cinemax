import { z } from 'zod';
import { PAYMENT_METHODS, STUDIO_TYPES } from '../enums.js';

export const posCheckoutInputSchema = z.object({
  showtimeId: z.coerce.number().int().positive('Showtime wajib dipilih'),
  seatCodes: z
    .array(z.string().trim().toUpperCase())
    .min(1, 'Pilih minimal 1 kursi')
    .max(10, 'Maksimal 10 kursi per transaksi kasir')
    .refine((seats) => new Set(seats).size === seats.length, {
      message: 'Kursi tidak boleh duplikat',
    }),
  paymentMethod: z.enum(PAYMENT_METHODS),
  amountPaid: z.coerce.number().int().nonnegative().optional(),
  memberEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email member tidak valid')
    .optional()
    .or(z.literal('')),
});

export type PosCheckoutInput = z.infer<typeof posCheckoutInputSchema>;

export const posTodayShowtimeSchema = z.object({
  id: z.number().int().positive(),
  movieId: z.number().int().positive(),
  movieTitle: z.string(),
  posterUrl: z.string().nullable(),
  runtimeMinutes: z.number().int(),
  studioId: z.number().int().positive(),
  studioName: z.string(),
  studioType: z.enum(STUDIO_TYPES),
  startTime: z.string(),
  endTime: z.string(),
  price: z.number().int().positive(),
  totalSeats: z.number().int().positive(),
  availableSeatsCount: z.number().int().nonnegative(),
});

export type PosTodayShowtime = z.infer<typeof posTodayShowtimeSchema>;

export const posTicketStubSchema = z.object({
  bookingCode: z.string(),
  movieTitle: z.string(),
  studioName: z.string(),
  studioType: z.enum(STUDIO_TYPES),
  dateFormatted: z.string(),
  timeFormatted: z.string(),
  seatCodes: z.array(z.string()),
  totalSeats: z.number().int().positive(),
  totalPrice: z.number().int().positive(),
  paymentMethod: z.string(),
  cashierName: z.string(),
  paidAtFormatted: z.string(),
  qrUrl: z.string(),
});

export type PosTicketStub = z.infer<typeof posTicketStubSchema>;

export const posCheckoutResultSchema = z.object({
  bookingCode: z.string(),
  totalPrice: z.number().int().positive(),
  amountPaid: z.number().int().nonnegative(),
  change: z.number().int().nonnegative(),
  seatCodes: z.array(z.string()),
  pointsEarned: z.number().int().nonnegative(),
  stub: posTicketStubSchema,
});

export type PosCheckoutResult = z.infer<typeof posCheckoutResultSchema>;
