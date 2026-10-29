import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
} from '../lib/crypto.js';
import { parseCookies, serializeSessionCookie } from '../lib/cookies.js';

test('hashPassword uses random salt and verifyPassword validates timing-safely', async () => {
  const h1 = await hashPassword('Cinemax123!');
  const h2 = await hashPassword('Cinemax123!');
  assert.notEqual(h1, h2);
  assert.equal(await verifyPassword('Cinemax123!', h1), true);
  assert.equal(await verifyPassword('WrongPass!', h1), false);
  assert.equal(await verifyPassword('Cinemax123!', 'malformed-hash'), false);
});

test('generateSessionToken produces 64-hex SHA-256 tokenHash distinct from rawToken', () => {
  const session = generateSessionToken();
  assert.ok(session.rawToken.length >= 40);
  assert.equal(session.tokenHash.length, 64);
  assert.notEqual(session.rawToken, session.tokenHash);
  assert.equal(hashSessionToken(session.rawToken), session.tokenHash);
  assert.ok(session.expiresAt.getTime() > Date.now());
});

test('parseCookies and serializeSessionCookie handle HttpOnly and malformed encodings safely', () => {
  const parsed = parseCookies('foo=bar; cx_session=abc_123; broken=%E0%A4%A');
  assert.equal(parsed.foo, 'bar');
  assert.equal(parsed.cx_session, 'abc_123');
  assert.equal(parsed.broken, '%E0%A4%A');

  const header = serializeSessionCookie('raw_tok', 3600, true);
  assert.match(header, /cx_session=raw_tok/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Secure/);
});
