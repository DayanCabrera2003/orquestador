import { subagentOwnersOf, findSession } from '@orquestador/core';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { Medal } from '../../components/Medal';
import { StatusPill } from '../../components/StatusPill';
import { t } from '../../i18n/t';
import { cx } from '../../lib/cx';
import { formatTokens, formatUsd, percent } from '../../lib/format';
import { useApp } from '../../stores/appStore';
import { useFlow } from '../../stores/flowStore';
import { useRuntime } from '../../stores/runtimeStore';
import { useUi } from '../../stores/uiStore';
import { HANDLES } from './graphView';
import styles from './SessionNode.module.css';

export type SessionNodeType = Node<{ sessionId: string }, 'session'>;

function SessionNodeView({ data }: NodeProps<SessionNodeType>) {
  const flow = useFlow((s) => s.flow);
  const runtime = useRuntime((s) => s.runtimes[data.sessionId]);
  const selected = useUi((s) => s.selectedSessionId === data.sessionId);
  const contextWindow = useApp((s) => s.settings?.contextWindow);
  const session = flow ? findSession(flow, data.sessionId) : undefined;
  if (!flow || !session) return null;

  const status = runtime?.status ?? 'idle';
  const task = runtime && runtime.currentTask.length > 0 ? runtime.currentTask : t('node.noTask');
  const tokens = runtime ? runtime.usage.inputTokens + runtime.usage.outputTokens : 0;
  const ctxPct = percent(runtime?.contextTokens ?? 0, contextWindow?.[session.model] ?? 200_000);
  const parent = session.reportsTo ? findSession(flow, session.reportsTo) : undefined;
  const owners = subagentOwnersOf(flow, session.id);
  const reportsLabel = parent
    ? parent.name
    : owners[0]
      ? t('node.subagentOf', { name: owners[0].name })
      : t('node.you');
  const subagents =
    session.subagents
      .map((id) => findSession(flow, id)?.name)
      .filter(Boolean)
      .join(', ') || t('node.none');

  return (
    <div
      className={cx(
        styles.node,
        status === 'thinking' && styles.thinking,
        selected && styles.selected,
      )}
      data-model={session.model}
    >
      <Handle
        type="target"
        id={HANDLES.reportIn}
        position={Position.Bottom}
        className={styles.pin}
      />
      <Handle
        type="target"
        id={HANDLES.subagentIn}
        position={Position.Left}
        className={cx(styles.pin, styles.pinDiamond)}
      />

      <div className={styles.head}>
        <Medal model={session.model} />
        <div className={styles.title}>
          <div className={styles.name}>{session.name}</div>
          <div className={styles.sub}>
            {t(`model.${session.model}`)} · {t(`role.${session.role}`)}
          </div>
        </div>
      </div>

      <StatusPill status={status} />
      <p className={styles.task}>{task}</p>

      <div className={styles.stats}>
        <div>
          <b>{formatTokens(tokens)}</b>
          <span>{t('node.tokens')}</span>
        </div>
        <div>
          <b>{formatUsd(runtime?.costUsd ?? 0)}</b>
          <span>{t('node.spend')}</span>
        </div>
        <div>
          <b>{ctxPct}%</b>
          <span>{t('node.context')}</span>
        </div>
      </div>
      <div className={styles.ctxbar}>
        <i style={{ width: `${String(ctxPct)}%` }} />
      </div>

      <div className={styles.links}>
        <div className={styles.row}>
          <span className={styles.key}>{t('node.reportsTo')}</span>
          <span className={styles.value}>{reportsLabel}</span>
          <Handle
            type="source"
            id={HANDLES.reportOut}
            position={Position.Right}
            className={styles.handle}
            title={t('node.dragReport')}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.key}>{t('node.subagents')}</span>
          <span className={styles.value}>{subagents}</span>
          <Handle
            type="source"
            id={HANDLES.subagentOut}
            position={Position.Right}
            className={cx(styles.handle, styles.handleDiamond)}
            title={t('node.dragSubagent')}
          />
        </div>
      </div>
    </div>
  );
}

export const SessionNode = memo(SessionNodeView);
