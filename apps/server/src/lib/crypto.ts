import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
export const SESSION_TTL_DAYS = 7;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex || keyHex.length !== KEY_LENGTH * 2) return false;

  const expectedBuffer = Buffer.from(keyHex, 'hex');
  if (expectedBuffer.length !== KEY_LENGTH) return false;

  const derivedBuffer = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return timingSafeEqual(derivedBuffer, expectedBuffer);
}

export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function generateSessionToken(ttlDays = SESSION_TTL_DAYS): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
}
