import { WS_PATH } from '@orquestador/protocol';
import { desktop } from './bridge';

export interface EngineConfig {
  httpBase: string;
  wsUrl: string;
  token: string;
}

/**
 * En la app de escritorio, el motor está en el puerto que pasa el preload.
 * En desarrollo, la UI usa el proxy de Vite (mismo origen) y el token de `VITE_ORQ_TOKEN`.
 */
export function engineConfig(): EngineConfig {
  const bridge = desktop();
  if (bridge) {
    const base = `127.0.0.1:${String(bridge.port)}`;
    return { httpBase: `http://${base}`, wsUrl: `ws://${base}${WS_PATH}`, token: bridge.token };
  }
  const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return {
    httpBase: '',
    wsUrl: `${wsProtocol}://${location.host}${WS_PATH}`,
    token: (import.meta.env.VITE_ORQ_TOKEN as string | undefined) ?? 'dev',
  };
}
