import { describe, expect, it } from 'vitest';
import { formatTokens, formatUsd, percent } from './format';

describe('formato', () => {
  it('abrevia tokens', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(184_200)).toBe('184.2k');
    expect(formatTokens(2_500_000)).toBe('2.50M');
  });

  it('formatea dólares y porcentajes', () => {
    expect(formatUsd(3.456)).toBe('$3.46');
    expect(formatUsd(0.0048)).toBe('$0.005');
    expect(formatUsd(0)).toBe('$0.00');
    expect(percent(50, 200)).toBe(25);
    expect(percent(300, 200)).toBe(100);
    expect(percent(1, 0)).toBe(0);
  });
});
