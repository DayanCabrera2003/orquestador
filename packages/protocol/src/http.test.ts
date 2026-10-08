import { describe, expect, it } from 'vitest';
import { buildPath, ROUTES } from './http';

describe('rutas HTTP', () => {
  it('cada ruta declara exactamente los parámetros de su path', () => {
    for (const [name, def] of Object.entries(ROUTES)) {
      const inPath = [...def.path.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1]);
      expect(inPath, name).toEqual([...def.params]);
    }
  });

  it('no repite método y path', () => {
    const keys = Object.values(ROUTES).map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('buildPath sustituye y codifica los parámetros', () => {
    expect(buildPath('listMessages', { flowId: 'f 1', sessionId: 's/2' })).toBe(
      '/api/flows/f%201/sessions/s%2F2/messages',
    );
  });
});
