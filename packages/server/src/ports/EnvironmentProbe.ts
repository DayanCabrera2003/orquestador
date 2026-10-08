import type { Environment } from '@orquestador/protocol';

/** Detecta las herramientas externas que necesita la app. */
export interface EnvironmentProbe {
  detect(): Promise<Environment>;
}
