import { makeSession } from '@orquestador/core/testing';
import type { ServerEvent } from '@orquestador/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentCallbacks, AgentRuntime, AgentStartOptions } from '../ports/AgentRuntime';
import { createFlow, saveFlow } from './flows';
import { addProject } from './projects';
import { RuntimeRegistry } from './runtime';
import { SessionManager } from './sessions';
import { makeTestContext } from './testing';

interface FakeSession {
  options: AgentStartOptions;
  callbacks: AgentCallbacks;
  inbox: string[];
}

class FakeRuntime implements AgentRuntime {
  readonly sessions = new Map<string, FakeSession>();
  start(options: AgentStartOptions, callbacks: AgentCallbacks) {
    const s: FakeSession = { options, callbacks, inbox: [] };
    // La sesión se identifica por el modelo y el directorio de trabajo no basta: usamos el orden de inicio.
    this.sessions.set(String(this.sessions.size), s);
    return {
      send: (text: string) => s.inbox.push(text),
      interrupt: () => Promise.resolve(),
      close: () => undefined,
    };
  }
  terminalCommand() {
    return { command: 'agente', args: [] };
  }
}

const readOnly = {
  editFiles: false,
  runCommands: true,
  openPullRequests: false,
  startInPlanMode: false,
};
let manager: SessionManager;
let fake: FakeRuntime;
let flowId: string;
let events: ServerEvent[];
let byName: (name: string) => FakeSession;

beforeEach(async () => {
  const ctx = makeTestContext({ '/repo': { ok: true, root: '/repo', name: 'repo' } });
  const project = await addProject(ctx, '/repo');
  const base = createFlow(ctx, project.id, 'feature/pagos');
  flowId = base.id;
  saveFlow(ctx, flowId, {
    ...base,
    sessions: [
      makeSession({
        id: 'lider',
        name: 'Líder',
        role: 'lider',
        permissions: readOnly,
        subagents: ['rev'],
      }),
      makeSession({
        id: 'cons',
        name: 'Consultor',
        role: 'consultor',
        permissions: readOnly,
        reportsTo: 'lider',
      }),
      makeSession({ id: 'e1', name: 'Ejecutor 1', reportsTo: 'cons' }),
      makeSession({ id: 'rev', name: 'Revisor', role: 'revisor', permissions: readOnly }),
    ],
  });
  fake = new FakeRuntime();
  manager = new SessionManager(ctx, new RuntimeRegistry(ctx), fake, '/data/worktrees');
  events = [];
  ctx.events.subscribe((e) => events.push(e));
  byName = (name) => {
    const found = [...fake.sessions.values()].find((s) =>
      s.options.instructions.includes(`Eres «${name}»`),
    );
    if (!found) throw new Error(`sesión ${name} no iniciada`);
    return found;
  };
});

describe('SessionManager', () => {
  it('inicia la sesión con sus instrucciones, subagentes y worktree solo si edita', async () => {
    await manager.deliver(flowId, 'lider', { kind: 'user' }, 'Implementa pagos');
    const lider = byName('Líder');
    expect(lider.options.cwd).toBe('/repo');
    expect(lider.options.subagents.map((s) => s.name)).toEqual(['revisor']);
    expect(lider.inbox).toEqual(['Implementa pagos']);

    await manager.deliver(flowId, 'e1', { kind: 'system' }, 'hola');
    expect(byName('Ejecutor 1').options.cwd).toMatch(/worktrees/);
  });

  it('delega solo en quienes le reportan', async () => {
    await manager.start(flowId, 'cons');
    const cons = byName('Consultor');
    expect(
      await cons.options.coordination.delegateTask('Ejecutor 1', 'Crea el endpoint'),
    ).toContain('Tarea enviada');
    expect(byName('Ejecutor 1').inbox[0]).toBe('[Mensaje de «Consultor»]\nCrea el endpoint');
    expect(await cons.options.coordination.delegateTask('Líder', 'x')).toContain(
      'No puedes delegar',
    );
  });

  it('una pregunta sube, se escala y la respuesta baja a quien preguntó', async () => {
    await manager.start(flowId, 'e1');
    const e1 = byName('Ejecutor 1');
    await e1.options.coordination.askParent('¿Qué secreto uso?');
    const cons = byName('Consultor');
    expect(cons.inbox[0]).toContain('Pregunta de «Ejecutor 1» · id q1');

    await cons.options.coordination.escalateQuestion('q1');
    const lider = byName('Líder');
    expect(lider.inbox[0]).toContain('Pregunta de «Ejecutor 1» (vía «Consultor»)');
    expect(await cons.options.coordination.answerQuestion('q1', 'x')).toContain('No tienes');

    await lider.options.coordination.answerQuestion('q1', 'Usa STRIPE_WEBHOOK_SECRET');
    expect(e1.inbox.at(-1)).toContain('Respuesta de «Líder» a tu pregunta «¿Qué secreto uso?»');
    expect(events.flatMap((e) => (e.type === 'relation.message' ? [e.kind] : []))).toEqual([
      'question',
      'escalation',
      'answer',
      'answer',
    ]);
  });

  it('una pregunta que la raíz no sabe responder llega a la bandeja y la respuesta vuelve al origen', async () => {
    await manager.start(flowId, 'e1');
    await byName('Ejecutor 1').options.coordination.askParent('¿Reintentos automáticos?');
    await byName('Consultor').options.coordination.escalateQuestion('q1');
    await byName('Líder').options.coordination.escalateQuestion('q1');
    const added = events.find((e) => e.type === 'inbox.added');
    expect(added?.type === 'inbox.added' && added.item.route).toEqual(['e1', 'cons', 'lider']);

    if (added?.type !== 'inbox.added') throw new Error('sin pregunta');
    await manager.answerInbox(added.item.id, 'Sí, tres intentos');
    expect(byName('Ejecutor 1').inbox.at(-1)).toContain(
      'Respuesta del usuario a «¿Reintentos automáticos?»:\nSí, tres intentos',
    );
    expect(events.some((e) => e.type === 'inbox.resolved')).toBe(true);
  });

  it('el resumen final llega al padre y la sesión termina al cerrar el turno', async () => {
    await manager.start(flowId, 'e1');
    const e1 = byName('Ejecutor 1');
    await e1.options.coordination.reportDone('Endpoint listo', ['src/pay.ts'], 'Sin idempotencia');
    expect(byName('Consultor').inbox[0]).toContain(
      'Resumen de «Ejecutor 1»:\nEndpoint listo\nArchivos: src/pay.ts\nRiesgos: Sin idempotencia',
    );
    e1.callbacks.onTurnEnd({
      usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 },
      contextTokens: 100,
      isError: false,
      error: null,
    });
    const last = events.filter((e) => e.type === 'session.runtime').at(-1);
    expect(last?.type === 'session.runtime' && last.runtime).toMatchObject({
      sessionId: 'e1',
      status: 'done',
      contextTokens: 100,
    });
  });
});
