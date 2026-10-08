import { describe, expect, it } from 'vitest';
import { COORDINATION_TOOLS } from './tools';

describe('COORDINATION_TOOLS', () => {
  it('usa nombres únicos en snake_case', () => {
    const names = Object.values(COORDINATION_TOOLS);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });
});
