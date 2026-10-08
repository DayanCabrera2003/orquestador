import type { Environment } from '@orquestador/protocol';
import { execa } from 'execa';
import type { EnvironmentProbe } from '../../ports/EnvironmentProbe';

type ToolStatus = Environment['git'];

async function versionOf(command: string): Promise<ToolStatus> {
  try {
    const r = await execa(command, ['--version'], { reject: false, timeout: 10_000 });
    if (r.exitCode !== 0) return { found: true, version: null, problem: 'failed' };
    const match = /\d+\.\d+(\.\d+)?/.exec(r.stdout);
    return { found: true, version: match?.[0] ?? null, problem: null };
  } catch {
    return { found: false, version: null, problem: 'not-found' };
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
