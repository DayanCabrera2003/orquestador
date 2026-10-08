import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ReactFlow,
  useReactFlow,
  type Node,
  type NodeChange,
  type OnConnectEnd,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n/t';
import { useFlow } from '../../stores/flowStore';
import { useUi } from '../../stores/uiStore';
import styles from './Canvas.module.css';
import { flowToEdges, flowToNodes, HANDLES } from './graphView';
import { link, unlinkEdge } from './relationActions';
import { RelationEdge } from './RelationEdge';
import { SessionNode } from './SessionNode';

const nodeTypes = { session: SessionNode };
const edgeTypes = { relation: RelationEdge };
const NODE_HALF_WIDTH = 128;

function pointOf(event: MouseEvent | TouchEvent): { x: number; y: number } {
  const touch = 'changedTouches' in event ? event.changedTouches[0] : undefined;
  return touch
    ? { x: touch.clientX, y: touch.clientY }
    : { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('input, textarea, select, [contenteditable]') !== null
  );
}

export function Canvas() {
  const flow = useFlow((s) => s.flow);
  const apply = useFlow((s) => s.apply);
  const select = useUi((s) => s.select);
  const openNewSession = useUi((s) => s.openNewSession);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>([]);

  // Sincroniza los nodos con el flujo, conservando lo que React Flow ya midió.
  useEffect(() => {
    if (!flow) return;
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return flowToNodes(flow).map((view) => {
        const current = byId.get(view.id);
        return current
          ? {
              ...current,
              data: view.data,
              position: current.dragging ? current.position : view.position,
            }
          : view;
      });
    });
  }, [flow]);

  const edges = useMemo(() => (flow ? flowToEdges(flow) : []), [flow]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onNodeDragStop = useCallback(
    (_: unknown, _node: Node, dragged: Node[]) => {
      const positions = new Map(dragged.map((n) => [n.id, n.position]));
      apply((f) => ({
        ...f,
        sessions: f.sessions.map((s) => {
          const p = positions.get(s.id);
          return p ? { ...s, position: { x: Math.round(p.x), y: Math.round(p.y) } } : s;
        }),
      }));
    },
    [apply],
  );

  const viewportCenter = useCallback(() => {
    const pane = document.querySelector('.react-flow__pane')?.getBoundingClientRect();
    const center = pane
      ? { x: pane.left + pane.width / 2, y: pane.top + pane.height / 2 }
      : { x: 400, y: 300 };
    const p = screenToFlowPosition(center);
    return { x: p.x - NODE_HALF_WIDTH, y: p.y - 130 };
  }, [screenToFlowPosition]);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      const fromId = state.fromNode?.id;
      const handle = state.fromHandle?.id;
      if (!fromId || (handle !== HANDLES.reportOut && handle !== HANDLES.subagentOut)) return;
      const kind = handle === HANDLES.reportOut ? 'report' : 'subagent';
      const point = pointOf(event);
      const element = document.elementFromPoint(point.x, point.y);
      // Gana el nodo bajo el cursor; el imán de conectores de React Flow solo se usa si no hay ninguno.
      const underPointer =
        element?.closest('.react-flow__node')?.getAttribute('data-id') ?? undefined;
      const targetId = underPointer ?? state.toNode?.id;
      if (targetId && targetId !== fromId) {
        link(fromId, targetId, kind);
      } else if (!targetId && element?.closest('.react-flow__pane')) {
        const p = screenToFlowPosition(point);
        openNewSession({
          position: { x: p.x - NODE_HALF_WIDTH, y: p.y - 40 },
          link: { fromId, kind },
        });
      }
    },
    [openNewSession, screenToFlowPosition],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openNewSession({ position: viewportCenter() });
      }
      if (e.key === 'f' || e.key === 'F') void fitView({ padding: 0.2, duration: 300 });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [fitView, openNewSession, viewportCenter]);

  if (!flow) return null;

  return (
    <div
      className={styles.canvas}
      onDoubleClick={(e) => {
        if (!(e.target as Element).closest('.react-flow__pane')) return;
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        openNewSession({ position: { x: p.x - NODE_HALF_WIDTH, y: p.y - 40 } });
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, node) => {
          select(node.id);
        }}
        onPaneClick={() => {
          select(null);
        }}
        onEdgeClick={(_, edge) => {
          unlinkEdge(edge.id);
        }}
        onConnectEnd={onConnectEnd}
        isValidConnection={() => false}
        connectionRadius={40}
        connectionLineStyle={{ stroke: 'var(--fg)', strokeWidth: 1.5, strokeDasharray: '2 5' }}
        zoomOnDoubleClick={false}
        elementsSelectable={false}
        minZoom={0.3}
        maxZoom={1.8}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="rgba(255,255,255,0.08)"
        />
      </ReactFlow>

      <div className={styles.legend}>
        <span className={styles.chip}>
          <svg width="26" height="8" viewBox="0 0 26 8">
            <path d="M1 4h24" stroke="var(--fg-2)" strokeWidth="1.6" />
          </svg>
          {t('canvas.legendReports')}
        </span>
        <span className={styles.chip}>
          <svg width="26" height="8" viewBox="0 0 26 8">
            <path d="M1 4h24" stroke="var(--fg-2)" strokeWidth="1.6" strokeDasharray="4 4" />
          </svg>
          {t('canvas.legendSubagent')}
        </span>
        <span className={styles.hint}>{t('canvas.hint')}</span>
      </div>

      {flow.sessions.length === 0 && (
        <div className={styles.empty}>
          <b>{t('canvas.emptyTitle')}</b>
          <span>{t('canvas.emptyBody')}</span>
        </div>
      )}

      <div className={styles.zoom}>
        <button aria-label={t('canvas.zoomOut')} onClick={() => void zoomOut({ duration: 200 })}>
          −
        </button>
        <button aria-label={t('canvas.zoomIn')} onClick={() => void zoomIn({ duration: 200 })}>
          +
        </button>
        <button
          aria-label={t('canvas.fit')}
          onClick={() => void fitView({ padding: 0.2, duration: 300 })}
        >
          ⤢
        </button>
      </div>

      <button
        className={styles.fab}
        onClick={() => {
          openNewSession({ position: viewportCenter() });
        }}
      >
        <span className={styles.plus}>+</span>
        {t('canvas.newSession')}
        <kbd className={styles.kbd}>N</kbd>
      </button>
    </div>
  );
}
