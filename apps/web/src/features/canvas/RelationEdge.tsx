import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { t } from '../../i18n/t';
import { useRuntime } from '../../stores/runtimeStore';
import type { RelationEdgeData } from './graphView';
import styles from './RelationEdge.module.css';

export type RelationEdgeType = Edge<RelationEdgeData, 'relation'>;

function RelationEdgeView(props: EdgeProps<RelationEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const pulses = useRuntime((s) => s.pulses.filter((p) => p.edgeId === id));
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });
  const kind = data?.kind ?? 'report';

  return (
    <g data-model={data?.model} className={styles.group}>
      <BaseEdge
        id={id}
        path={path}
        className={kind === 'subagent' ? styles.subagent : styles.report}
        interactionWidth={18}
      />
      <title>{t('relation.removeHint')}</title>
      {pulses.map((pulse) => (
        <circle key={pulse.key} r={3.4} className={styles.pulse}>
          <animateMotion
            dur="1.4s"
            path={path}
            keyPoints={pulse.reverse ? '1;0' : '0;1'}
            keyTimes="0;1"
            calcMode="spline"
            keySplines="0.45 0 0.55 1"
            fill="freeze"
          />
        </circle>
      ))}
    </g>
  );
}

export const RelationEdge = memo(RelationEdgeView);
