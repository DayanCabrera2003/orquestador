import { describe, expect, it } from 'vitest';
import { addUsage, contextUsageRatio, costUsd, EMPTY_USAGE } from './cost';

const price = {
  inputPerMTok: 3,
  outputPerMTok: 15,
  cacheReadPerMTok: 0.3,
  cacheWritePerMTok: 3.75,
};

describe('costUsd', () => {
  it('suma cada tipo de token a su precio', () => {
    const usage = {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheReadTokens: 2_000_000,
      cacheWriteTokens: 0,
    };
    expect(costUsd(usage, price)).toBeCloseTo(3 + 1.5 + 0.6, 10);
  });

  it('es cero sin consumo', () => {
    expect(costUsd(EMPTY_USAGE, price)).toBe(0);
  });
});

describe('addUsage', () => {
  it('acumula campo a campo', () => {
    const a = { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 };
    expect(addUsage(a, a)).toEqual({
      inputTokens: 2,
      outputTokens: 4,
      cacheReadTokens: 6,
      cacheWriteTokens: 8,
    });
  });
});

describe('contextUsageRatio', () => {
  it('devuelve la fracción usada, limitada entre 0 y 1', () => {
    expect(contextUsageRatio(50_000, 200_000)).toBe(0.25);
    expect(contextUsageRatio(300_000, 200_000)).toBe(1);
    expect(contextUsageRatio(10, 0)).toBe(0);
  });
});
