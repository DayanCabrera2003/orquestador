import { FlowSchema } from '@orquestador/core';
import { z } from 'zod';
import { ChatMessageSchema, InboxItemSchema, SessionRuntimeSchema } from './entities';

/** Ruta del WebSocket. El token va en el query string `?token=`. */
export const WS_PATH = '/ws';

const Id = z.string().min(1);
const SessionRef = { flowId: Id, sessionId: Id };
const TerminalSize = { cols: z.number().int().positive(), rows: z.number().int().positive() };

/** Comandos de la UI al motor. */
export const ClientCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('flow.subscribe'), flowId: Id }),
  z.object({ type: z.literal('flow.start'), flowId: Id }),
  z.object({ type: z.literal('flow.pause'), flowId: Id }),
  z.object({ type: z.literal('session.start'), ...SessionRef }),
  z.object({ type: z.literal('session.pause'), ...SessionRef }),
  z.object({ type: z.literal('session.resume'), ...SessionRef }),
  z.object({ type: z.literal('session.send'), ...SessionRef, text: z.string().min(1) }),
  z.object({ type: z.literal('inbox.answer'), itemId: Id, answer: z.string().min(1) }),
  z.object({ type: z.literal('terminal.open'), ...SessionRef, ...TerminalSize }),
  z.object({ type: z.literal('terminal.input'), ...SessionRef, data: z.string() }),
  z.object({ type: z.literal('terminal.resize'), ...SessionRef, ...TerminalSize }),
  z.object({ type: z.literal('terminal.close'), ...SessionRef }),
]);
export type ClientCommand = z.infer<typeof ClientCommandSchema>;

export const RelationMessageKindSchema = z.enum([
  'question',
  'answer',
  'escalation',
  'report',
  'delegation',
]);

/** Eventos del motor a la UI. */
export const ServerEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('flow.updated'), flow: FlowSchema }),
  z.object({ type: z.literal('session.runtime'), runtime: SessionRuntimeSchema }),
  z.object({ type: z.literal('session.message'), message: ChatMessageSchema }),
  /** Fragmento de texto mientras el agente escribe. El mensaje completo llega después en `session.message`. */
  z.object({ type: z.literal('session.delta'), ...SessionRef, messageId: Id, text: z.string() }),
  /** Algo pasó entre dos sesiones; la UI lo anima sobre la arista. `toSessionId` null = el usuario. */
  z.object({
    type: z.literal('relation.message'),
    flowId: Id,
    fromSessionId: Id,
    toSessionId: Id.nullable(),
    kind: RelationMessageKindSchema,
    summary: z.string(),
  }),
  z.object({ type: z.literal('inbox.added'), item: InboxItemSchema }),
  z.object({ type: z.literal('inbox.resolved'), itemId: Id }),
  z.object({ type: z.literal('terminal.data'), ...SessionRef, data: z.string() }),
  z.object({
    type: z.literal('terminal.exit'),
    ...SessionRef,
    exitCode: z.number().int().nullable(),
  }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;
export type ServerEventType = ServerEvent['type'];
