import type { Environment, FlowSummary, Project, Settings } from '@orquestador/protocol';
import { create } from 'zustand';
import { request } from '../api/http';
import { reportError } from './errors';

interface AppState {
  ready: boolean;
  connected: boolean;
  environment: Environment | null;
  settings: Settings | null;
  projects: Project[];
  projectId: string | null;
  flows: FlowSummary[];
  flowId: string | null;
  init: () => Promise<void>;
  setConnected: (connected: boolean) => void;
  openProject: (path: string) => Promise<void>;
  selectProject: (id: string | null) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  refreshFlows: () => Promise<void>;
  createFlow: (name: string) => Promise<void>;
  openFlow: (id: string | null) => void;
  renameFlow: (id: string, name: string) => Promise<void>;
  duplicateFlow: (id: string) => Promise<void>;
  deleteFlow: (id: string) => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  connected: false,
  environment: null,
  settings: null,
  projects: [],
  projectId: null,
  flows: [],
  flowId: null,

  init: async () => {
    try {
      const [environment, settings, projects] = await Promise.all([
        request('environment', {}),
        request('getSettings', {}),
        request('listProjects', {}),
      ]);
      set({ environment, settings, projects, ready: true });
    } catch (e) {
      reportError(e);
    }
  },

  setConnected: (connected) => {
    set({ connected });
  },

  openProject: async (path) => {
    try {
      const project = await request('addProject', {}, { path });
      const projects = await request('listProjects', {});
      set({ projects });
      await get().selectProject(project.id);
    } catch (e) {
      reportError(e);
    }
  },

  selectProject: async (id) => {
    set({ projectId: id, flows: [], flowId: null });
    if (id) await get().refreshFlows();
  },

  removeProject: async (id) => {
    try {
      await request('removeProject', { projectId: id });
      set({ projects: get().projects.filter((p) => p.id !== id) });
    } catch (e) {
      reportError(e);
    }
  },

  refreshFlows: async () => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      set({ flows: await request('listFlows', { projectId }) });
    } catch (e) {
      reportError(e);
    }
  },

  createFlow: async (name) => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      const flow = await request('createFlow', { projectId }, { name });
      await get().refreshFlows();
      set({ flowId: flow.id });
    } catch (e) {
      reportError(e);
    }
  },

  openFlow: (id) => {
    set({ flowId: id });
  },

  renameFlow: async (id, name) => {
    try {
      const flow = await request('getFlow', { flowId: id });
      await request('putFlow', { flowId: id }, { ...flow, name });
      await get().refreshFlows();
    } catch (e) {
      reportError(e);
    }
  },

  duplicateFlow: async (id) => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      const { yaml } = await request('exportFlowYaml', { flowId: id });
      const copy = await request('importFlowYaml', { projectId }, { yaml });
      await request('putFlow', { flowId: copy.id }, { ...copy, name: `${copy.name} (copia)` });
      await get().refreshFlows();
    } catch (e) {
      reportError(e);
    }
  },

  deleteFlow: async (id) => {
    try {
      await request('deleteFlow', { flowId: id });
      await get().refreshFlows();
    } catch (e) {
      reportError(e);
    }
  },
}));
