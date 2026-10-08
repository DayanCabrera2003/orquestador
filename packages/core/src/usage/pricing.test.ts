import { describe, expect, it } from 'vitest';
import { PricingTableSchema } from './pricing';

const price = {
  inputPerMTok: 3,
  outputPerMTok: 15,
  cacheReadPerMTok: 0.3,
  cacheWritePerMTok: 3.75,
};

describe('PricingTableSchema', () => {
  it('exige precio para los tres modelos', () => {
    expect(PricingTableSchema.safeParse({ opus: price, sonnet: price, haiku: price }).success).toBe(
      true,
    );
    expect(PricingTableSchema.safeParse({ opus: price, sonnet: price }).success).toBe(false);
  });

  it('rechaza precios negativos', () => {
    const bad = { ...price, outputPerMTok: -1 };
    expect(PricingTableSchema.safeParse({ opus: bad, sonnet: price, haiku: price }).success).toBe(
      false,
    );
  });
});
