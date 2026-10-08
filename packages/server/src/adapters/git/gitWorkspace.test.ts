import { execa } from 'execa';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitWorkspace } from './gitWorkspace';

let dir: string;
const ws = new GitWorkspace();

beforeAll(async () => {
  dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'orq-git-')));
  mkdirSync(join(dir, 'repo', 'sub'), { recursive: true });
  mkdirSync(join(dir, 'plain'));
  writeFileSync(join(dir, 'file.txt'), 'x');
  await execa('git', ['init', '-q', join(dir, 'repo')]);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('GitWorkspace.inspectRepository', () => {
  it('encuentra la raíz del repo desde una subcarpeta', async () => {
    expect(await ws.inspectRepository(join(dir, 'repo', 'sub'))).toEqual({
      ok: true,
      root: join(dir, 'repo'),
      name: 'repo',
    });
  });

  it('distingue carpeta sin repo, archivo y ruta inexistente', async () => {
    expect(await ws.inspectRepository(join(dir, 'plain'))).toEqual({
      ok: false,
      reason: 'not-a-repository',
    });
    expect(await ws.inspectRepository(join(dir, 'file.txt'))).toEqual({
      ok: false,
      reason: 'not-a-directory',
    });
    expect(await ws.inspectRepository(join(dir, 'nada'))).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });
});
