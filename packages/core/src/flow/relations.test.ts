import { describe, expect, it } from 'vitest';
import { makeFlow, makeSession } from './fixtures';
import { findSession } from './graph';
import { addSubagent, removeSubagent, setReportsTo } from './relations';

const flow = makeFlow([
  makeSession({ id: 'lider' }),
  makeSession({ id: 'consultor', reportsTo: 'lider' }),
  makeSession({ id: 'e1', reportsTo: 'consultor' }),
]);

describe('setReportsTo', () => {
  it('asigna el padre sin modificar el flujo original', () => {
    const r = setReportsTo(flow, 'e1', 'lider');
    expect(r.ok && findSession(r.value, 'e1')?.reportsTo).toBe('lider');
    expect(findSession(flow, 'e1')?.reportsTo).toBe('consultor');
  });

  it('con null hace que reporte al usuario', () => {
    const r = setReportsTo(flow, 'e1', null);
    expect(r.ok && findSession(r.value, 'e1')?.reportsTo).toBeNull();
  });

  it('rechaza reportarse a sí misma', () => {
    expect(setReportsTo(flow, 'e1', 'e1')).toEqual({ ok: false, error: { code: 'self-relation' } });
  });

  it('rechaza un ciclo directo o indirecto', () => {
    expect(setReportsTo(flow, 'lider', 'e1')).toEqual({ ok: false, error: { code: 'cycle' } });
    expect(setReportsTo(flow, 'consultor', 'e1')).toEqual({ ok: false, error: { code: 'cycle' } });
  });

  it('rechaza sesiones desconocidas', () => {
    expect(setReportsTo(flow, 'nadie', 'lider')).toEqual({
      ok: false,
      error: { code: 'unknown-session', id: 'nadie' },
    });
    expect(setReportsTo(flow, 'e1', 'nadie')).toEqual({
      ok: false,
      error: { code: 'unknown-session', id: 'nadie' },
    });
  });
});

describe('subagentes', () => {
  it('addSubagent agrega al final de la lista', () => {
    const r = addSubagent(flow, 'lider', 'consultor');
    expect(r.ok && findSession(r.value, 'lider')?.subagents).toEqual(['consultor']);
  });

  it('addSubagent rechaza duplicados, a sí misma y desconocidas', () => {
    const r = addSubagent(flow, 'lider', 'consultor');
    if (!r.ok) throw new Error('debería agregar');
    expect(addSubagent(r.value, 'lider', 'consultor')).toEqual({
      ok: false,
      error: { code: 'duplicate-subagent' },
    });
    expect(addSubagent(flow, 'lider', 'lider')).toEqual({
      ok: false,
      error: { code: 'self-relation' },
    });
    expect(addSubagent(flow, 'lider', 'nadie')).toEqual({
      ok: false,
      error: { code: 'unknown-session', id: 'nadie' },
    });
  });

  it('removeSubagent quita la relación y no falla si no existía', () => {
    const r = addSubagent(flow, 'lider', 'consultor');
    if (!r.ok) throw new Error('debería agregar');
    expect(findSession(removeSubagent(r.value, 'lider', 'consultor'), 'lider')?.subagents).toEqual(
      [],
    );
    expect(removeSubagent(flow, 'lider', 'e1')).toEqual(flow);
  });
});
