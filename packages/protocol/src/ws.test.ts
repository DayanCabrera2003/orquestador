import { describe, expect, it } from 'vitest';
import { ClientCommandSchema, ServerEventSchema } from './ws';

describe('mensajes por WebSocket', () => {
  it('acepta comandos válidos y rechaza los incompletos', () => {
    expect(
      ClientCommandSchema.safeParse({
        type: 'session.send',
        flowId: 'f',
        sessionId: 's',
        text: 'hola',
      }).success,
    ).toBe(true);
    expect(
      ClientCommandSchema.safeParse({ type: 'session.send', flowId: 'f', sessionId: 's', text: '' })
        .success,
    ).toBe(false);
    expect(ClientCommandSchema.safeParse({ type: 'borrar.todo' }).success).toBe(false);
  });

  it('acepta un evento de mensaje entre sesiones hacia el usuario', () => {
    expect(
      ServerEventSchema.safeParse({
        type: 'relation.message',
        flowId: 'f',
        fromSessionId: 'lider',
        toSessionId: null,
        kind: 'escalation',
        summary: '¿Reintentos automáticos?',
      }).success,
    ).toBe(true);
  });
});
