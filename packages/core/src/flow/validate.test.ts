import { describe, expect, it } from 'vitest';
import { makeFlow, makeSession } from './fixtures';
import { validateFlow } from './validate';

describe('validateFlow', () => {
  it('no reporta problemas en un flujo correcto', () => {
    const flow = makeFlow([
      makeSession({ id: 'lider', subagents: ['revisor'] }),
      makeSession({ id: 'e1', reportsTo: 'lider' }),
      makeSession({ id: 'revisor' }),
    ]);
    expect(validateFlow(flow)).toEqual([]);
  });

  it('detecta ids repetidos', () => {
    const flow = makeFlow([makeSession({ id: 'a' }), makeSession({ id: 'a' })]);
    expect(validateFlow(flow)).toContainEqual({ code: 'duplicate-id', sessionId: 'a' });
  });

  it('detecta referencias a sesiones inexistentes', () => {
    const flow = makeFlow([makeSession({ id: 'a', reportsTo: 'x', subagents: ['y'] })]);
    expect(validateFlow(flow)).toEqual([
      { code: 'unknown-parent', sessionId: 'a', targetId: 'x' },
      { code: 'unknown-subagent', sessionId: 'a', targetId: 'y' },
    ]);
  });

  it('detecta relaciones consigo misma y subagentes repetidos', () => {
    const flow = makeFlow([makeSession({ id: 'a', reportsTo: 'a', subagents: ['a'] })]);
    expect(validateFlow(flow)).toEqual([
      { code: 'self-relation', sessionId: 'a' },
      { code: 'self-relation', sessionId: 'a' },
    ]);
    const dup = makeFlow([
      makeSession({ id: 'a', subagents: ['b', 'b'] }),
      makeSession({ id: 'b' }),
    ]);
    expect(validateFlow(dup)).toEqual([
      { code: 'duplicate-subagent', sessionId: 'a', targetId: 'b' },
    ]);
  });

  it('detecta ciclos de reporte una sola vez', () => {
    const flow = makeFlow([
      makeSession({ id: 'a', reportsTo: 'c' }),
      makeSession({ id: 'b', reportsTo: 'a' }),
      makeSession({ id: 'c', reportsTo: 'b' }),
      makeSession({ id: 'd', reportsTo: 'a' }),
    ]);
    expect(validateFlow(flow)).toEqual([{ code: 'cycle', sessionIds: ['a', 'c', 'b'] }]);
  });
});
