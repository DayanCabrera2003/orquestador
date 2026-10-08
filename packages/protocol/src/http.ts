import { FlowSchema } from '@orquestador/core';
import { z } from 'zod';
import {
  ChatMessageSchema,
  EnvironmentSchema,
  FlowSummarySchema,
  InboxItemSchema,
  ProjectSchema,
  SessionRuntimeSchema,
  SettingsSchema,
} from './entities';

/** Cabecera que el cliente debe enviar en cada request con el token de la instancia. */
export const AUTH_HEADER = 'x-orquestador-token';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RouteDef<Params extends string, Body extends z.ZodType, Res extends z.ZodType> {
  method: Method;
  path: string;
  params: readonly Params[];
  body: Body;
  response: Res;
}

const route = <const Params extends string, Body extends z.ZodType, Res extends z.ZodType>(
  method: Method,
  path: string,
  params: readonly Params[],
  body: Body,
  response: Res,
): RouteDef<Params, Body, Res> => ({ method, path, params, body, response });

const NoBody = z.undefined();
const Empty = z.object({});

/** Contrato HTTP del motor. Las rutas usan `:param` al estilo de Fastify. */
export const ROUTES = {
  environment: route('GET', '/api/environment', [], NoBody, EnvironmentSchema),

  getSettings: route('GET', '/api/settings', [], NoBody, SettingsSchema),
  putSettings: route('PUT', '/api/settings', [], SettingsSchema, SettingsSchema),

  listProjects: route('GET', '/api/projects', [], NoBody, z.array(ProjectSchema)),
  addProject: route(
    'POST',
    '/api/projects',
    [],
    z.object({ path: z.string().min(1) }),
    ProjectSchema,
  ),
  removeProject: route('DELETE', '/api/projects/:projectId', ['projectId'], NoBody, Empty),

  listFlows: route(
    'GET',
    '/api/projects/:projectId/flows',
    ['projectId'],
    NoBody,
    z.array(FlowSummarySchema),
  ),
  createFlow: route(
    'POST',
    '/api/projects/:projectId/flows',
    ['projectId'],
    z.object({ name: z.string().trim().min(1) }),
    FlowSchema,
  ),
  getFlow: route('GET', '/api/flows/:flowId', ['flowId'], NoBody, FlowSchema),
  /** Guarda el flujo completo. El motor lo valida con `validateFlow` antes de aceptarlo. */
  putFlow: route('PUT', '/api/flows/:flowId', ['flowId'], FlowSchema, FlowSchema),
  deleteFlow: route('DELETE', '/api/flows/:flowId', ['flowId'], NoBody, Empty),
  exportFlowYaml: route(
    'GET',
    '/api/flows/:flowId/yaml',
    ['flowId'],
    NoBody,
    z.object({ yaml: z.string() }),
  ),
  importFlowYaml: route(
    'POST',
    '/api/projects/:projectId/flows/import',
    ['projectId'],
    z.object({ yaml: z.string() }),
    FlowSchema,
  ),

  listRuntime: route(
    'GET',
    '/api/flows/:flowId/runtime',
    ['flowId'],
    NoBody,
    z.array(SessionRuntimeSchema),
  ),
  listMessages: route(
    'GET',
    '/api/flows/:flowId/sessions/:sessionId/messages',
    ['flowId', 'sessionId'],
    NoBody,
    z.array(ChatMessageSchema),
  ),
  composedInstructions: route(
    'GET',
    '/api/flows/:flowId/sessions/:sessionId/instructions',
    ['flowId', 'sessionId'],
    NoBody,
    z.object({ text: z.string() }),
  ),

  listInbox: route('GET', '/api/inbox', [], NoBody, z.array(InboxItemSchema)),
} as const;

export type Routes = typeof ROUTES;
export type RouteName = keyof Routes;
export type RouteParams<N extends RouteName> = Record<Routes[N]['params'][number], string>;
export type RouteBody<N extends RouteName> = z.input<Routes[N]['body']>;
export type RouteResponse<N extends RouteName> = z.output<Routes[N]['response']>;

/** Sustituye los `:param` de una ruta. Codifica cada valor. */
export function buildPath<N extends RouteName>(name: N, params: RouteParams<N>): string {
  return ROUTES[name].path.replace(/:([A-Za-z]+)/g, (_, key: string) => {
    const value = (params as Record<string, string | undefined>)[key];
    if (value === undefined) throw new Error(`Falta el parámetro ${key} en ${name}`);
    return encodeURIComponent(value);
  });
}

/** Error que devuelve el motor en cualquier respuesta no exitosa. */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
