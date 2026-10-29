import { Router } from 'express';
import type { HealthData } from '@cinemax/shared';
import { sendSuccess } from '../lib/response.js';

export function createHealthRouter(checkDb: () => Promise<boolean>): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const startedAt = performance.now();
    const isConnected = await checkDb();
    const latencyMs = Math.round(performance.now() - startedAt);

    const payload: HealthData = {
      service: 'cinemax-api',
      status: isConnected ? 'ok' : 'degraded',
      db: isConnected ? 'connected' : 'disconnected',
      latencyMs,
      timestamp: new Date().toISOString(),
    };

    sendSuccess(res, payload, isConnected ? 200 : 503);
  });

  return router;
}
