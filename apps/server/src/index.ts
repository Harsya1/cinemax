import { parseEnv } from './env.js';
import { createApp } from './app.js';
import { closeDb } from './db/index.js';

const env = parseEnv(process.env);
const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`[CINEMAX] API listening on http://localhost:${env.PORT}`);
});

function shutdown() {
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
