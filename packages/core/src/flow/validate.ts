import type { Flow } from './types';

export type FlowIssue =
  | { code: 'duplicate-id'; sessionId: string }
  | { code: 'unknown-parent'; sessionId: string; targetId: string }
  | { code: 'unknown-subagent'; sessionId: string; targetId: string }
  | { code: 'self-relation'; sessionId: string }
  | { code: 'duplicate-subagent'; sessionId: string; targetId: string }
  | { code: 'cycle'; sessionIds: string[] };

/** Revisa la consistencia de un flujo completo, por ejemplo al cargarlo del disco o de un YAML. */
export function validateFlow(flow: Flow): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const ids = new Set<string>();

  for (const s of flow.sessions) {
    if (ids.has(s.id)) issues.push({ code: 'duplicate-id', sessionId: s.id });
    ids.add(s.id);
  }

  for (const s of flow.sessions) {
    if (s.reportsTo === s.id) issues.push({ code: 'self-relation', sessionId: s.id });
    else if (s.reportsTo !== null && !ids.has(s.reportsTo)) {
      issues.push({ code: 'unknown-parent', sessionId: s.id, targetId: s.reportsTo });
    }
    const seen = new Set<string>();
    for (const sub of s.subagents) {
      if (sub === s.id) issues.push({ code: 'self-relation', sessionId: s.id });
      else if (!ids.has(sub))
        issues.push({ code: 'unknown-subagent', sessionId: s.id, targetId: sub });
      else if (seen.has(sub))
        issues.push({ code: 'duplicate-subagent', sessionId: s.id, targetId: sub });
      seen.add(sub);
    }
  }

  issues.push(...findCycles(flow));
  return issues;
}

/** Ciclos de reporte, cada uno informado una vez, empezando por la primera sesión del flujo que lo forma. */
function findCycles(flow: Flow): FlowIssue[] {
  const parentOf = new Map(flow.sessions.map((s) => [s.id, s.reportsTo]));
  const inCycle = new Set<string>();
  const cycles: FlowIssue[] = [];

  for (const start of flow.sessions) {
    const path: string[] = [];
    const position = new Map<string, number>();
    let current: string | null | undefined = start.id;
    while (current != null && parentOf.has(current) && !inCycle.has(current)) {
      const index = position.get(current);
      if (index !== undefined) {
        const cycle = path.slice(index);
        if (cycle.length > 1) {
          cycle.forEach((id) => inCycle.add(id));
          cycles.push({ code: 'cycle', sessionIds: cycle });
        }
        break;
      }
      position.set(current, path.length);
      path.push(current);
      current = parentOf.get(current);
    }
  }
  return cycles;
}
