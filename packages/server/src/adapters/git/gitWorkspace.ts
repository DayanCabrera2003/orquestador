import { execa } from 'execa';
import { mkdir, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type { RepositoryInspection, Workspace, WorktreeResult } from '../../ports/Workspace';

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

  async ensureWorktree(repoRoot: string, path: string, branch: string): Promise<WorktreeResult> {
    const git = (cwd: string, args: string[]) =>
      execa('git', ['-C', cwd, ...args], { reject: false });
    const existing = await git(path, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => undefined);
    if (existing?.exitCode === 0) return { ok: true, path, branch: existing.stdout.trim() };

    const head = await git(repoRoot, ['rev-parse', '--verify', '--quiet', 'HEAD']);
    if (head.exitCode !== 0)
      return { ok: false, reason: 'no-commits', detail: 'El repositorio no tiene commits' };

    await mkdir(dirname(path), { recursive: true });
    await git(repoRoot, ['worktree', 'prune']);
    const branchExists =
      (await git(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]))
        .exitCode === 0;
    const add = branchExists
      ? await git(repoRoot, ['worktree', 'add', path, branch])
      : await git(repoRoot, ['worktree', 'add', '-b', branch, path, 'HEAD']);
    if (add.exitCode !== 0) return { ok: false, reason: 'failed', detail: add.stderr };
    if (process.platform === 'win32') await git(path, ['config', 'core.longpaths', 'true']);
    return { ok: true, path, branch };
  }
}
