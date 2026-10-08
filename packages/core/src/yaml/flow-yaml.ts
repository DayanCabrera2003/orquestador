import { parse, stringify, YAMLParseError } from 'yaml';
import { migrateFlow, type MigrationError } from '../flow/migrations';
import type { Flow } from '../flow/types';
import { validateFlow, type FlowIssue } from '../flow/validate';
import { err, type Result } from '../result';

export type FlowYamlError =
  | { code: 'syntax'; message: string }
  | MigrationError
  | { code: 'inconsistent'; issues: FlowIssue[] };

export function serializeFlowYaml(flow: Flow): string {
  return stringify(flow, { lineWidth: 0 });
}

/** Lee un flujo desde YAML: sintaxis, versión, esquema y consistencia de relaciones. */
export function parseFlowYaml(text: string): Result<Flow, FlowYamlError> {
  let data: unknown;
  try {
    data = parse(text);
  } catch (e) {
    if (e instanceof YAMLParseError) return err({ code: 'syntax', message: e.message });
    throw e;
  }
  const migrated = migrateFlow(data);
  if (!migrated.ok) return migrated;
  const issues = validateFlow(migrated.value);
  if (issues.length > 0) return err({ code: 'inconsistent', issues });
  return migrated;
}
