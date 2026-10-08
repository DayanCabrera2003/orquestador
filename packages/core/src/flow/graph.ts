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

/**
 * Cadena de escalamiento de una sesión: su padre, el padre de su padre, etc.
 * No incluye a la sesión ni al usuario. Se detiene ante ciclos o padres inexistentes.
 */
export function escalationChain(flow: Flow, id: string): SessionNode[] {
  const chain: SessionNode[] = [];
  const visited = new Set<string>([id]);
  let current = findSession(flow, id);
  while (current?.reportsTo && !visited.has(current.reportsTo)) {
    const parent = findSession(flow, current.reportsTo);
    if (!parent) break;
    chain.push(parent);
    visited.add(parent.id);
    current = parent;
  }
  return chain;
}
