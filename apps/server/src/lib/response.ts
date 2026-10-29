import type { Response } from 'express';
import type { ApiSuccessPayload } from '@cinemax/shared';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>,
): Response {
  const payload: ApiSuccessPayload<T> = meta ? { data, meta } : { data };
  return res.status(statusCode).json(payload);
}
