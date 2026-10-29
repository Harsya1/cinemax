import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://cinemax:cinemax_dev_only@127.0.0.1:5432/cinemax_db',
  },
});
