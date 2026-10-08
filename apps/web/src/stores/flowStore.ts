import type { Flow, Result } from '@orquestador/core';
import { create } from 'zustand';
import { request } from '../api/http';
import { tMaybe } from '../i18n/t';
import { reportError } from './errors';
import { useUi } from './uiStore';

const SAVE_DELAY_MS = 400;

type Change = (flow: Flow) => Result<Flow, { code: string }> | Flow;

interface FlowState {
  flow: Flow | null;
  /** Hay cambios locales sin confirmar por el motor. */
  pending: boolean;
  load: (flowId: string) => Promise<void>;
  clear: () => void;
  /** Aplica un cambio local y lo guarda. Devuelve false y avisa si el dominio lo rechaza. */
  apply: (change: Change) => boolean;
  /** Cambio llegado del motor. Se ignora si hay cambios locales pendientes. */
  receive: (flow: Flow) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const useFlow = create<FlowState>((set, get) => {
  async function save(): Promise<void> {
    const flow = get().flow;
    if (!flow) return;
    try {
      await request('putFlow', { flowId: flow.id }, flow);
      if (get().flow === flow) set({ pending: false });
    } catch (e) {
      reportError(e);
      set({ pending: false });
      await get().load(flow.id);
    }
  }

  return {
    flow: null,
    pending: false,

    load: async (flowId) => {
      try {
        set({ flow: await request('getFlow', { flowId }), pending: false });
      } catch (e) {
        reportError(e);
      }
    },

    clear: () => {
      clearTimeout(saveTimer);
      set({ flow: null, pending: false });
    },

    apply: (change) => {
      const current = get().flow;
      if (!current) return false;
      const result = change(current);
      let next: Flow;
      if ('ok' in result) {
        if (!result.ok) {
          useUi.getState().toast(
            tMaybe(`errors.${result.error.code}`, 'errors.generic', {
              message: result.error.code,
            }),
          );
          return false;
        }
        next = result.value;
      } else {
        next = result;
      }
      set({ flow: next, pending: true });
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void save(), SAVE_DELAY_MS);
      return true;
    },

    receive: (flow) => {
      const current = get().flow;
      if (current?.id !== flow.id || get().pending) return;
      set({ flow });
    },
  };
});
