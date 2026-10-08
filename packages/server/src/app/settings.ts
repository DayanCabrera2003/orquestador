import type { Settings } from '@orquestador/protocol';
import type { AppContext } from './context';

/**
 * Valores iniciales. El usuario puede cambiarlos en preferencias y quedan guardados.
 * Precios en USD por millón de tokens.
 */
export const DEFAULT_SETTINGS: Settings = {
  pricing: {
    opus: { inputPerMTok: 4, outputPerMTok: 20, cacheReadPerMTok: 0.2, cacheWritePerMTok: 5 },
    sonnet: { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2.5 },
    haiku: {
      inputPerMTok: 0.1,
      outputPerMTok: 0.5,
      cacheReadPerMTok: 0.01,
      cacheWritePerMTok: 0.125,
    },
  },
  contextWindow: { opus: 1_000_000, sonnet: 1_000_000, haiku: 1_000_000 },
};

export function getSettings({ store }: AppContext): Settings {
  return store.getSettings() ?? DEFAULT_SETTINGS;
}

export function saveSettings({ store }: AppContext, settings: Settings): Settings {
  store.saveSettings(settings);
  return settings;
}
