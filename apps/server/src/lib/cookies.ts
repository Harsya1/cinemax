import type { Response } from 'express';
import { SESSION_TTL_DAYS } from './crypto.js';

export const SESSION_COOKIE_NAME = 'cx_session';
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const rawVal = part.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(rawVal);
    } catch {
      result[key] = rawVal;
    }
  }
  return result;
}

export function serializeSessionCookie(
  rawToken: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  const directives = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) directives.push('Secure');
  return directives.join('; ');
}

export function setSessionCookie(res: Response, rawToken: string, secure: boolean): void {
  res.setHeader(
    'Set-Cookie',
    serializeSessionCookie(rawToken, SESSION_MAX_AGE_SECONDS, secure),
  );
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.setHeader('Set-Cookie', serializeSessionCookie('', 0, secure));
}
