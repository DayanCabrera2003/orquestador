import type { Flow, SessionNode } from './types';

export function findSession(flow: Flow, id: string): SessionNode | undefined {
  return flow.sessions.find((s) => s.id === id);
}

/** Sesiones que reportan directamente a `id`. */
export function childrenOf(flow: Flow, id: string): SessionNode[] {
  return flow.sessions.filter((s) => s.reportsTo === id);
}

/** Sesiones que tienen a `id` como subagente. */
export function subagentOwnersOf(flow: Flow, id: string): SessionNode[] {
  return flow.sessions.filter((s) => s.subagents.includes(id));
}
