import { describe, expect, it } from 'vitest';
import { findExecutable } from './findExecutable';

describe('findExecutable', () => {
  it('encuentra node en el PATH, con su extensión en Windows', async () => {
    const found = await findExecutable('node');
    expect(found).toBeDefined();
    if (process.platform === 'win32') expect(found?.toLowerCase()).toMatch(/node\.(exe|cmd)$/);
  });

  it('acepta una ruta absoluta existente', async () => {
    expect(await findExecutable(process.execPath)).toBe(process.execPath);
  });

  it('devuelve undefined si no existe', async () => {
    expect(await findExecutable('comando-que-no-existe-xyz')).toBeUndefined();
  });
});
