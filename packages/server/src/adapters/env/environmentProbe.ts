import type { Environment } from '@orquestador/protocol';
import { execa } from 'execa';
import type { EnvironmentProbe } from '../../ports/EnvironmentProbe';
import { findExecutable } from './findExecutable';

type ToolStatus = Environment['git'];

async function versionOf(command: string): Promise<ToolStatus> {
  const path = await findExecutable(command);
  if (!path) return { found: false, version: null, problem: 'not-found' };
  try {
    const r = await execa(command, ['--version'], { timeout: 10_000 });
    const match = /\d+\.\d+(\.\d+)?/.exec(r.stdout);
    return { found: true, version: match?.[0] ?? null, problem: null };
  } catch {
    return { found: true, version: null, problem: 'failed' };
  }
}

const platformOf = (p: NodeJS.Platform): Environment['platform'] =>
  p === 'darwin' || p === 'win32' ? p : 'linux';

export class SystemEnvironmentProbe implements EnvironmentProbe {
  constructor(private readonly agentCommand: string) {}

  async detect(): Promise<Environment> {
    const [git, agentCli] = await Promise.all([versionOf('git'), versionOf(this.agentCommand)]);
    return { platform: platformOf(process.platform), git, agentCli };
  }
}
