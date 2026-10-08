/** Configuración que el proceso principal pasa al motor. */
export interface EngineConfig {
  databasePath: string;
  worktreesDir: string;
  token: string;
  allowedOrigins: string[];
  agentCommand: string;
}

export const ENGINE_CONFIG_ENV = 'ORQ_ENGINE_CONFIG';

/** Mensajes del motor al proceso principal. */
export type EngineMessage = { type: 'ready'; port: number } | { type: 'failed'; message: string };

/** Origen desde el que se sirve la interfaz en la app instalada. */
export const APP_ORIGIN = 'app://orquestador';
