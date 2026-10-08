import { describe, expect, it } from 'vitest';
import { makeFlow, makeSession } from '../flow/fixtures';
import { parseFlowYaml, serializeFlowYaml } from './flow-yaml';

const flow = makeFlow([
  makeSession({
    id: 'lider',
    role: 'lider',
    model: 'opus',
    instructions: 'Línea 1\nLínea 2',
    subagents: ['rev'],
  }),
  makeSession({ id: 'e1', reportsTo: 'lider' }),
  makeSession({ id: 'rev', role: 'revisor', model: 'sonnet' }),
]);

describe('YAML de flujos', () => {
  it('ida y vuelta conserva el flujo', () => {
    expect(parseFlowYaml(serializeFlowYaml(flow))).toEqual({ ok: true, value: flow });
  });

  it('empieza con schemaVersion para que sea fácil de identificar', () => {
    expect(serializeFlowYaml(flow).startsWith('schemaVersion: 1\n')).toBe(true);
  });

  it('informa YAML mal formado', () => {
    const r = parseFlowYaml('sessions: [');
    expect(!r.ok && r.error.code).toBe('syntax');
  });

  it('propaga errores de versión y de esquema', () => {
    expect(parseFlowYaml('id: x')).toEqual({ ok: false, error: { code: 'missing-version' } });
  });

  it('rechaza flujos con relaciones inconsistentes', () => {
    const roto = makeFlow([makeSession({ id: 'a', reportsTo: 'nadie' })]);
    expect(parseFlowYaml(serializeFlowYaml(roto))).toEqual({
      ok: false,
      error: {
        code: 'inconsistent',
        issues: [{ code: 'unknown-parent', sessionId: 'a', targetId: 'nadie' }],
      },
    });
  });
});
