import { describe, expect, it } from 'vitest';
import { makeFlow, makeSession } from './fixtures';
import { childrenOf, escalationChain, findSession, subagentOwnersOf } from './graph';

const flow = makeFlow([
  makeSession({ id: 'lider', role: 'lider', model: 'opus', subagents: ['revisor'] }),
  makeSession({ id: 'consultor', role: 'consultor', model: 'sonnet', reportsTo: 'lider' }),
  makeSession({ id: 'e1', reportsTo: 'consultor' }),
  makeSession({ id: 'e2', reportsTo: 'consultor' }),
  makeSession({ id: 'revisor', role: 'revisor', model: 'sonnet' }),
]);

describe('consultas del grafo', () => {
  it('findSession devuelve la sesión o undefined', () => {
    expect(findSession(flow, 'e1')?.id).toBe('e1');
    expect(findSession(flow, 'nadie')).toBeUndefined();
  });

  it('childrenOf devuelve quienes le reportan', () => {
    expect(childrenOf(flow, 'consultor').map((s) => s.id)).toEqual(['e1', 'e2']);
    expect(childrenOf(flow, 'e1')).toEqual([]);
  });

  it('subagentOwnersOf devuelve quienes pueden invocarla', () => {
    expect(subagentOwnersOf(flow, 'revisor').map((s) => s.id)).toEqual(['lider']);
    expect(subagentOwnersOf(flow, 'e1')).toEqual([]);
  });
});

describe('escalationChain', () => {
  it('sube desde la sesión hasta la raíz', () => {
    expect(escalationChain(flow, 'e1').map((s) => s.id)).toEqual(['consultor', 'lider']);
  });

  it('es vacía para una raíz', () => {
    expect(escalationChain(flow, 'lider')).toEqual([]);
  });

  it('es vacía para una sesión desconocida', () => {
    expect(escalationChain(flow, 'nadie')).toEqual([]);
  });

  it('se detiene si encuentra un ciclo en datos corruptos', () => {
    const corrupto = makeFlow([
      makeSession({ id: 'a', reportsTo: 'b' }),
      makeSession({ id: 'b', reportsTo: 'a' }),
    ]);
    expect(escalationChain(corrupto, 'a').map((s) => s.id)).toEqual(['b']);
  });

  it('ignora un padre inexistente', () => {
    const roto = makeFlow([makeSession({ id: 'a', reportsTo: 'fantasma' })]);
    expect(escalationChain(roto, 'a')).toEqual([]);
  });
});
