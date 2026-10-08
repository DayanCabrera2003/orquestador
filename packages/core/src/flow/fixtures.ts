import type { Flow, SessionNode } from './types';
import { CURRENT_SCHEMA_VERSION } from './types';

/** Crea una sesión con valores por defecto razonables. Solo para tests. */
export function makeSession(
  overrides: Partial<SessionNode> & Pick<SessionNode, 'id'>,
): SessionNode {
  return {
    name: overrides.id,
    model: 'haiku',
    role: 'ejecutor',
    instructions: '',
    permissions: {
      editFiles: true,
      runCommands: true,
      openPullRequests: false,
      startInPlanMode: false,
    },
    budgetUsd: 1,
    position: { x: 0, y: 0 },
    reportsTo: null,
    subagents: [],
    ...overrides,
  };
}

/** Crea un flujo con las sesiones dadas. Solo para tests. */
export function makeFlow(sessions: SessionNode[]): Flow {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'f1',
    name: 'flujo',
    budgetUsd: 10,
    sessions,
  };
}
