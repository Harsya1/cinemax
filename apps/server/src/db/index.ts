import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';
import { parseEnv } from '../env.js';

let sqlClient: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!sqlClient) {
    const env = parseEnv(process.env);
    // ponytail: max 10 connections covers single-location cinema traffic
    sqlClient = postgres(env.DATABASE_URL, { max: 10, connect_timeout: 5 });
  }
  return drizzle(sqlClient, { schema });
}

export async function pingDatabase(): Promise<boolean> {
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 2 });
    sqlClient = null;
  }
}
