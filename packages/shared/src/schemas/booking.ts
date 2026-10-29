import { z } from 'zod';
import { BOOKING_STATUSES, PAYMENT_METHODS, STUDIO_TYPES } from '../enums.js';

export const holdSeatsInputSchema = z.object({
  showtimeId: z.coerce.number().int().positive('Showtime wajib dipilih'),
  seatCodes: z
    .array(z.string().trim().toUpperCase())
    .min(1, 'Pilih minimal 1 kursi')
    .max(6, 'Maksimal 6 kursi per transaksi')
    .refine((seats) => new Set(seats).size === seats.length, {
      message: 'Kursi tidak boleh duplikat',
    }),
});

export type HoldSeatsInput = z.infer<typeof holdSeatsInputSchema>;

export const seatStatusEnum = z.enum(['available', 'selected', 'occupied', 'held', 'disabled']);
export type SeatStatus = z.infer<typeof seatStatusEnum>;

export const seatSlotSchema = z.object({
  code: z.string(),
  row: z.string(),
  col: z.number().int().positive(),
  status: seatStatusEnum,
  price: z.number().int().positive(),
});

export type SeatSlot = z.infer<typeof seatSlotSchema>;

export const seatMapResponseSchema = z.object({
  showtime: z.object({
    id: z.number().int().positive(),
    startTime: z.string(),
    endTime: z.string(),
    price: z.number().int().positive(),
    movie: z.object({
      id: z.number(),
      tmdbId: z.number(),
      title: z.string(),
      posterUrl: z.string().nullable(),
      runtimeMinutes: z.number(),
    }),
  }),
  studio: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    type: z.enum(STUDIO_TYPES),
    rowsCount: z.number().int().positive(),
    colsCount: z.number().int().positive(),
    totalSeats: z.number().int().positive(),
  }),
  seats: z.array(seatSlotSchema),
  heldExpiresInSeconds: z.number().int().nonnegative().optional(),
});

export type SeatMapResponse = z.infer<typeof seatMapResponseSchema>;

export const bookingDetailSchema = z.object({
  id: z.number().int().positive(),
  bookingCode: z.string(),
  showtimeId: z.number().int().positive(),
  userId: z.number().nullable(),
  status: z.enum(BOOKING_STATUSES),
  totalSeats: z.number().int().positive(),
  totalPrice: z.number().int().positive(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  seatCodes: z.array(z.string()),
  heldExpiresAt: z.string().nullable(),
  remainingSeconds: z.number().int().nonnegative(),
  showtime: z.object({
    startTime: z.string(),
    endTime: z.string(),
    movieTitle: z.string(),
    posterUrl: z.string().nullable(),
    studioName: z.string(),
    studioType: z.enum(STUDIO_TYPES),
  }),
});

export type BookingDetail = z.infer<typeof bookingDetailSchema>;
