import { engineSocket } from '../../api/socket';
import ui from '../../components/ui.module.css';
import { t } from '../../i18n/t';
import { cx } from '../../lib/cx';
import { formatTokens, formatUsd, percent } from '../../lib/format';
import { useApp } from '../../stores/appStore';
import { useFlow } from '../../stores/flowStore';
import { useRuntime } from '../../stores/runtimeStore';
import { useUi } from '../../stores/uiStore';
import styles from './TopBar.module.css';

export function Logo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <rect x="7.5" y="1.5" width="7" height="5" rx="1.2" />
      <rect x="1.5" y="15.5" width="7" height="5" rx="1.2" />
      <rect x="13.5" y="15.5" width="7" height="5" rx="1.2" />
      <path d="M11 6.5v4.5M5 15.5V11h12v4.5" />
    </svg>
  );
}

export function TopBar() {
  const flow = useFlow((s) => s.flow);
  const runtimes = useRuntime((s) => s.runtimes);
  const inboxCount = useRuntime((s) => s.inbox.length);
  const setInboxOpen = useUi((s) => s.setInboxOpen);
  const project = useApp((s) => s.projects.find((p) => p.id === s.projectId));
  const openFlow = useApp((s) => s.openFlow);
  const connected = useApp((s) => s.connected);
  if (!flow) return null;

  const list = Object.values(runtimes);
  const cost = list.reduce((sum, r) => sum + r.costUsd, 0);
  const tokens = list.reduce((sum, r) => sum + r.usage.inputTokens + r.usage.outputTokens, 0);
  const running = list.some(
    (r) => r.status === 'thinking' || r.status === 'waiting' || r.status === 'blocked',
  );

  return (
    <header className={styles.top}>
      <div className={styles.brand}>
        <Logo />
        <span>{t('app.name')}</span>
      </div>
      <span className={styles.sep} />
      <button
        className={styles.crumb}
        onClick={() => {
          openFlow(null);
        }}
      >
        {project?.name} / <b>{flow.name}</b>
      </button>
      <span className={cx(styles.run, running && styles.running, !connected && styles.offline)}>
        <i />
        {connected ? (running ? t('topbar.running') : t('topbar.stopped')) : t('app.engineOffline')}
      </span>
      <span className={styles.spacer} />
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span>{t('topbar.sessions')}</span>
          <b>{flow.sessions.length}</b>
        </div>
        <div className={styles.metric}>
          <span>{t('topbar.tokens')}</span>
          <b>{formatTokens(tokens)}</b>
        </div>
        <div className={styles.metric}>
          <span>{t('topbar.spend')}</span>
          <b>
            {formatUsd(cost)} <em>/ {formatUsd(flow.budgetUsd)}</em>
          </b>
          <div className={styles.budget}>
            <i style={{ width: `${String(percent(cost, flow.budgetUsd))}%` }} />
          </div>
        </div>
      </div>
      <span className={styles.sep} />
      <button
        className={ui.btn}
        onClick={() => {
          setInboxOpen(true);
        }}
      >
        {t('topbar.questions')}
        {inboxCount > 0 && <span className={styles.badge}>{inboxCount}</span>}
      </button>
      <button
        className={cx(ui.btn, ui.primary)}
        onClick={() => {
          engineSocket.send({ type: running ? 'flow.pause' : 'flow.start', flowId: flow.id });
        }}
      >
        {running ? t('topbar.pauseFlow') : t('topbar.startFlow')}
      </button>
    </header>
  );
}
