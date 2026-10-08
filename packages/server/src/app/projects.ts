import type { Project } from '@orquestador/protocol';
import type { AppContext } from './context';
import { AppError } from './errors';

export function listProjects({ store }: AppContext): Project[] {
  return store.listProjects();
}

/** Registra un repositorio git como proyecto. Si ya estaba, devuelve el existente. */
export async function addProject(ctx: AppContext, path: string): Promise<Project> {
  const repo = await ctx.workspace.inspectRepository(path);
  if (!repo.ok)
    throw new AppError('not-a-repository', `No es un repositorio git: ${path}`, {
      reason: repo.reason,
    });
  const existing = ctx.store.findProjectByPath(repo.root);
  if (existing) return existing;
  const project: Project = {
    id: ctx.newId(),
    name: repo.name,
    path: repo.root,
    createdAt: ctx.now(),
  };
  ctx.store.insertProject(project);
  return project;
}

export function removeProject({ store }: AppContext, id: string): void {
  if (!store.getProject(id)) throw new AppError('not-found', `Proyecto ${id} no existe`);
  store.deleteProject(id);
}

export function requireProject({ store }: AppContext, id: string): Project {
  const project = store.getProject(id);
  if (!project) throw new AppError('not-found', `Proyecto ${id} no existe`);
  return project;
}
