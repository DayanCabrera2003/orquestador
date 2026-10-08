import { composeInstructions } from '@orquestador/core';
import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { SystemEnvironmentProbe } from './adapters/env/environmentProbe';
import { GitWorkspace } from './adapters/git/gitWorkspace';
import { SqliteStore } from './adapters/sqlite/sqliteStore';
import type { AppContext } from './app/context';
import { AppError } from './app/errors';
import { EventBus } from './app/events';
import * as flows from './app/flows';
import * as projects from './app/projects';
import { RuntimeRegistry } from './app/runtime';
import * as settings from './app/settings';
import type { Handlers } from './http/routes';
import { registerRoutes } from './http/routes';
import { registerSecurity } from './http/security';
import { registerGateway, type CommandHandler } from './ws/gateway';

export interface ServerOptions {
  /** Ruta del archivo SQLite, o `:memory:`. */
  databasePath: string;
  token: string;
  allowedOrigins: readonly string[];
  /** 0 elige un puerto libre. */
  port: number;
  /** Comando de la CLI del agente. */
  agentCommand: string;
  logger: boolean;
}

export interface RunningServer {
  port: number;
  app: FastifyInstance;
  context: AppContext;
  runtime: RuntimeRegistry;
  close: () => Promise<void>;
}

function handlers(ctx: AppContext, runtime: RuntimeRegistry): Handlers {
  return {
    environment: () => ctx.environment.detect(),
    getSettings: () => settings.getSettings(ctx),
    putSettings: ({ body }) => settings.saveSettings(ctx, body),
    listProjects: () => projects.listProjects(ctx),
    addProject: ({ body }) => projects.addProject(ctx, body.path),
    removeProject: ({ params }) => {
      projects.removeProject(ctx, params.projectId);
      return {};
    },
    listFlows: ({ params }) => flows.listFlows(ctx, params.projectId),
    createFlow: ({ params, body }) => flows.createFlow(ctx, params.projectId, body.name),
    getFlow: ({ params }) => flows.getFlow(ctx, params.flowId),
    putFlow: ({ params, body }) => flows.saveFlow(ctx, params.flowId, body),
    deleteFlow: ({ params }) => {
      flows.deleteFlow(ctx, params.flowId);
      return {};
    },
    exportFlowYaml: ({ params }) => ({ yaml: flows.exportFlowYaml(ctx, params.flowId) }),
    importFlowYaml: ({ params, body }) => flows.importFlowYaml(ctx, params.projectId, body.yaml),
    listRuntime: ({ params }) => runtime.list(params.flowId),
    listMessages: ({ params }) => ctx.store.listMessages(params.flowId, params.sessionId),
    composedInstructions: ({ params }) => {
      const r = composeInstructions(flows.getFlow(ctx, params.flowId), params.sessionId);
      if (!r.ok) throw new AppError('not-found', `Sesión ${params.sessionId} no existe`);
      return { text: r.value };
    },
    listInbox: () => ctx.store.listInbox(),
  };
}

/** Arranca el motor local. */
export async function startServer(
  options: ServerOptions,
  onCommand: (ctx: AppContext, runtime: RuntimeRegistry) => CommandHandler = () => () =>
    Promise.resolve(),
): Promise<RunningServer> {
  const context: AppContext = {
    store: new SqliteStore(options.databasePath),
    workspace: new GitWorkspace(),
    environment: new SystemEnvironmentProbe(options.agentCommand),
    events: new EventBus(),
    now: () => new Date().toISOString(),
    newId: () => randomUUID(),
  };
  const runtime = new RuntimeRegistry(context);
  // Al cerrar, corta también las conexiones abiertas: la app se apaga junto con la ventana.
  const app = Fastify({ logger: options.logger, forceCloseConnections: true });

  registerSecurity(app, { token: options.token, allowedOrigins: options.allowedOrigins });
  await registerGateway(app, context.events, onCommand(context, runtime));
  registerRoutes(app, handlers(context, runtime));

  await app.listen({ host: '127.0.0.1', port: options.port });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;

  return {
    port,
    app,
    context,
    runtime,
    close: async () => {
      await app.close();
      context.store.close();
    },
  };
}
