import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { healthDataSchema, apiErrorPayloadSchema } from '@cinemax/shared';
import { createApp } from '../app.js';

async function withServer(
  checkDb: () => Promise<boolean>,
  run: (baseUrl: string) => Promise<void>,
) {
  const app = createApp({ checkDb });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

test('GET /api/v1/health returns 200 ok envelope when DB is connected', async () => {
  await withServer(async () => true, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: unknown };
    const parsed = healthDataSchema.parse(body.data);
    assert.equal(parsed.status, 'ok');
    assert.equal(parsed.db, 'connected');
  });
});

test('GET /api/v1/health returns 503 degraded envelope when DB is disconnected', async () => {
  await withServer(async () => false, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(res.status, 503);
    const body = (await res.json()) as { data: unknown };
    const parsed = healthDataSchema.parse(body.data);
    assert.equal(parsed.status, 'degraded');
    assert.equal(parsed.db, 'disconnected');
  });
});

test('Unknown API route returns uniform 404 JSON error envelope', async () => {
  await withServer(async () => true, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json();
    const parsed = apiErrorPayloadSchema.parse(body);
    assert.equal(parsed.error.code, 'NOT_FOUND');
  });
});
