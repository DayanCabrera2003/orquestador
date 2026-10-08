import { addSession, type Flow } from '@orquestador/core';
import { makeSession } from '@orquestador/core/testing';
import { AUTH_HEADER, type ServerEvent } from '@orquestador/protocol';
import { execa } from 'execa';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { startServer, type RunningServer } from './server';

const TOKEN = 'secreto';
const ORIGIN = 'http://localhost:5173';
let server: RunningServer;
let repo: string;
let base: string;

async function api(
  path: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
  token = TOKEN,
): Promise<Response> {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', [AUTH_HEADER]: token, ...init.headers },
  });
}

beforeAll(async () => {
  repo = realpathSync.native(mkdtempSync(join(tmpdir(), 'orq-srv-')));
  await execa('git', ['init', '-q', repo]);
  server = await startServer({
    databasePath: ':memory:',
    token: TOKEN,
    allowedOrigins: [ORIGIN],
    port: 0,
    agentCommand: 'comando-que-no-existe',
    worktreesDir: join(tmpdir(), 'orq-wt-test'),
    logger: false,
  });
  base = `http://127.0.0.1:${String(server.port)}`;
});

afterAll(async () => {
  await server.close();
  rmSync(repo, { recursive: true, force: true });
});

describe('seguridad', () => {
  it('exige el token', async () => {
    expect((await api('/api/projects', {}, 'otro')).status).toBe(401);
  });

  it('rechaza orígenes no autorizados', async () => {
    expect(
      (await api('/api/projects', { headers: { origin: 'https://evil.example' } })).status,
    ).toBe(403);
  });

  it('responde al preflight de un origen autorizado', async () => {
    const r = await fetch(`${base}/api/projects`, {
      method: 'OPTIONS',
      headers: { origin: ORIGIN },
    });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  });
});

describe('API', () => {
  it('informa el entorno con códigos de problema', async () => {
    const env = (await (await api('/api/environment')).json()) as { agentCli: { problem: string } };
    expect(env.agentCli.problem).toBe('not-found');
  });

  it('crea proyecto y flujo, guarda cambios y los emite por WebSocket', async () => {
    const project = (await (
      await api('/api/projects', { method: 'POST', body: JSON.stringify({ path: repo }) })
    ).json()) as {
      id: string;
    };
    const flow = (await (
      await api(`/api/projects/${project.id}/flows`, {
        method: 'POST',
        body: JSON.stringify({ name: 'feature/x' }),
      })
    ).json()) as Flow;

    const ws = new WebSocket(`ws://127.0.0.1:${String(server.port)}/ws?token=${TOKEN}`);
    await new Promise((resolve) => ws.once('open', resolve));
    const received = new Promise<ServerEvent>((resolve) => {
      ws.once('message', (raw: Buffer) => {
        resolve(JSON.parse(raw.toString()) as ServerEvent);
      });
    });

    const r = addSession(flow, makeSession({ id: 'e1' }));
    if (!r.ok) throw new Error('no se pudo agregar');
    const put = await api(`/api/flows/${flow.id}`, {
      method: 'PUT',
      body: JSON.stringify(r.value),
    });
    expect(put.status).toBe(200);
    expect(await received).toEqual({ type: 'flow.updated', flow: r.value });

    const runtime = (await (await api(`/api/flows/${flow.id}/runtime`)).json()) as {
      status: string;
    }[];
    expect(runtime).toHaveLength(1);
    expect(runtime[0]?.status).toBe('idle');

    const text = (await (await api(`/api/flows/${flow.id}/sessions/e1/instructions`)).json()) as {
      text: string;
    };
    expect(text.text).toContain('# Coordinación');
    ws.close();
  });

  it('devuelve errores con código', async () => {
    const r = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ path: join(repo, 'nada') }),
    });
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({ code: 'not-a-repository' });
    const bad = await api('/api/projects', { method: 'POST', body: JSON.stringify({}) });
    expect(bad.status).toBe(400);
  });

  it('rechaza un WebSocket sin token', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);
    const status = await new Promise<number>((resolve) => {
      ws.once('unexpected-response', (req, res) => {
        req.destroy();
        resolve(res.statusCode ?? 0);
      });
    });
    expect(status).toBe(401);
  });
});
