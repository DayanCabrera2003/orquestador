import { err, ok, type Result } from '../result';
import { CURRENT_SCHEMA_VERSION, FlowSchema, type Flow } from './types';

export type MigrationError =
  | { code: 'missing-version' }
  | { code: 'unknown-version'; version: number }
  | { code: 'newer-version'; version: number }
  | { code: 'invalid'; issues: string[] };

/**
 * Pasos de migración: la clave es la versión de origen y la función devuelve los datos en la
 * versión siguiente. Al subir CURRENT_SCHEMA_VERSION, agrega aquí el paso desde la anterior.
 */
const STEPS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

const FIRST_SCHEMA_VERSION = 1;

/** Lleva datos de cualquier versión conocida a la actual y los valida. */
export function migrateFlow(data: unknown): Result<Flow, MigrationError> {
  if (typeof data !== 'object' || data === null || !('schemaVersion' in data)) {
    return err({ code: 'missing-version' });
  }
  let current = data as Record<string, unknown>;
  const version = current.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version))
    return err({ code: 'missing-version' });
  if (version > CURRENT_SCHEMA_VERSION) return err({ code: 'newer-version', version });
  if (version < FIRST_SCHEMA_VERSION) return err({ code: 'unknown-version', version });

  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = STEPS[v];
    if (!step) return err({ code: 'unknown-version', version: v });
    current = { ...step(current), schemaVersion: v + 1 };
  }

  const parsed = FlowSchema.safeParse(current);
  if (!parsed.success) {
    return err({
      code: 'invalid',
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }
  return ok(parsed.data);
}
