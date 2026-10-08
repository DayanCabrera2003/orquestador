import type { SessionStatus } from '@orquestador/core';
import { t } from '../i18n/t';
import { cx } from '../lib/cx';
import styles from './ui.module.css';

export function StatusPill({ status }: { status: SessionStatus }) {
  return (
    <span className={cx(styles.pill, styles[`st-${status}`])}>
      <i className={styles.dot} />
      {t(`status.${status}`)}
    </span>
  );
}
