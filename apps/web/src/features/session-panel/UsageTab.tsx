import { findSession } from '@orquestador/core';
import ui from '../../components/ui.module.css';
import { t } from '../../i18n/t';
import { formatTokens, formatUsd, percent } from '../../lib/format';
import { useApp } from '../../stores/appStore';
import { useFlow } from '../../stores/flowStore';
import { useRuntime } from '../../stores/runtimeStore';
import styles from './SessionPanel.module.css';

const W = 390;
const H = 96;

function Sparkline({ values }: { values: number[] }) {
  const points = values.length > 1 ? values : [0, ...values];
  const max = Math.max(...points, 0.01);
  const coords = points.map(
    (v, i) => [(i / (points.length - 1)) * W, H - 8 - (v / max) * (H - 18)] as const,
  );
  const line = coords
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const last = coords[coords.length - 1] ?? [0, H];
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      preserveAspectRatio="none"
      role="img"
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.05)" />
      ))}
      <path
        d={`${line} L${String(W)},${String(H)} L0,${String(H)}Z`}
        fill="var(--tone)"
        fillOpacity="0.12"
      />
      <path
        d={line}
        fill="none"
        stroke="var(--tone)"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0] - 3} cy={last[1]} r="3.5" fill="var(--tone)" />
    </svg>
  );
}

export function UsageTab({ sessionId }: { sessionId: string }) {
  const flow = useFlow((s) => s.flow);
  const runtime = useRuntime((s) => s.runtimes[sessionId]);
  const history = useRuntime((s) => s.costHistory[sessionId]);
  const contextWindow = useApp((s) => s.settings?.contextWindow);
  const session = flow ? findSession(flow, sessionId) : undefined;
  if (!session) return null;

  const cost = runtime?.costUsd ?? 0;
  const usage = runtime?.usage ?? {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  const window = contextWindow?.[session.model] ?? 1_000_000;
  const ctx = runtime?.contextTokens ?? 0;

  return (
    <div className={styles.body} data-model={session.model}>
      <div className={styles.usage}>
        <div className={styles.big}>
          <span>{formatUsd(cost)}</span>
          <em>
            {t('panel.usageOf', {
              budget: session.budgetUsd.toFixed(2),
              pct: percent(cost, session.budgetUsd),
            })}
          </em>
        </div>
        <div className={styles.bar}>
          <i style={{ width: `${String(percent(cost, session.budgetUsd))}%` }} />
        </div>
        <Sparkline values={history ?? [cost]} />
        <dl className={styles.kv}>
          <div>
            <dt>{t('panel.input')}</dt>
            <dd>{formatTokens(usage.inputTokens)}</dd>
          </div>
          <div>
            <dt>{t('panel.output')}</dt>
            <dd>{formatTokens(usage.outputTokens)}</dd>
          </div>
          <div>
            <dt>{t('panel.cacheRead')}</dt>
            <dd>{formatTokens(usage.cacheReadTokens)}</dd>
          </div>
          <div>
            <dt>{t('panel.cacheWrite')}</dt>
            <dd>{formatTokens(usage.cacheWriteTokens)}</dd>
          </div>
        </dl>
        <div className={ui.field}>
          <span className={ui.label}>{t('panel.contextWindow')}</span>
          <div className={styles.ctxline}>
            {t('panel.contextOf', {
              used: formatTokens(ctx),
              total: formatTokens(window),
              pct: percent(ctx, window),
            })}
          </div>
          <div className={styles.bar}>
            <i style={{ width: `${String(percent(ctx, window))}%` }} />
          </div>
        </div>
        <div className={ui.field}>
          <span className={ui.label}>{t('panel.worktree')}</span>
          <code className={styles.path}>{runtime?.worktreePath ?? t('panel.noWorktree')}</code>
        </div>
      </div>
    </div>
  );
}
