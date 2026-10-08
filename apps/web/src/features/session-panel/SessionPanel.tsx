import { findSession, removeSession } from '@orquestador/core';
import { engineSocket } from '../../api/socket';
import { Medal } from '../../components/Medal';
import { StatusPill } from '../../components/StatusPill';
import ui from '../../components/ui.module.css';
import { t } from '../../i18n/t';
import { cx } from '../../lib/cx';
import { useFlow } from '../../stores/flowStore';
import { useRuntime } from '../../stores/runtimeStore';
import { useUi, type PanelTab } from '../../stores/uiStore';
import { ChatTab } from './ChatTab';
import { ConfigTab } from './ConfigTab';
import styles from './SessionPanel.module.css';
import { TerminalTab } from './TerminalTab';
import { UsageTab } from './UsageTab';

const TABS: {
  id: PanelTab;
  label: 'panel.chat' | 'panel.terminal' | 'panel.config' | 'panel.usage';
}[] = [
  { id: 'chat', label: 'panel.chat' },
  { id: 'terminal', label: 'panel.terminal' },
  { id: 'config', label: 'panel.config' },
  { id: 'usage', label: 'panel.usage' },
];

export function SessionPanel() {
  const flow = useFlow((s) => s.flow);
  const apply = useFlow((s) => s.apply);
  const selectedId = useUi((s) => s.selectedSessionId);
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const select = useUi((s) => s.select);
  const toast = useUi((s) => s.toast);
  const runtime = useRuntime((s) => (selectedId ? s.runtimes[selectedId] : undefined));
  const session = flow && selectedId ? findSession(flow, selectedId) : undefined;
  const open = Boolean(flow && session);

  const status = runtime?.status ?? 'idle';
  const command = (type: 'session.start' | 'session.pause' | 'session.resume') => {
    if (flow && session) engineSocket.send({ type, flowId: flow.id, sessionId: session.id });
  };

  return (
    <aside className={cx(styles.panel, !open && styles.closed)} aria-hidden={!open}>
      {flow && session && (
        <>
          <div className={styles.head}>
            <Medal model={session.model} size="lg" />
            <div className={styles.title}>
              <h2>{session.name}</h2>
              <div className={styles.sub}>
                {t(`model.${session.model}`)} · {t(`model.${session.model}Tier`)} ·{' '}
                {t(`role.${session.role}`)}
              </div>
            </div>
            <button
              className={ui.iconBtn}
              aria-label={t('panel.close')}
              onClick={() => {
                select(null);
              }}
            >
              ×
            </button>
          </div>
          <div className={styles.meta}>
            <StatusPill status={status} />
            <span className={styles.spacer} />
            {status === 'idle' || status === 'done' || status === 'error' ? (
              <button
                className={cx(ui.btn, ui.small)}
                onClick={() => {
                  command('session.start');
                }}
              >
                {t('panel.start')}
              </button>
            ) : status === 'paused' ? (
              <button
                className={cx(ui.btn, ui.small)}
                onClick={() => {
                  command('session.resume');
                }}
              >
                {t('panel.resume')}
              </button>
            ) : (
              <button
                className={cx(ui.btn, ui.small)}
                onClick={() => {
                  command('session.pause');
                }}
              >
                {t('panel.pause')}
              </button>
            )}
            <button
              className={cx(ui.btn, ui.small)}
              onClick={() => {
                const previous = flow;
                if (apply((f) => removeSession(f, session.id))) {
                  select(null);
                  toast(t('relation.removed'), {
                    label: t('relation.undo'),
                    run: () => {
                      useFlow.getState().apply(() => previous);
                    },
                  });
                }
              }}
            >
              {t('panel.delete')}
            </button>
          </div>
          <div className={styles.tabs} role="tablist">
            {TABS.map((x) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={tab === x.id}
                className={cx(styles.tab, tab === x.id && styles.tabOn)}
                onClick={() => {
                  setTab(x.id);
                }}
              >
                {t(x.label)}
              </button>
            ))}
          </div>
          {tab === 'chat' && <ChatTab sessionId={session.id} />}
          {tab === 'terminal' && <TerminalTab flowId={flow.id} sessionId={session.id} />}
          {tab === 'config' && <ConfigTab sessionId={session.id} />}
          {tab === 'usage' && <UsageTab sessionId={session.id} />}
        </>
      )}
    </aside>
  );
}
