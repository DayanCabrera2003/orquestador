import { create } from 'zustand';

export type PanelTab = 'chat' | 'terminal' | 'config' | 'usage';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export interface NewSessionRequest {
  position?: { x: number; y: number };
  /** Relación que se crea con la nueva sesión al confirmarla. */
  link?: { fromId: string; kind: 'report' | 'subagent' };
}

interface UiState {
  selectedSessionId: string | null;
  tab: PanelTab;
  newSession: NewSessionRequest | null;
  inboxOpen: boolean;
  toasts: Toast[];
  select: (id: string | null, tab?: PanelTab) => void;
  setTab: (tab: PanelTab) => void;
  openNewSession: (request?: NewSessionRequest) => void;
  closeNewSession: () => void;
  setInboxOpen: (open: boolean) => void;
  toast: (text: string, action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
}

let nextToast = 1;

export const useUi = create<UiState>((set, get) => ({
  selectedSessionId: null,
  tab: 'chat',
  newSession: null,
  inboxOpen: false,
  toasts: [],
  select: (id, tab) => {
    set({ selectedSessionId: id, ...(tab ? { tab } : {}) });
  },
  setTab: (tab) => {
    set({ tab });
  },
  openNewSession: (request = {}) => {
    set({ newSession: request });
  },
  closeNewSession: () => {
    set({ newSession: null });
  },
  setInboxOpen: (open) => {
    set({ inboxOpen: open });
  },
  toast: (text, action) => {
    const id = nextToast++;
    set({ toasts: [...get().toasts, { id, text, ...(action ? { action } : {}) }] });
    setTimeout(
      () => {
        get().dismissToast(id);
      },
      action ? 6000 : 3500,
    );
  },
  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((x) => x.id !== id) });
  },
}));
