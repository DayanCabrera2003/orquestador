import type { ModelPrice } from './pricing';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

/** Costo en USD de un consumo dado el precio del modelo. */
export function costUsd(usage: TokenUsage, price: ModelPrice): number {
  return (
    (usage.inputTokens * price.inputPerMTok +
      usage.outputTokens * price.outputPerMTok +
      usage.cacheReadTokens * price.cacheReadPerMTok +
      usage.cacheWriteTokens * price.cacheWritePerMTok) /
    1_000_000
  );
}

/** Fracción de la ventana de contexto ocupada, entre 0 y 1. */
export function contextUsageRatio(contextTokens: number, contextWindow: number): number {
  if (contextWindow <= 0) return 0;
  return Math.min(1, Math.max(0, contextTokens / contextWindow));
}
