import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../env.js';

test('parseEnv throws when DATABASE_URL is missing', () => {
  assert.throws(() => parseEnv({}), /DATABASE_URL/);
});

test('parseEnv parses valid environment with sensible defaults', () => {
  const env = parseEnv({
    DATABASE_URL: 'postgres://cinemax:secret@127.0.0.1:5432/cinemax_db',
  });
  assert.equal(env.PORT, 4000);
  assert.equal(env.NODE_ENV, 'development');
  assert.equal(env.CLIENT_ORIGIN, 'http://localhost:5173');
});
