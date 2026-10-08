export type RepositoryInspection =
  | { ok: true; root: string; name: string }
  | { ok: false; reason: 'not-found' | 'not-a-directory' | 'not-a-repository' };

export type WorktreeResult =
  | { ok: true; path: string; branch: string }
  | { ok: false; reason: 'no-commits' | 'failed'; detail: string };

/** Operaciones de git sobre el proyecto del usuario. */
export interface Workspace {
  inspectRepository(path: string): Promise<RepositoryInspection>;
  /** Crea (o reutiliza) un worktree en `path` con la rama `branch`, a partir del HEAD del repo. */
  ensureWorktree(repoRoot: string, path: string, branch: string): Promise<WorktreeResult>;
}
