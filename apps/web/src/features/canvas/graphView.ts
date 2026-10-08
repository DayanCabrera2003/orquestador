import type { Flow, ModelTier } from '@orquestador/core';

export type RelationKind = 'report' | 'subagent';

export interface RelationEdgeData extends Record<string, unknown> {
  kind: RelationKind;
  model: ModelTier;
}

export interface EdgeView {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  type: 'relation';
  data: RelationEdgeData;
}

export interface NodeView {
  id: string;
  type: 'session';
  position: { x: number; y: number };
  data: { sessionId: string };
}

/** Identificadores de los conectores de cada nodo. */
export const HANDLES = {
  reportOut: 'report',
  subagentOut: 'subagent',
  reportIn: 'in-bottom',
  subagentIn: 'in-left',
} as const;

export const reportEdgeId = (childId: string): string => `r:${childId}`;
export const subagentEdgeId = (parentId: string, childId: string): string =>
  `s:${parentId}:${childId}`;

export function flowToNodes(flow: Flow): NodeView[] {
  return flow.sessions.map((s) => ({
    id: s.id,
    type: 'session',
    position: s.position,
    data: { sessionId: s.id },
  }));
}

/**
 * Aristas de relación. "Reporta a" sale del conector ● del hijo y entra por abajo del padre.
 * "Subagente" sale del conector ◆ del padre y entra por la izquierda del hijo.
 */
export function flowToEdges(flow: Flow): EdgeView[] {
  const ids = new Set(flow.sessions.map((s) => s.id));
  const edges: EdgeView[] = [];
  for (const s of flow.sessions) {
    if (s.reportsTo && ids.has(s.reportsTo)) {
      edges.push({
        id: reportEdgeId(s.id),
        source: s.id,
        sourceHandle: HANDLES.reportOut,
        target: s.reportsTo,
        targetHandle: HANDLES.reportIn,
        type: 'relation',
        data: { kind: 'report', model: s.model },
      });
    }
    for (const childId of s.subagents) {
      const child = flow.sessions.find((c) => c.id === childId);
      if (!child) continue;
      edges.push({
        id: subagentEdgeId(s.id, childId),
        source: s.id,
        sourceHandle: HANDLES.subagentOut,
        target: childId,
        targetHandle: HANDLES.subagentIn,
        type: 'relation',
        data: { kind: 'subagent', model: child.model },
      });
    }
  }
  return edges;
}

/**
 * Arista por la que viaja un mensaje entre dos sesiones, y si va en sentido contrario al trazo.
 * Devuelve `undefined` si no hay relación directa (por ejemplo, un mensaje al usuario).
 */
export function edgeForMessage(
  flow: Flow,
  fromId: string,
  toId: string | null,
): { edgeId: string; reverse: boolean } | undefined {
  if (toId === null) return undefined;
  const from = flow.sessions.find((s) => s.id === fromId);
  const to = flow.sessions.find((s) => s.id === toId);
  if (!from || !to) return undefined;
  if (from.reportsTo === to.id) return { edgeId: reportEdgeId(from.id), reverse: false };
  if (to.reportsTo === from.id) return { edgeId: reportEdgeId(to.id), reverse: true };
  if (from.subagents.includes(to.id))
    return { edgeId: subagentEdgeId(from.id, to.id), reverse: false };
  if (to.subagents.includes(from.id))
    return { edgeId: subagentEdgeId(to.id, from.id), reverse: true };
  return undefined;
}

/** Relación representada por una arista, para poder quitarla. */
export function parseEdgeId(
  id: string,
):
  | { kind: 'report'; childId: string }
  | { kind: 'subagent'; parentId: string; childId: string }
  | undefined {
  const [kind, a, b] = id.split(':');
  if (kind === 'r' && a) return { kind: 'report', childId: a };
  if (kind === 's' && a && b) return { kind: 'subagent', parentId: a, childId: b };
  return undefined;
}
