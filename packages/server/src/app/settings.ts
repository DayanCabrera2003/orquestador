import type { Settings } from '@orquestador/protocol';
import type { AppContext } from './context';

/**
 * Valores iniciales. El usuario puede cambiarlos en preferencias y quedan guardados.
 * Precios en USD por millón de tokens.
 */
export const DEFAULT_SETTINGS: Settings = {
  pricing: {
    opus: { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
    sonnet: { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75 },
    haiku: { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
  },
  contextWindow: { opus: 200_000, sonnet: 200_000, haiku: 200_000 },
};

export function getSettings({ store }: AppContext): Settings {
  return store.getSettings() ?? DEFAULT_SETTINGS;
}

export function saveSettings({ store }: AppContext, settings: Settings): Settings {
  store.saveSettings(settings);
  return settings;
}
