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
