import { addSession, type Flow } from '@orquestador/core';
import { makeSession } from '@orquestador/core/testing';
import type { ServerEvent } from '@orquestador/protocol';
import { describe, expect, it } from 'vitest';
import { AppError } from './errors';
import { createFlow, exportFlowYaml, getFlow, importFlowYaml, saveFlow } from './flows';
import { addProject, removeProject } from './projects';
import { RuntimeRegistry } from './runtime';
import { makeTestContext } from './testing';

const repo = { '/repos/tienda/src': { ok: true as const, root: '/repos/tienda', name: 'tienda' } };

function withSession(flow: Flow): Flow {
  const r = addSession(flow, makeSession({ id: 'e1', model: 'haiku' }));
  if (!r.ok) throw new Error('no se pudo agregar');
  return r.value;
}

describe('proyectos', () => {
  it('registra un repo por su raíz y no lo duplica', async () => {
    const ctx = makeTestContext(repo);
    const a = await addProject(ctx, '/repos/tienda/src');
    const b = await addProject(ctx, '/repos/tienda/src');
    expect(a).toEqual({
      id: 'id1',
      name: 'tienda',
      path: '/repos/tienda',
      createdAt: '2026-10-08T12:00:00.000Z',
    });
    expect(b.id).toBe(a.id);
  });

  it('rechaza carpetas que no son repositorios', async () => {
    await expect(addProject(makeTestContext(), '/tmp')).rejects.toMatchObject({
      code: 'not-a-repository',
    });
  });

  it('informa not-found al borrar un proyecto inexistente', () => {
    expect(() => {
      removeProject(makeTestContext(), 'x');
    }).toThrow(AppError);
  });
});

describe('flujos', () => {
  it('crea, guarda y publica cambios', async () => {
    const ctx = makeTestContext(repo);
    const project = await addProject(ctx, '/repos/tienda/src');
    const flow = createFlow(ctx, project.id, 'feature/pagos');
    const events: ServerEvent[] = [];
    ctx.events.subscribe((e) => events.push(e));
    const updated = withSession(flow);
    saveFlow(ctx, flow.id, updated);
    expect(getFlow(ctx, flow.id).sessions).toHaveLength(1);
    expect(events).toEqual([{ type: 'flow.updated', flow: updated }]);
  });

  it('rechaza flujos inconsistentes o con id distinto', async () => {
    const ctx = makeTestContext(repo);
    const project = await addProject(ctx, '/repos/tienda/src');
    const flow = createFlow(ctx, project.id, 'f');
    const roto = { ...flow, sessions: [makeSession({ id: 'a', reportsTo: 'nadie' })] };
    expect(() => saveFlow(ctx, flow.id, roto)).toThrow(
      expect.objectContaining({ code: 'invalid' }),
    );
    expect(() => saveFlow(ctx, 'otro', flow)).toThrow(expect.objectContaining({ code: 'invalid' }));
  });

  it('exporta e importa YAML como un flujo nuevo', async () => {
    const ctx = makeTestContext(repo);
    const project = await addProject(ctx, '/repos/tienda/src');
    const base = createFlow(ctx, project.id, 'f');
    const flow = saveFlow(ctx, base.id, withSession(base));
    const copy = importFlowYaml(ctx, project.id, exportFlowYaml(ctx, flow.id));
    expect(copy.id).not.toBe(flow.id);
    expect(copy.sessions).toEqual(flow.sessions);
  });
});

describe('RuntimeRegistry', () => {
  it('combina estado vivo, consumo y costo por modelo', async () => {
    const ctx = makeTestContext(repo);
    const project = await addProject(ctx, '/repos/tienda/src');
    const base = createFlow(ctx, project.id, 'f');
    saveFlow(ctx, base.id, withSession(base));
    const runtime = new RuntimeRegistry(ctx);
    expect(runtime.get(base.id, 'e1')).toMatchObject({ status: 'idle', costUsd: 0 });

    runtime.update(base.id, 'e1', { status: 'thinking', currentTask: 'Escribiendo tests' });
    runtime.recordUsage(
      base.id,
      'e1',
      { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      5000,
    );
    expect(runtime.get(base.id, 'e1')).toMatchObject({
      status: 'thinking',
      currentTask: 'Escribiendo tests',
      contextTokens: 5000,
      costUsd: 1,
    });
  });
});
