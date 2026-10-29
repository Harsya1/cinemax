import { z } from 'zod';

export const healthDataSchema = z.object({
  service: z.literal('cinemax-api'),
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['connected', 'disconnected']),
  latencyMs: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export type HealthData = z.infer<typeof healthDataSchema>;

export const apiErrorPayloadSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorPayload = z.infer<typeof apiErrorPayloadSchema>;

export interface ApiSuccessPayload<T> {
  data: T;
  meta?: Record<string, unknown>;
}
