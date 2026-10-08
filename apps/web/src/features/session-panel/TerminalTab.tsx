import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'react';
import { engineSocket } from '../../api/socket';
import ui from '../../components/ui.module.css';
import { t } from '../../i18n/t';
import { cx } from '../../lib/cx';
import { useRuntime } from '../../stores/runtimeStore';
import styles from './SessionPanel.module.css';

const THEME = {
  background: '#050505',
  foreground: '#d8d4cb',
  cursor: '#ededec',
  selectionBackground: 'rgba(255,255,255,0.18)',
  black: '#1e1e1e',
  brightBlack: '#6c6c6a',
};

/** Terminal real de la CLI del agente sobre la misma conversación de la sesión. */
export function TerminalTab({ flowId, sessionId }: { flowId: string; sessionId: string }) {
  const container = useRef<HTMLDivElement>(null);
  const open = useRuntime((s) => s.runtimes[sessionId]?.terminalOpen ?? false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const term = new Terminal({
      theme: THEME,
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono'),
      fontSize: 12.5,
      cursorBlink: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(element);
    fit.fit();
    term.write(useRuntime.getState().terminalBuffers[sessionId] ?? '');
    engineSocket.send({
      type: 'terminal.open',
      flowId,
      sessionId,
      cols: term.cols,
      rows: term.rows,
    });

    const offEvents = engineSocket.onEvent((e) => {
      if (e.type === 'terminal.data' && e.sessionId === sessionId) term.write(e.data);
      if (e.type === 'terminal.exit' && e.sessionId === sessionId)
        term.write(`\r\n\x1b[90m${t('panel.terminalExited')}\x1b[0m\r\n`);
    });
    const input = term.onData((data) => {
      engineSocket.send({ type: 'terminal.input', flowId, sessionId, data });
    });
    const observer = new ResizeObserver(() => {
      fit.fit();
      engineSocket.send({
        type: 'terminal.resize',
        flowId,
        sessionId,
        cols: term.cols,
        rows: term.rows,
      });
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      input.dispose();
      offEvents();
      term.dispose();
    };
  }, [flowId, sessionId]);

  return (
    <div className={styles.terminalWrap}>
      <div className={styles.terminalBar}>
        <span>{open ? t('panel.terminalOpen') : t('panel.terminalClosed')}</span>
        {open && (
          <button
            className={cx(ui.btn, ui.small)}
            onClick={() => {
              engineSocket.send({ type: 'terminal.close', flowId, sessionId });
            }}
          >
            {t('panel.closeTerminal')}
          </button>
        )}
      </div>
      <div ref={container} className={styles.terminal} />
    </div>
  );
}
