import { makeSession } from '@orquestador/core/testing';
import type { ServerEvent } from '@orquestador/protocol';
import { describe, expect, it } from 'vitest';
import type { AgentRuntime } from '../ports/AgentRuntime';
import type { TerminalCallbacks, TerminalOptions, TerminalPort } from '../ports/Terminal';
import { createFlow, saveFlow } from './flows';
import { addProject } from './projects';
import { RuntimeRegistry } from './runtime';
import { SessionManager } from './sessions';
import { TerminalManager } from './terminals';
import { makeTestContext } from './testing';

describe('TerminalManager', () => {
  it('abre la cli en el worktree, transmite datos y bloquea el chat mientras está abierta', async () => {
    const ctx = makeTestContext({ '/repo': { ok: true, root: '/repo', name: 'repo' } });
    const project = await addProject(ctx, '/repo');
    const base = createFlow(ctx, project.id, 'f');
    saveFlow(ctx, base.id, { ...base, sessions: [makeSession({ id: 'e1', name: 'Ejecutor' })] });
    const agents: AgentRuntime = {
      start: () => ({
        send: () => undefined,
        interrupt: () => Promise.resolve(),
        close: () => undefined,
      }),
      terminalCommand: (l) => ({ command: 'agente', args: ['--model', l.model] }),
    };
    let opened: TerminalOptions | undefined;
    let callbacks: TerminalCallbacks | undefined;
    const written: string[] = [];
    const terminal: TerminalPort = {
      open: (o, c) => {
        opened = o;
        callbacks = c;
        return {
          write: (d) => written.push(d),
          resize: () => undefined,
          kill: () => {
            c.onExit(0);
          },
        };
      },
    };
    const runtime = new RuntimeRegistry(ctx);
    const sessions = new SessionManager(ctx, runtime, agents, '/data/wt');
    const terminals = new TerminalManager(ctx, sessions, agents, terminal);
    const events: ServerEvent[] = [];
    ctx.events.subscribe((e) => events.push(e));

    let launches = 0;
    const originalOpen = terminal.open;
    terminal.open = (o, c) => {
      launches++;
      return originalOpen(o, c);
    };
    await Promise.all([
      terminals.openTerminal(base.id, 'e1', 100, 30),
      terminals.openTerminal(base.id, 'e1', 100, 30),
    ]);
    expect(launches).toBe(1);
    expect(opened).toMatchObject({
      command: 'agente',
      args: ['--model', 'haiku'],
      cols: 100,
      rows: 30,
    });
    expect(opened?.cwd).toMatch(/wt/);
    expect(runtime.get(base.id, 'e1')?.terminalOpen).toBe(true);
    await expect(sessions.deliver(base.id, 'e1', { kind: 'user' }, 'hola')).rejects.toMatchObject({
      code: 'conflict',
    });

    terminals.input(base.id, 'e1', 'ls\r');
    expect(written).toEqual(['ls\r']);
    callbacks?.onData('salida');
    expect(events).toContainEqual({
      type: 'terminal.data',
      flowId: base.id,
      sessionId: 'e1',
      data: 'salida',
    });

    terminals.close(base.id, 'e1');
    expect(runtime.get(base.id, 'e1')?.terminalOpen).toBe(false);
    expect(events).toContainEqual({
      type: 'terminal.exit',
      flowId: base.id,
      sessionId: 'e1',
      exitCode: 0,
    });
  });
});
