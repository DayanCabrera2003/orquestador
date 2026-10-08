import { addSubagent, findSession, removeSubagent, setReportsTo } from '@orquestador/core';
import { t } from '../../i18n/t';
import { useFlow } from '../../stores/flowStore';
import { useUi } from '../../stores/uiStore';
import { parseEdgeId } from './graphView';

const nameOf = (id: string): string => {
  const flow = useFlow.getState().flow;
  return (flow && findSession(flow, id)?.name) ?? id;
};

/** Crea una relación desde un conector: `report` (fromId reporta a toId) o `subagent` (toId es subagente de fromId). */
export function link(fromId: string, toId: string, kind: 'report' | 'subagent'): boolean {
  const { apply } = useFlow.getState();
  const ok =
    kind === 'report'
      ? apply((f) => setReportsTo(f, fromId, toId))
      : apply((f) => addSubagent(f, fromId, toId));
  if (ok) {
    useUi
      .getState()
      .toast(
        kind === 'report'
          ? t('relation.reportSet', { child: nameOf(fromId), parent: nameOf(toId) })
          : t('relation.subagentSet', { child: nameOf(toId), parent: nameOf(fromId) }),
      );
  }
  return ok;
}

/** Quita la relación que representa una arista, con opción de deshacer. */
export function unlinkEdge(edgeId: string): void {
  const relation = parseEdgeId(edgeId);
  const { flow, apply } = useFlow.getState();
  if (!relation || !flow) return;
  if (relation.kind === 'report') {
    const previous = findSession(flow, relation.childId)?.reportsTo ?? null;
    apply((f) => setReportsTo(f, relation.childId, null));
    useUi.getState().toast(t('relation.removed'), {
      label: t('relation.undo'),
      run: () => {
        useFlow.getState().apply((f) => setReportsTo(f, relation.childId, previous));
      },
    });
  } else {
    apply((f) => removeSubagent(f, relation.parentId, relation.childId));
    useUi.getState().toast(t('relation.removed'), {
      label: t('relation.undo'),
      run: () => {
        useFlow.getState().apply((f) => addSubagent(f, relation.parentId, relation.childId));
      },
    });
  }
}
