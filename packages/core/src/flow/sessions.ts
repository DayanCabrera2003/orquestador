import { err, ok, type Result } from '../result';
import { findSession } from './graph';
import type { Flow, SessionNode } from './types';

export type SessionError =
  { code: 'duplicate-id'; id: string } | { code: 'unknown-session'; id: string };

/** Agrega una sesión. Sus relaciones deben apuntar a sesiones que ya existen. */
export function addSession(flow: Flow, session: SessionNode): Result<Flow, SessionError> {
  if (findSession(flow, session.id)) return err({ code: 'duplicate-id', id: session.id });
  const referenced = [...(session.reportsTo ? [session.reportsTo] : []), ...session.subagents];
  const missing = referenced.find((id) => !findSession(flow, id));
  if (missing !== undefined) return err({ code: 'unknown-session', id: missing });
  return ok({ ...flow, sessions: [...flow.sessions, session] });
}

/** Quita una sesión. Quienes le reportaban pasan a reportar al usuario, y sale de las listas de subagentes. */
export function removeSession(flow: Flow, id: string): Flow {
  if (!findSession(flow, id)) return flow;
  return {
    ...flow,
    sessions: flow.sessions
      .filter((s) => s.id !== id)
      .map((s) => ({
        ...s,
        reportsTo: s.reportsTo === id ? null : s.reportsTo,
        subagents: s.subagents.filter((sub) => sub !== id),
      })),
  };
}
