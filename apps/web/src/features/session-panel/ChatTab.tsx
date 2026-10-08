import { findSession } from '@orquestador/core';
import { useEffect, useRef, useState } from 'react';
import { engineSocket } from '../../api/socket';
import ui from '../../components/ui.module.css';
import { t } from '../../i18n/t';
import { cx } from '../../lib/cx';
import { useFlow } from '../../stores/flowStore';
import { useRuntime } from '../../stores/runtimeStore';
import styles from './SessionPanel.module.css';

export function ChatTab({ sessionId }: { sessionId: string }) {
  const flow = useFlow((s) => s.flow);
  const messages = useRuntime((s) => s.messages[sessionId]);
  const draft = useRuntime((s) => s.drafts[sessionId]);
  const loadMessages = useRuntime((s) => s.loadMessages);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);

  const flowId = flow?.id;
  useEffect(() => {
    if (flowId) void loadMessages(flowId, sessionId);
  }, [flowId, sessionId, loadMessages]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages, draft]);

  if (!flow) return null;
  const session = findSession(flow, sessionId);
  if (!session) return null;

  const send = () => {
    const value = text.trim();
    if (!value) return;
    engineSocket.send({ type: 'session.send', flowId: flow.id, sessionId, text: value });
    setText('');
  };

  const authorName = (author: string, fromSessionId: string | null): string => {
    if (author === 'user') return t('panel.you');
    if (author === 'system') return t('panel.system');
    if (author === 'session' && fromSessionId)
      return findSession(flow, fromSessionId)?.name ?? fromSessionId;
    return session.name;
  };

  return (
    <>
      <div className={styles.body}>
        <div className={styles.chat}>
          {(messages ?? []).length === 0 && !draft && (
            <p className={styles.empty}>{t('panel.noMessages')}</p>
          )}
          {(messages ?? []).map((m) => (
            <div
              key={m.id}
              className={cx(
                styles.msg,
                m.author === 'user' && styles.mine,
                m.author === 'system' && styles.sys,
              )}
              data-model={
                m.author === 'session' && m.fromSessionId
                  ? findSession(flow, m.fromSessionId)?.model
                  : session.model
              }
            >
              {m.author !== 'system' && (
                <div className={styles.from}>{authorName(m.author, m.fromSessionId)}</div>
              )}
              <div className={styles.text}>{m.text}</div>
            </div>
          ))}
          {draft && (
            <div className={styles.msg} data-model={session.model}>
              <div className={styles.from}>{session.name}</div>
              <div className={styles.text}>{draft}</div>
            </div>
          )}
          <div ref={end} />
        </div>
      </div>
      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className={ui.input}
          rows={2}
          value={text}
          placeholder={t('panel.composerPlaceholder', { name: session.name })}
          onChange={(e) => {
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className={cx(ui.btn, ui.primary)} type="submit">
          {t('panel.send')}
        </button>
      </form>
    </>
  );
}
