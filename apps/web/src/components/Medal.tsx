import type { ModelTier } from '@orquestador/core';
import { cx } from '../lib/cx';
import styles from './ui.module.css';

const LETTER: Record<ModelTier, string> = { opus: 'O', sonnet: 'S', haiku: 'H' };
const SIZE = { md: '', lg: styles.medalLg, sm: styles.medalSm, xs: styles.medalXs } as const;

export function Medal({ model, size = 'md' }: { model: ModelTier; size?: keyof typeof SIZE }) {
  return (
    <span className={cx(styles.medal, SIZE[size])} data-model={model} aria-hidden="true">
      {LETTER[model]}
    </span>
  );
}
