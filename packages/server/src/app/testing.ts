import { SqliteStore } from '../adapters/sqlite/sqliteStore';
import type { RepositoryInspection } from '../ports/Workspace';
import type { AppContext } from './context';
import { EventBus } from './events';

/** Contexto en memoria para tests de casos de uso. */
export function makeTestContext(repos: Record<string, RepositoryInspection> = {}): AppContext {
  let id = 0;
  return {
    store: new SqliteStore(':memory:'),
    workspace: {
      inspectRepository: (path) =>
        Promise.resolve(repos[path] ?? { ok: false, reason: 'not-found' }),
    },
    environment: {
      detect: () =>
        Promise.resolve({
          platform: 'linux',
          git: { found: true, version: '2.50.0', problem: null },
          agentCli: { found: true, version: '3.0.0', problem: null },
        }),
    },
    events: new EventBus(),
    now: () => '2026-10-08T12:00:00.000Z',
    newId: () => `id${String(++id)}`,
  };
}
