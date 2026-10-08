import { describe, expect, it } from 'vitest';
import { makeFlow, makeSession } from './fixtures';
import { findSession } from './graph';
import { addSession, removeSession } from './sessions';

const flow = makeFlow([
  makeSession({ id: 'lider', subagents: ['revisor'] }),
  makeSession({ id: 'consultor', reportsTo: 'lider', subagents: ['revisor'] }),
  makeSession({ id: 'e1', reportsTo: 'consultor' }),
  makeSession({ id: 'revisor' }),
]);

describe('addSession', () => {
  it('agrega una sesión nueva', () => {
    const r = addSession(flow, makeSession({ id: 'e2', reportsTo: 'consultor' }));
    expect(r.ok && r.value.sessions.map((s) => s.id)).toEqual([
      'lider',
      'consultor',
      'e1',
      'revisor',
      'e2',
    ]);
  });

  it('rechaza ids repetidos', () => {
    expect(addSession(flow, makeSession({ id: 'e1' }))).toEqual({
      ok: false,
      error: { code: 'duplicate-id', id: 'e1' },
    });
  });

  it('rechaza relaciones hacia sesiones que no existen', () => {
    expect(addSession(flow, makeSession({ id: 'e2', reportsTo: 'nadie' }))).toEqual({
      ok: false,
      error: { code: 'unknown-session', id: 'nadie' },
    });
    expect(addSession(flow, makeSession({ id: 'e2', subagents: ['nadie'] }))).toEqual({
      ok: false,
      error: { code: 'unknown-session', id: 'nadie' },
    });
  });
});

describe('removeSession', () => {
  it('quita la sesión y limpia las referencias a ella', () => {
    const sinConsultor = removeSession(flow, 'consultor');
    expect(findSession(sinConsultor, 'consultor')).toBeUndefined();
    expect(findSession(sinConsultor, 'e1')?.reportsTo).toBeNull();

    const sinRevisor = removeSession(flow, 'revisor');
    expect(findSession(sinRevisor, 'lider')?.subagents).toEqual([]);
    expect(findSession(sinRevisor, 'consultor')?.subagents).toEqual([]);
  });

  it('no cambia nada si la sesión no existe', () => {
    expect(removeSession(flow, 'nadie')).toEqual(flow);
  });
});
