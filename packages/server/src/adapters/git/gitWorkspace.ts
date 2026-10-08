import { execa } from 'execa';
import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { RepositoryInspection, Workspace } from '../../ports/Workspace';

export class GitWorkspace implements Workspace {
  async inspectRepository(path: string): Promise<RepositoryInspection> {
    const absolute = resolve(path);
    const info = await stat(absolute).catch(() => undefined);
    if (!info) return { ok: false, reason: 'not-found' };
    if (!info.isDirectory()) return { ok: false, reason: 'not-a-directory' };
    const r = await execa('git', ['-C', absolute, 'rev-parse', '--show-toplevel'], {
      reject: false,
    });
    if (r.exitCode !== 0) return { ok: false, reason: 'not-a-repository' };
    const root = resolve(r.stdout.trim());
    return { ok: true, root, name: basename(root) };
  }
}
