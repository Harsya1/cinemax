import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  TMDB_ACCESS_TOKEN: z.string().trim().min(1).optional(),
  TMDB_API_KEY: z.string().trim().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(', ');
    throw new Error(`Invalid environment configuration for: ${fields}`);
  }
  return parsed.data;
}
