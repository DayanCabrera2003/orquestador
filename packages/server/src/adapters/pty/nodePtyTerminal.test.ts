import { describe, expect, it } from 'vitest';
import { NodePtyTerminal } from './nodePtyTerminal';

describe('NodePtyTerminal', () => {
  it('ejecuta un proceso y entrega su salida', async () => {
    const isWindows = process.platform === 'win32';
    let output = '';
    const exitCode = await new Promise<number | null>((resolve) => {
      new NodePtyTerminal().open(
        {
          command: isWindows ? 'cmd.exe' : 'sh',
          args: isWindows ? ['/c', 'echo hola-pty'] : ['-c', 'echo hola-pty'],
          cwd: process.cwd(),
          cols: 80,
          rows: 24,
        },
        {
          onData: (d) => {
            output += d;
          },
          onExit: resolve,
        },
      );
    });
    expect(exitCode).toBe(0);
    expect(output).toContain('hola-pty');
  });
});
