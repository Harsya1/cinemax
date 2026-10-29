import { z } from 'zod';
import { STUDIO_TYPES } from '../enums.js';

export const ticketScanInputSchema = z.object({
  bookingCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'Kode booking wajib diisi'),
});

export type TicketScanInput = z.infer<typeof ticketScanInputSchema>;

export const ticketScanResultSchema = z.object({
  result: z.enum([
    'valid',
    'already_redeemed',
    'invalid_status',
    'not_found',
    'wrong_schedule',
  ]),
  message: z.string(),
  ticket: z
    .object({
      bookingCode: z.string(),
      movieTitle: z.string(),
      studioName: z.string(),
      studioType: z.enum(STUDIO_TYPES),
      startTime: z.string(),
      seatCodes: z.array(z.string()),
      totalSeats: z.number().int(),
      redeemedAt: z.string().nullable(),
      redeemedByName: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export type TicketScanResult = z.infer<typeof ticketScanResultSchema>;
