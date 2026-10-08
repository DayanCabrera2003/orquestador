import type { ChatMessage, InboxItem, ServerEvent, SessionRuntime } from '@orquestador/protocol';
import { create } from 'zustand';
import { request } from '../api/http';
import { edgeForMessage } from '../features/canvas/graphView';
import { reportError } from './errors';
import { useFlow } from './flowStore';

const HISTORY_POINTS = 60;
const PULSE_MS = 1600;

export interface Pulse {
  key: number;
  edgeId: string;
  reverse: boolean;
}

interface RuntimeState {
  runtimes: Record<string, SessionRuntime>;
  /** Gasto acumulado de cada sesión, muestreado en cada actualización. */
  costHistory: Record<string, number[]>;
  messages: Record<string, ChatMessage[]>;
  /** Texto que el agente está escribiendo en este momento. */
  drafts: Record<string, string>;
  inbox: InboxItem[];
  pulses: Pulse[];
  loadFlow: (flowId: string) => Promise<void>;
  loadMessages: (flowId: string, sessionId: string) => Promise<void>;
  handle: (event: ServerEvent) => void;
  reset: () => void;
}

let nextPulse = 1;

export const useRuntime = create<RuntimeState>((set, get) => ({
  runtimes: {},
  costHistory: {},
  messages: {},
  drafts: {},
  inbox: [],
  pulses: [],

  loadFlow: async (flowId) => {
    try {
      const [list, inbox] = await Promise.all([
        request('listRuntime', { flowId }),
        request('listInbox', {}),
      ]);
      const runtimes = Object.fromEntries(list.map((r) => [r.sessionId, r]));
      const costHistory = Object.fromEntries(list.map((r) => [r.sessionId, [r.costUsd]]));
      set({ runtimes, costHistory, inbox: inbox.filter((i) => i.flowId === flowId) });
    } catch (e) {
      reportError(e);
    }
  },

  loadMessages: async (flowId, sessionId) => {
    try {
      const list = await request('listMessages', { flowId, sessionId });
      set({ messages: { ...get().messages, [sessionId]: list } });
    } catch (e) {
      reportError(e);
    }
  },

  handle: (event) => {
    const state = get();
    switch (event.type) {
      case 'session.runtime': {
        const r = event.runtime;
        if (useFlow.getState().flow?.id !== r.flowId) return;
        const history = [...(state.costHistory[r.sessionId] ?? []), r.costUsd].slice(
          -HISTORY_POINTS,
        );
        set({
          runtimes: { ...state.runtimes, [r.sessionId]: r },
          costHistory: { ...state.costHistory, [r.sessionId]: history },
        });
        return;
      }
      case 'session.delta': {
        set({
          drafts: {
            ...state.drafts,
            [event.sessionId]: (state.drafts[event.sessionId] ?? '') + event.text,
          },
        });
        return;
      }
      case 'session.message': {
        const m = event.message;
        const drafts =
          m.author === 'agent'
            ? Object.fromEntries(Object.entries(state.drafts).filter(([id]) => id !== m.sessionId))
            : state.drafts;
        set({
          messages: {
            ...state.messages,
            [m.sessionId]: [...(state.messages[m.sessionId] ?? []), m],
          },
          drafts,
        });
        return;
      }
      case 'relation.message': {
        const flow = useFlow.getState().flow;
        if (flow?.id !== event.flowId) return;
        const edge = edgeForMessage(flow, event.fromSessionId, event.toSessionId);
        if (!edge) return;
        const pulse = { key: nextPulse++, ...edge };
        set({ pulses: [...state.pulses, pulse] });
        setTimeout(() => {
          set({ pulses: get().pulses.filter((p) => p.key !== pulse.key) });
        }, PULSE_MS);
        return;
      }
      case 'inbox.added': {
        if (useFlow.getState().flow?.id === event.item.flowId)
          set({ inbox: [...state.inbox, event.item] });
        return;
      }
      case 'inbox.resolved': {
        set({ inbox: state.inbox.filter((i) => i.id !== event.itemId) });
        return;
      }
      case 'flow.updated': {
        useFlow.getState().receive(event.flow);
        return;
      }
      case 'error': {
        reportError(new Error(event.message));
        return;
      }
      case 'terminal.data':
      case 'terminal.exit':
        return;
    }
  },

  reset: () => {
    set({ runtimes: {}, costHistory: {}, messages: {}, drafts: {}, inbox: [], pulses: [] });
  },
}));
