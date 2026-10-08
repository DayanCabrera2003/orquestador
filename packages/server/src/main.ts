import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { startServer } from './server';

/** Arranque para desarrollo: `pnpm dev:server`. La app de escritorio usa `startServer` directamente. */
const dataDir = resolve(process.env.ORQ_DATA_DIR ?? '.dev-data');
mkdirSync(dataDir, { recursive: true });

const server = await startServer({
  databasePath: join(dataDir, 'orquestador.db'),
  token: process.env.ORQ_TOKEN ?? 'dev',
  allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  port: Number(process.env.ORQ_PORT ?? 4317),
  agentCommand: process.env.ORQ_AGENT_COMMAND ?? 'claude',
  logger: true,
});

const stop = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
