export type RepositoryInspection =
  | { ok: true; root: string; name: string }
  | { ok: false; reason: 'not-found' | 'not-a-directory' | 'not-a-repository' };

/** Operaciones de git sobre el proyecto del usuario. */
export interface Workspace {
  inspectRepository(path: string): Promise<RepositoryInspection>;
}
