import {
  createSdkMcpServer,
  query,
  tool,
  type AgentDefinition,
  type CanUseTool,
  type SDKMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { COORDINATION_TOOLS, type ModelTier, type Permissions } from '@orquestador/core';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import type {
  AgentCallbacks,
  AgentHandle,
  AgentRuntime,
  AgentStartOptions,
  CoordinationHandlers,
  TerminalLaunch,
} from '../../ports/AgentRuntime';
import { InputQueue } from './inputQueue';

/** Modelos actuales de cada nivel. */
const MODEL_IDS: Record<ModelTier, string> = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
};

const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
export const COORDINATION_SERVER = 'orquestador';

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
/** Siempre visibles: son pocas y la sesión las necesita sin buscarlas. */
const ALWAYS = { alwaysLoad: true };

function coordinationServer(h: CoordinationHandlers) {
  const T = COORDINATION_TOOLS;
  return createSdkMcpServer({
    name: COORDINATION_SERVER,
    version: '1.0.0',
    tools: [
      tool(
        T.askParent,
        'Pregunta una duda de implementación a la sesión a la que reportas. La respuesta llega después como mensaje.',
        { question: z.string() },
        async ({ question }) => text(await h.askParent(question)),
        ALWAYS,
      ),
      tool(
        T.askUser,
        'Pregunta directamente al usuario. Úsalo para decisiones de diseño o permisos. La respuesta llega después como mensaje.',
        {
          question: z.string(),
          kind: z.enum(['design', 'permission', 'question']),
          options: z.array(z.string()).optional(),
          context: z.string().optional(),
        },
        async ({ question, kind, options, context }) =>
          text(await h.askUser(question, kind, options ?? [], context ?? '')),
        ALWAYS,
      ),
      tool(
        T.delegateTask,
        'Asigna una tarea concreta a una sesión que te reporta (por nombre). La inicia si no está en marcha.',
        { session: z.string(), task: z.string() },
        async ({ session, task }) => text(await h.delegateTask(session, task)),
        ALWAYS,
      ),
      tool(
        T.answerQuestion,
        'Responde una pregunta que te hizo una sesión que te reporta.',
        { questionId: z.string(), answer: z.string() },
        async ({ questionId, answer }) => text(await h.answerQuestion(questionId, answer)),
        ALWAYS,
      ),
      tool(
        T.escalateQuestion,
        'Sube una pregunta que no puedes responder con seguridad al siguiente eslabón de la cadena.',
        { questionId: z.string() },
        async ({ questionId }) => text(await h.escalateQuestion(questionId)),
        ALWAYS,
      ),
      tool(
        T.reportDone,
        'Entrega tu resumen final y marca tu trabajo como terminado.',
        {
          summary: z.string(),
          files: z.array(z.string()).optional(),
          risks: z.string().optional(),
        },
        async ({ summary, files, risks }) =>
          text(await h.reportDone(summary, files ?? [], risks ?? '')),
        ALWAYS,
      ),
      tool(
        T.listPeers,
        'Lista las demás sesiones del flujo, su rol y su estado.',
        {},
        async () => text(await h.listPeers()),
        ALWAYS,
      ),
    ],
  });
}

function canUseTool(permissions: Permissions): CanUseTool {
  return (toolName, input) => {
    const command = typeof input.command === 'string' ? input.command : '';
    if (
      !permissions.openPullRequests &&
      toolName === 'Bash' &&
      /\bgh\s+pr\s+create\b/.test(command)
    ) {
      return Promise.resolve({
        behavior: 'deny',
        message: 'Esta sesión no tiene permiso para abrir pull requests.',
      });
    }
    return Promise.resolve({ behavior: 'allow', updatedInput: input });
  };
}

function userMessage(content: string): SDKUserMessage {
  return { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null };
}

