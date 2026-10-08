import { makeFlow, makeSession } from '@orquestador/core/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteStore } from './sqliteStore';

const at = '2026-10-08T12:00:00.000Z';
const project = { id: 'p1', name: 'tienda', path: '/repos/tienda', createdAt: at };
const flow = { ...makeFlow([makeSession({ id: 'e1' })]), id: 'f1', name: 'feature/pagos' };

let dir: string;
let store: SqliteStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orq-store-'));
  store = new SqliteStore(join(dir, 'test.db'));
  store.insertProject(project);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('SqliteStore', () => {
  it('guarda y lista proyectos', () => {
    expect(store.listProjects()).toEqual([project]);
    expect(store.findProjectByPath('/repos/tienda')?.id).toBe('p1');
  });

  it('guarda, actualiza y resume flujos', () => {
    store.saveFlow({ projectId: 'p1', flow, updatedAt: at });
    store.saveFlow({ projectId: 'p1', flow: { ...flow, name: 'feature/cobros' }, updatedAt: at });
    expect(store.getFlow('f1')?.flow.name).toBe('feature/cobros');
    expect(store.listFlows('p1')).toEqual([
      { id: 'f1', projectId: 'p1', name: 'feature/cobros', sessionCount: 1, updatedAt: at },
    ]);
  });

  it('borra en cascada los flujos de un proyecto', () => {
    store.saveFlow({ projectId: 'p1', flow, updatedAt: at });
    store.deleteProject('p1');
    expect(store.getFlow('f1')).toBeUndefined();
  });

  it('guarda mensajes en orden por sesión', () => {
    store.saveFlow({ projectId: 'p1', flow, updatedAt: at });
    const m = (id: string, text: string) => ({
      id,
      sessionId: 'e1',
      author: 'user' as const,
      fromSessionId: null,
      text,
      createdAt: at,
    });
    store.insertMessage('f1', m('m1', 'hola'));
    store.insertMessage('f1', m('m2', 'qué tal'));
    expect(store.listMessages('f1', 'e1').map((x) => x.text)).toEqual(['hola', 'qué tal']);
  });

  it('acumula el consumo y guarda el último contexto', () => {
    store.saveFlow({ projectId: 'p1', flow, updatedAt: at });
    const usage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 1, cacheWriteTokens: 0 };
    store.addUsage('f1', { sessionId: 'e1', usage, contextTokens: 100 }, at);
    store.addUsage('f1', { sessionId: 'e1', usage, contextTokens: 250 }, at);
    expect(store.usageByFlow('f1')).toEqual([
      {
        sessionId: 'e1',
        usage: { inputTokens: 20, outputTokens: 10, cacheReadTokens: 2, cacheWriteTokens: 0 },
        contextTokens: 250,
      },
    ]);
  });

  it('recuerda la conversación del agente de cada sesión', () => {
    store.saveFlow({ projectId: 'p1', flow, updatedAt: at });
    expect(store.getAgentSessionId('f1', 'e1')).toBeUndefined();
    store.setAgentSessionId('f1', 'e1', 'a1');
    store.setAgentSessionId('f1', 'e1', 'a2');
    expect(store.getAgentSessionId('f1', 'e1')).toBe('a2');
  });

  it('reabre una base existente sin volver a migrar', () => {
    store.saveFlow({ projectId: 'p1', flow, updatedAt: at });
    store.close();
    store = new SqliteStore(join(dir, 'test.db'));
    expect(store.getFlow('f1')?.flow.id).toBe('f1');
  });
});
