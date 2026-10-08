import {
  ROUTES,
  type RouteBody,
  type RouteName,
  type RouteParams,
  type RouteResponse,
} from '@orquestador/protocol';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../app/errors';

type Handler<N extends RouteName> = (input: {
  params: RouteParams<N>;
  body: RouteBody<N>;
}) => RouteResponse<N> | Promise<RouteResponse<N>>;

export type Handlers = { [N in RouteName]: Handler<N> };

/** Registra todas las rutas del contrato. El cuerpo se valida con el esquema de cada ruta. */
export function registerRoutes(app: FastifyInstance, handlers: Handlers): void {
  for (const name of Object.keys(ROUTES) as RouteName[]) {
    const def = ROUTES[name];
    const handler = handlers[name] as Handler<RouteName>;
    app.route({
      method: def.method,
      url: def.path,
      handler: async (req) => {
        const body: unknown = def.body.parse(req.body ?? undefined);
        return handler({
          params: req.params as RouteParams<RouteName>,
          body: body as RouteBody<RouteName>,
        });
      },
    });
  }

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply
        .code(error.status)
        .send({ code: error.code, message: error.message, details: error.details });
    }
    if (error instanceof ZodError) {
      return reply
        .code(400)
        .send({ code: 'invalid', message: 'Datos inválidos', details: error.issues });
    }
    app.log.error(error);
    return reply.code(500).send({ code: 'internal', message: 'Error interno' });
  });
}
