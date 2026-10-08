import {
  ApiErrorSchema,
  AUTH_HEADER,
  buildPath,
  ROUTES,
  type RouteBody,
  type RouteName,
  type RouteParams,
  type RouteResponse,
} from '@orquestador/protocol';
import { engineConfig } from './config';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Llama a una ruta del contrato y valida la respuesta con su esquema. */
export async function request<N extends RouteName>(
  name: N,
  params: RouteParams<N>,
  ...[body]: RouteBody<N> extends undefined ? [] : [RouteBody<N>]
): Promise<RouteResponse<N>> {
  const def = ROUTES[name];
  const { httpBase, token } = engineConfig();
  const response = await fetch(`${httpBase}${buildPath(name, params)}`, {
    method: def.method,
    headers: {
      [AUTH_HEADER]: token,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(data);
    throw parsed.success
      ? new ApiError(parsed.data.code, response.status, parsed.data.message, parsed.data.details)
      : new ApiError('generic', response.status, `HTTP ${String(response.status)}`);
  }
  return def.response.parse(data) as RouteResponse<N>;
}
