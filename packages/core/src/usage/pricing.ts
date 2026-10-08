import { z } from 'zod';

const UsdPerMillionTokens = z.number().nonnegative();

export const ModelPriceSchema = z.object({
  inputPerMTok: UsdPerMillionTokens,
  outputPerMTok: UsdPerMillionTokens,
  cacheReadPerMTok: UsdPerMillionTokens,
  cacheWritePerMTok: UsdPerMillionTokens,
});
export type ModelPrice = z.infer<typeof ModelPriceSchema>;

/** Precio por modelo, en USD por millón de tokens. Los valores vienen de la configuración. */
export const PricingTableSchema = z.object({
  opus: ModelPriceSchema,
  sonnet: ModelPriceSchema,
  haiku: ModelPriceSchema,
});
export type PricingTable = z.infer<typeof PricingTableSchema>;
