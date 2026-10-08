import { composeInstructions } from '@orquestador/core';
import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { SystemEnvironmentProbe } from './adapters/env/environmentProbe';
import { GitWorkspace } from './adapters/git/gitWorkspace';
import { ClaudeAgentRuntime } from './adapters/agent-sdk/claudeAgentRuntime';
import { NodePtyTerminal } from './adapters/pty/nodePtyTerminal';
import { SqliteStore } from './adapters/sqlite/sqliteStore';
import type { AppContext } from './app/context';
import { AppError } from './app/errors';
import { EventBus } from './app/events';
import * as flows from './app/flows';
import * as projects from './app/projects';
import { RuntimeRegistry } from './app/runtime';
import { SessionManager } from './app/sessions';
import { TerminalManager } from './app/terminals';
import * as settings from './app/settings';
import type { Handlers } from './http/routes';
import { registerRoutes } from './http/routes';
import { registerSecurity } from './http/security';
import type { AgentRuntime } from './ports/AgentRuntime';
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
  /** Carpeta donde se crean los worktrees de las sesiones. */
  worktreesDir: string;
  logger: boolean;
  /** Ejecutor de sesiones; por defecto, el SDK del agente. */
  agentRuntime?: AgentRuntime;
}

export interface RunningServer {
  port: number;
  app: FastifyInstance;
  context: AppContext;
  runtime: RuntimeRegistry;
  sessions: SessionManager;
  close: () => Promise<void>;
}

function commandHandler(sessions: SessionManager, terminals: TerminalManager): CommandHandler {
  return async (command) => {
    switch (command.type) {
      case 'flow.subscribe':
        return;
      case 'flow.start':
        return sessions.startFlow(command.flowId);
      case 'flow.pause':
        return sessions.pauseFlow(command.flowId);
      case 'session.start':
        await sessions.start(command.flowId, command.sessionId);
        return;
      case 'session.pause':
        return sessions.pause(command.flowId, command.sessionId);
      case 'session.resume':
        return sessions.resume(command.flowId, command.sessionId);
      case 'session.send':
        return sessions.deliver(command.flowId, command.sessionId, { kind: 'user' }, command.text);
      case 'inbox.answer':
        return sessions.answerInbox(command.itemId, command.answer);
      case 'terminal.open':
        return terminals.openTerminal(
          command.flowId,
          command.sessionId,
          command.cols,
          command.rows,
        );
      case 'terminal.input':
        terminals.input(command.flowId, command.sessionId, command.data);
        return;
      case 'terminal.resize':
        terminals.resize(command.flowId, command.sessionId, command.cols, command.rows);
        return;
      case 'terminal.close':
        terminals.close(command.flowId, command.sessionId);
        return;
    }
  };
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
export async function startServer(options: ServerOptions): Promise<RunningServer> {
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
  const agents =
    options.agentRuntime ??
    new ClaudeAgentRuntime(options.agentCommand, (line) => {
      app.log.debug({ agent: line.trim() });
    });
  const sessions = new SessionManager(context, runtime, agents, options.worktreesDir);
  const terminals = new TerminalManager(context, sessions, agents, new NodePtyTerminal());
  await registerGateway(app, context.events, commandHandler(sessions, terminals));
  registerRoutes(app, handlers(context, runtime));

  await app.listen({ host: '127.0.0.1', port: options.port });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;

  return {
    port,
    app,
    context,
    runtime,
    sessions,
    close: async () => {
      terminals.closeAll();
      sessions.closeAll();
      await app.close();
      context.store.close();
    },
  };
}
