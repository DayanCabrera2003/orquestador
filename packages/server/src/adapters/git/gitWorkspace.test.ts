import { execa } from 'execa';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
  await execa('git', ['init', '-q', join(dir, 'vacio')]);
  writeFileSync(join(dir, 'repo', 'README.md'), 'hola');
  await execa('git', ['-C', join(dir, 'repo'), 'add', '.']);
  await execa('git', [
    '-C',
    join(dir, 'repo'),
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@t',
    'commit',
    '-qm',
    'init',
  ]);
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

describe('GitWorkspace.ensureWorktree', () => {
  it('crea el worktree con su rama y lo reutiliza después', async () => {
    const path = join(dir, 'wt', 'e1');
    expect(await ws.ensureWorktree(join(dir, 'repo'), path, 'orq/f1/e1')).toEqual({
      ok: true,
      path,
      branch: 'orq/f1/e1',
    });
    expect(readFileSync(join(path, 'README.md'), 'utf8')).toBe('hola');
    expect(await ws.ensureWorktree(join(dir, 'repo'), path, 'orq/f1/e1')).toEqual({
      ok: true,
      path,
      branch: 'orq/f1/e1',
    });
  });

  it('informa cuando el repositorio no tiene commits', async () => {
    const r = await ws.ensureWorktree(join(dir, 'vacio'), join(dir, 'wt', 'x'), 'orq/x');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-commits');
  });
});
