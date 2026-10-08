import { ModelTierSchema, PricingTableSchema, SessionStatusSchema } from '@orquestador/core';
import { z } from 'zod';

const Id = z.string().min(1);
/** Fecha en ISO 8601. */
const Timestamp = z.iso.datetime();

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
});

export const ProjectSchema = z.object({
  id: Id,
  name: z.string().min(1),
  path: z.string().min(1),
  createdAt: Timestamp,
});
export type Project = z.infer<typeof ProjectSchema>;

export const FlowSummarySchema = z.object({
  id: Id,
  projectId: Id,
  name: z.string().min(1),
  sessionCount: z.number().int().nonnegative(),
  updatedAt: Timestamp,
});
export type FlowSummary = z.infer<typeof FlowSummarySchema>;

/** Estado en ejecución de una sesión, separado de su definición en el flujo. */
export const SessionRuntimeSchema = z.object({
  sessionId: Id,
  flowId: Id,
  status: SessionStatusSchema,
  currentTask: z.string(),
  usage: TokenUsageSchema,
  contextTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  worktreePath: z.string().nullable(),
  branch: z.string().nullable(),
  /** Mientras la terminal está abierta, el chat queda en pausa. */
  terminalOpen: z.boolean(),
});
export type SessionRuntime = z.infer<typeof SessionRuntimeSchema>;

export const MessageAuthorSchema = z.enum(['user', 'agent', 'session', 'system']);

export const ChatMessageSchema = z.object({
  id: Id,
  sessionId: Id,
  author: MessageAuthorSchema,
  /** Si el autor es otra sesión, cuál. */
  fromSessionId: Id.nullable(),
  text: z.string(),
  createdAt: Timestamp,
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const InboxKindSchema = z.enum(['design', 'permission', 'question']);

export const InboxItemSchema = z.object({
  id: Id,
  flowId: Id,
  /** Sesión que originó la pregunta. */
  fromSessionId: Id,
  /** Sesiones por las que pasó, desde la que preguntó hasta la última que escaló. */
  route: z.array(Id),
  kind: InboxKindSchema,
  question: z.string().min(1),
  context: z.string(),
  options: z.array(z.string()),
  createdAt: Timestamp,
});
export type InboxItem = z.infer<typeof InboxItemSchema>;

export const ToolStatusSchema = z.object({
  found: z.boolean(),
  version: z.string().nullable(),
  /** Por qué no está lista. La UI traduce el código a un texto con instrucciones. */
  problem: z.enum(['not-found', 'not-authenticated', 'failed']).nullable(),
});

export const EnvironmentSchema = z.object({
  platform: z.enum(['linux', 'darwin', 'win32']),
  git: ToolStatusSchema,
  agentCli: ToolStatusSchema,
});
export type Environment = z.infer<typeof EnvironmentSchema>;

export const SettingsSchema = z.object({
  pricing: PricingTableSchema,
  contextWindow: z.record(ModelTierSchema, z.number().int().positive()),
});
export type Settings = z.infer<typeof SettingsSchema>;
