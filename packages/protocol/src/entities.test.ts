import { describe, expect, it } from 'vitest';
import { InboxItemSchema, SessionRuntimeSchema, SettingsSchema } from './entities';

const now = '2026-10-08T12:00:00.000Z';
const usage = { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 };

describe('entidades', () => {
  it('valida el estado en ejecución de una sesión', () => {
    const runtime = {
      sessionId: 's1',
      flowId: 'f1',
      status: 'thinking',
      currentTask: 'Escribiendo tests',
      usage,
      contextTokens: 1000,
      costUsd: 0.01,
      worktreePath: null,
      branch: null,
      terminalOpen: false,
    };
    expect(SessionRuntimeSchema.parse(runtime)).toEqual(runtime);
    expect(SessionRuntimeSchema.safeParse({ ...runtime, status: 'volando' }).success).toBe(false);
  });

  it('exige fecha ISO y pregunta no vacía en la bandeja', () => {
    const item = {
      id: 'q1',
      flowId: 'f1',
      fromSessionId: 'e2',
      route: ['e2', 'consultor', 'lider'],
      kind: 'design',
      question: '¿Reintentos automáticos?',
      context: '',
      options: ['Sí', 'No'],
      createdAt: now,
    };
    expect(InboxItemSchema.safeParse(item).success).toBe(true);
    expect(InboxItemSchema.safeParse({ ...item, createdAt: 'ayer' }).success).toBe(false);
    expect(InboxItemSchema.safeParse({ ...item, question: '' }).success).toBe(false);
  });

  it('exige ventana de contexto para los tres modelos', () => {
    const price = {
      inputPerMTok: 1,
      outputPerMTok: 5,
      cacheReadPerMTok: 0.1,
      cacheWritePerMTok: 1.25,
    };
    const settings = {
      pricing: { opus: price, sonnet: price, haiku: price },
      contextWindow: { opus: 200000, sonnet: 200000, haiku: 200000 },
    };
    expect(SettingsSchema.safeParse(settings).success).toBe(true);
    expect(SettingsSchema.safeParse({ ...settings, contextWindow: { opus: 200000 } }).success).toBe(
      false,
    );
  });
});
