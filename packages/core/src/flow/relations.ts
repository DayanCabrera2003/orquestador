import { err, ok, type Result } from '../result';
import { escalationChain, findSession } from './graph';
import type { Flow, SessionNode } from './types';

export type RelationError =
  | { code: 'unknown-session'; id: string }
  | { code: 'self-relation' }
  | { code: 'cycle' }
  | { code: 'duplicate-subagent' };

function updateSession(flow: Flow, id: string, change: (s: SessionNode) => SessionNode): Flow {
  return { ...flow, sessions: flow.sessions.map((s) => (s.id === id ? change(s) : s)) };
}

/** Hace que `childId` reporte a `parentId`, o al usuario si es `null`. */
export function setReportsTo(
  flow: Flow,
  childId: string,
  parentId: string | null,
): Result<Flow, RelationError> {
  if (!findSession(flow, childId)) return err({ code: 'unknown-session', id: childId });
  if (parentId !== null) {
    if (!findSession(flow, parentId)) return err({ code: 'unknown-session', id: parentId });
    if (parentId === childId) return err({ code: 'self-relation' });
    if (escalationChain(flow, parentId).some((s) => s.id === childId))
      return err({ code: 'cycle' });
  }
  return ok(updateSession(flow, childId, (s) => ({ ...s, reportsTo: parentId })));
}

/** Permite que `parentId` invoque a `childId` como subagente. */
export function addSubagent(
  flow: Flow,
  parentId: string,
  childId: string,
): Result<Flow, RelationError> {
  const parent = findSession(flow, parentId);
  if (!parent) return err({ code: 'unknown-session', id: parentId });
  if (!findSession(flow, childId)) return err({ code: 'unknown-session', id: childId });
  if (parentId === childId) return err({ code: 'self-relation' });
  if (parent.subagents.includes(childId)) return err({ code: 'duplicate-subagent' });
  return ok(updateSession(flow, parentId, (s) => ({ ...s, subagents: [...s.subagents, childId] })));
}

/** Quita la relación de subagente. Si no existía, devuelve el flujo igual. */
export function removeSubagent(flow: Flow, parentId: string, childId: string): Flow {
  const parent = findSession(flow, parentId);
  if (!parent?.subagents.includes(childId)) return flow;
  return updateSession(flow, parentId, (s) => ({
    ...s,
    subagents: s.subagents.filter((id) => id !== childId),
  }));
}
