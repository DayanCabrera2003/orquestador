import type { Environment } from '@orquestador/protocol';
import { execa, ExecaError } from 'execa';
import type { EnvironmentProbe } from '../../ports/EnvironmentProbe';

type ToolStatus = Environment['git'];

async function versionOf(command: string): Promise<ToolStatus> {
  try {
    const r = await execa(command, ['--version'], { timeout: 10_000 });
    const match = /\d+\.\d+(\.\d+)?/.exec(r.stdout);
    return { found: true, version: match?.[0] ?? null, problem: null };
  } catch (e) {
    const notFound = e instanceof ExecaError && e.code === 'ENOENT';
    return { found: !notFound, version: null, problem: notFound ? 'not-found' : 'failed' };
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
