// Proceso del motor: Electron lo lanza con utilityProcess.fork().
import { startServer } from '@orquestador/server';
import { ENGINE_CONFIG_ENV, type EngineConfig, type EngineMessage } from './config';

const parent = process.parentPort;
const post = (message: EngineMessage): void => {
  parent.postMessage(message);
};

const raw = process.env[ENGINE_CONFIG_ENV];
if (!raw) {
  post({ type: 'failed', message: 'Falta la configuración del motor' });
  process.exit(1);
}
const config = JSON.parse(raw) as EngineConfig;

try {
  const server = await startServer({ ...config, port: 0, logger: true });
  post({ type: 'ready', port: server.port });
  parent.on('message', (event: { data: unknown }) => {
    if ((event.data as { type?: string } | null)?.type === 'shutdown') {
      void server.close().then(() => process.exit(0));
    }
  });
} catch (e) {
  post({ type: 'failed', message: e instanceof Error ? e.message : String(e) });
  process.exit(1);
}