/** Sesiones reales del agente sobre el SDK, en modo de entrada continua (multi-turno). */
export class ClaudeAgentRuntime implements AgentRuntime {
  constructor(
    private readonly cliCommand: string,
    private readonly log: (message: string) => void = () => undefined,
  ) {}

  terminalCommand({ model, instructions, resumeId }: TerminalLaunch): {
    command: string;
    args: string[];
  } {
    const args = ['--model', MODEL_IDS[model], '--append-system-prompt', instructions];
    return { command: this.cliCommand, args: resumeId ? [...args, '--resume', resumeId] : args };
  }

  start(options: AgentStartOptions, callbacks: AgentCallbacks): AgentHandle {
    const input = new InputQueue<SDKUserMessage>();
    const abort = new AbortController();
    const agents: Record<string, AgentDefinition> = Object.fromEntries(
      options.subagents.map((s) => [
        s.name,
        { description: s.description, prompt: s.prompt, model: MODEL_IDS[s.model] },
      ]),
    );
    const disallowedTools = [
      ...(options.permissions.editFiles ? [] : EDIT_TOOLS),
      ...(options.permissions.runCommands ? [] : ['Bash']),
    ];

    const q = query({
      prompt: input,
      options: {
        model: MODEL_IDS[options.model],
        cwd: options.cwd,
        systemPrompt: { type: 'preset', preset: 'claude_code', append: options.instructions },
        permissionMode: options.permissions.startInPlanMode ? 'plan' : 'default',
        canUseTool: canUseTool(options.permissions),
        disallowedTools,
        agents,
        mcpServers: { [COORDINATION_SERVER]: coordinationServer(options.coordination) },
        includePartialMessages: true,
        // En la app instalada, la CLI que trae el SDK se pasa por ruta (fuera del asar).
        ...(isAbsolute(this.cliCommand) ? { pathToClaudeCodeExecutable: this.cliCommand } : {}),
        abortController: abort,
        ...(options.resumeId ? { resume: options.resumeId } : {}),
        stderr: (data) => {
          this.log(data);
        },
      },
    });

    let contextTokens = 0;
    const handle = (m: SDKMessage): void => {
      if (m.type === 'system' && m.subtype === 'init') {
        callbacks.onSessionId(m.session_id);
      } else if (m.type === 'stream_event') {
        const e = m.event;
        if (
          m.parent_tool_use_id === null &&
          e.type === 'content_block_delta' &&
          e.delta.type === 'text_delta'
        ) {
          callbacks.onDelta(e.delta.text);
        }
      } else if (m.type === 'assistant' && m.parent_tool_use_id === null) {
        const u = m.message.usage;
        contextTokens =
          u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
        const textOut = m.message.content
          .flatMap((b) => (b.type === 'text' ? [b.text] : []))
          .join('\n')
          .trim();
        if (textOut) callbacks.onText(textOut);
        for (const b of m.message.content) {
          if (b.type === 'tool_use')
            callbacks.onToolUse(b.name, b.input as Record<string, unknown>);
        }
      } else if (m.type === 'result') {
        callbacks.onTurnEnd({
          usage: {
            inputTokens: m.usage.input_tokens,
            outputTokens: m.usage.output_tokens,
            cacheReadTokens: m.usage.cache_read_input_tokens,
            cacheWriteTokens: m.usage.cache_creation_input_tokens,
          },
          contextTokens,
          isError: m.is_error,
          error: m.subtype === 'success' ? null : m.subtype,
        });
      }
    };

    void (async () => {
      try {
        for await (const message of q) handle(message);
        callbacks.onClosed(null);
      } catch (e) {
        callbacks.onClosed(
          abort.signal.aborted ? null : e instanceof Error ? e.message : String(e),
        );
      }
    })();

    return {
      send: (content) => {
        input.push(userMessage(content));
      },
      interrupt: async () => {
        await q.interrupt();
      },
      close: () => {
        input.close();
        abort.abort();
        q.close();
      },
    };
  }
}
