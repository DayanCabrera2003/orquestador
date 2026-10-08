import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    if (!(await stat(path)).isFile()) return false;
    if (process.platform !== 'win32') await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Busca un ejecutable como lo haría la shell: en cada carpeta del PATH y, en Windows, probando
 * las extensiones de PATHEXT (.exe, .cmd…). Devuelve la ruta encontrada o undefined.
 */
export async function findExecutable(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  const extensions =
    process.platform === 'win32'
      ? ['', ...(env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)]
      : [''];
  const candidates = isAbsolute(command)
    ? extensions.map((ext) => command + ext)
    : (env.PATH ?? env.Path ?? '')
        .split(delimiter)
        .filter(Boolean)
        .flatMap((dir) => extensions.map((ext) => join(dir, command + ext)));
  for (const candidate of candidates) {
    if (await isExecutableFile(candidate)) return candidate;
  }
  return undefined;
}
