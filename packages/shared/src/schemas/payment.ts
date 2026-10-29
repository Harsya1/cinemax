import { z } from 'zod';
import { PAYMENT_METHODS, STUDIO_TYPES, type StudioType } from '../enums.js';

export const POINTS_PER_TICKET_CONFIG: Record<StudioType, number> = {
  regular: 10,
  '3d': 13,
  premier: 15,
};

export function calculatePointsEarned(studioType: StudioType, seatCount: number): number {
  const rate = POINTS_PER_TICKET_CONFIG[studioType] ?? 10;
  return rate * seatCount;
}

export const paymentProcessSchema = z.object({
  bookingCode: z.string().trim().min(3),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

export type PaymentProcessInput = z.infer<typeof paymentProcessSchema>;

export const customerBookingSummarySchema = z.object({
  id: z.number().int().positive(),
  bookingCode: z.string(),
  status: z.string(),
  totalSeats: z.number(),
  totalPrice: z.number(),
  paymentMethod: z.string().nullable(),
  seatCodes: z.array(z.string()),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
  showtime: z.object({
    id: z.number(),
    startTime: z.string(),
    endTime: z.string(),
    price: z.number(),
    movieTitle: z.string(),
    posterUrl: z.string().nullable(),
    studioName: z.string(),
    studioType: z.enum(STUDIO_TYPES),
  }),
});

export type CustomerBookingSummary = z.infer<typeof customerBookingSummarySchema>;

export const customerProfileUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(120).optional(),
  phoneNumber: z
    .string()
    .trim()
    .max(25)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v && v.length > 0 ? v : null)),
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v : undefined))
    .refine((v) => v === undefined || (v.length >= 8 && v.length <= 128), {
      message: 'Password baru minimal 8 karakter',
    }),
});

export type CustomerProfileUpdateInput = z.input<typeof customerProfileUpdateSchema>;
export type ParsedCustomerProfileUpdateInput = z.output<typeof customerProfileUpdateSchema>;
