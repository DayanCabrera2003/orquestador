import {
  CURRENT_SCHEMA_VERSION,
  parseFlowYaml,
  serializeFlowYaml,
  validateFlow,
  type Flow,
} from '@orquestador/core';
import type { FlowSummary } from '@orquestador/protocol';
import type { AppContext } from './context';
import { AppError } from './errors';
import { requireProject } from './projects';

const DEFAULT_FLOW_BUDGET_USD = 10;

export function listFlows(ctx: AppContext, projectId: string): FlowSummary[] {
  requireProject(ctx, projectId);
  return ctx.store.listFlows(projectId);
}

export function getFlow({ store }: AppContext, flowId: string): Flow {
  const stored = store.getFlow(flowId);
  if (!stored) throw new AppError('not-found', `Flujo ${flowId} no existe`);
  return stored.flow;
}

export function projectOfFlow({ store }: AppContext, flowId: string): string {
  const stored = store.getFlow(flowId);
  if (!stored) throw new AppError('not-found', `Flujo ${flowId} no existe`);
  return stored.projectId;
}

export function createFlow(ctx: AppContext, projectId: string, name: string): Flow {
  requireProject(ctx, projectId);
  const flow: Flow = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: ctx.newId(),
    name,
    budgetUsd: DEFAULT_FLOW_BUDGET_USD,
    sessions: [],
  };
  ctx.store.saveFlow({ projectId, flow, updatedAt: ctx.now() });
  return flow;
}

/** Reemplaza un flujo completo tras validar su consistencia. */
export function saveFlow(ctx: AppContext, flowId: string, flow: Flow): Flow {
  if (flow.id !== flowId) throw new AppError('invalid', 'El id del flujo no coincide con la ruta');
  const projectId = projectOfFlow(ctx, flowId);
  const issues = validateFlow(flow);
  if (issues.length > 0) throw new AppError('invalid', 'El flujo no es consistente', { issues });
  ctx.store.saveFlow({ projectId, flow, updatedAt: ctx.now() });
  ctx.events.publish({ type: 'flow.updated', flow });
  return flow;
}

export function deleteFlow(ctx: AppContext, flowId: string): void {
  projectOfFlow(ctx, flowId);
  ctx.store.deleteFlow(flowId);
}

export function exportFlowYaml(ctx: AppContext, flowId: string): string {
  return serializeFlowYaml(getFlow(ctx, flowId));
}

/** Importa un flujo desde YAML como uno nuevo del proyecto, con id propio. */
export function importFlowYaml(ctx: AppContext, projectId: string, yaml: string): Flow {
  requireProject(ctx, projectId);
  const parsed = parseFlowYaml(yaml);
  if (!parsed.ok) throw new AppError('invalid', 'El YAML no es un flujo válido', parsed.error);
  const flow: Flow = { ...parsed.value, id: ctx.newId() };
  ctx.store.saveFlow({ projectId, flow, updatedAt: ctx.now() });
  return flow;
}
