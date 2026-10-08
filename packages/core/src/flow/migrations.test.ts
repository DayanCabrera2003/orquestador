import { describe, expect, it } from 'vitest';
import { makeFlow, makeSession } from './fixtures';
import { migrateFlow } from './migrations';

const flow = makeFlow([makeSession({ id: 'a' })]);

describe('migrateFlow', () => {
  it('acepta un flujo de la versión actual', () => {
    expect(migrateFlow(JSON.parse(JSON.stringify(flow)))).toEqual({ ok: true, value: flow });
  });

  it('rechaza datos sin versión', () => {
    expect(migrateFlow({ id: 'x' })).toEqual({ ok: false, error: { code: 'missing-version' } });
    expect(migrateFlow(null)).toEqual({ ok: false, error: { code: 'missing-version' } });
  });

  it('rechaza un archivo de una versión más nueva que la app', () => {
    expect(migrateFlow({ ...flow, schemaVersion: 99 })).toEqual({
      ok: false,
      error: { code: 'newer-version', version: 99 },
    });
  });

  it('rechaza una versión que no existe', () => {
    expect(migrateFlow({ ...flow, schemaVersion: 0 })).toEqual({
      ok: false,
      error: { code: 'unknown-version', version: 0 },
    });
  });

  it('informa qué campos son inválidos', () => {
    const r = migrateFlow({ ...flow, sessions: [{ ...flow.sessions[0], model: 'gpt' }] });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.code === 'invalid')
      expect(r.error.issues[0]).toContain('sessions.0.model');
    else throw new Error('esperaba invalid');
  });
});
