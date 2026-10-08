import { findSession } from '@orquestador/core';
import { useState } from 'react';
import { engineSocket } from '../../api/socket';
import { Medal } from '../../components/Medal';
import { Modal } from '../../components/Modal';
import ui from '../../components/ui.module.css';
import { t } from '../../i18n/t';
import { cx } from '../../lib/cx';
import { useFlow } from '../../stores/flowStore';
import { useRuntime } from '../../stores/runtimeStore';
import { useUi } from '../../stores/uiStore';
import styles from './InboxModal.module.css';

function FreeAnswer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form
      className={styles.free}
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSend(text.trim());
      }}
    >
      <input
        className={ui.input}
        value={text}
        placeholder={t('inbox.freePlaceholder')}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <button className={cx(ui.btn, ui.small)} type="submit">
        {t('inbox.send')}
      </button>
    </form>
  );
}

export function InboxModal() {
  const open = useUi((s) => s.inboxOpen);
  const setOpen = useUi((s) => s.setInboxOpen);
  const items = useRuntime((s) => s.inbox);
  const flow = useFlow((s) => s.flow);
  if (!open || !flow) return null;

  const answer = (itemId: string, text: string) => {
    engineSocket.send({ type: 'inbox.answer', itemId, answer: text });
  };

  return (
    <Modal
      title={t('inbox.title')}
      subtitle={t('inbox.subtitle')}
      onClose={() => {
        setOpen(false);
      }}
      footer={
        <button
          className={ui.btn}
          onClick={() => {
            setOpen(false);
          }}
        >
          {t('inbox.close')}
        </button>
      }
    >
      {items.length === 0 && <p className={styles.empty}>{t('inbox.empty')}</p>}
      {items.map((item) => (
        <article key={item.id} className={styles.item}>
          <div className={styles.route}>
            {item.route.map((id) => {
              const s = findSession(flow, id);
              return s ? (
                <span key={id} className={styles.hop}>
                  <Medal model={s.model} size="xs" />
                  {s.name}
                  <span className={styles.arrow}>→</span>
                </span>
              ) : null;
            })}
            <b>{t('inbox.you')}</b>
            <span className={styles.tag}>{t(`inbox.${item.kind}`)}</span>
          </div>
          <h4>{item.question}</h4>
          {item.context && <p>{item.context}</p>}
          {item.options.length > 0 && (
            <div className={styles.options}>
              {item.options.map((o) => (
                <button
                  key={o}
                  className={ui.btn}
                  onClick={() => {
                    answer(item.id, o);
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          <FreeAnswer
            onSend={(text) => {
              answer(item.id, text);
            }}
          />
        </article>
      ))}
    </Modal>
  );
}
