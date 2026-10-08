import type { ModelTier, Permissions, TokenUsage } from '@orquestador/core';

export type InboxKind = 'design' | 'permission' | 'question';

/**
 * Lo que hacen las herramientas de coordinación de una sesión. Cada función devuelve el texto que
 * recibe el agente como resultado de la herramienta.
 */
export interface CoordinationHandlers {
  askParent: (question: string) => Promise<string>;
  askUser: (
    question: string,
    kind: InboxKind,
    options: string[],
    context: string,
  ) => Promise<string>;
  delegateTask: (target: string, task: string) => Promise<string>;
  answerQuestion: (questionId: string, answer: string) => Promise<string>;
  escalateQuestion: (questionId: string) => Promise<string>;
  reportDone: (summary: string, files: string[], risks: string) => Promise<string>;
  listPeers: () => Promise<string>;
}

export interface SubagentSpec {
  name: string;
  description: string;
  prompt: string;
  model: ModelTier;
}

export interface AgentStartOptions {
  model: ModelTier;
  cwd: string;
  /** Instrucciones compuestas: rol, instrucciones propias y reglas de coordinación. */
  instructions: string;
  permissions: Permissions;
  subagents: SubagentSpec[];
  /** Conversación previa a retomar. */
  resumeId: string | undefined;
  coordination: CoordinationHandlers;
}

export interface TurnResult {
  usage: TokenUsage;
  contextTokens: number;
  isError: boolean;
  error: string | null;
}

export interface AgentCallbacks {
  onSessionId: (agentSessionId: string) => void;
  onDelta: (text: string) => void;
  onText: (text: string) => void;
  onToolUse: (toolName: string, input: Record<string, unknown>) => void;
  onTurnEnd: (result: TurnResult) => void;
  onClosed: (error: string | null) => void;
}

export interface AgentHandle {
  /** Envía un mensaje. Si el agente está trabajando, se encola para el siguiente turno. */
  send: (text: string) => void;
  interrupt: () => Promise<void>;
  close: () => void;
}

export interface TerminalLaunch {
  model: ModelTier;
  instructions: string;
  resumeId: string | undefined;
}

/** Ejecuta sesiones del agente. */
export interface AgentRuntime {
  start: (options: AgentStartOptions, callbacks: AgentCallbacks) => AgentHandle;
  /** Comando de la CLI interactiva para abrir la misma conversación en una terminal. */
  terminalCommand: (launch: TerminalLaunch) => { command: string; args: string[] };
}
