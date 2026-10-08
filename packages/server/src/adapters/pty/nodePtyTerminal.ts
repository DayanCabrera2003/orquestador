import { chmodSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { spawn } from 'node-pty';
import type {
  TerminalCallbacks,
  TerminalHandle,
  TerminalOptions,
  TerminalPort,
} from '../../ports/Terminal';

/**
 * En macOS, node-pty lanza los procesos a través de `spawn-helper`, que a veces se instala sin
 * permiso de ejecución. Se lo devolvemos antes de abrir la primera terminal.
 */
function ensureSpawnHelperExecutable(): void {
  if (process.platform !== 'darwin') return;
  let root: string;
  try {
    root = dirname(createRequire(import.meta.url).resolve('node-pty/package.json')).replace(
      `app.asar${sep}`,
      `app.asar.unpacked${sep}`,
    );
  } catch {
    return;
  }
  for (const helper of [
    join(root, 'build', 'Release', 'spawn-helper'),
    join(root, 'prebuilds', `darwin-${process.arch}`, 'spawn-helper'),
  ]) {
    try {
      if ((statSync(helper).mode & 0o111) === 0) chmodSync(helper, 0o755);
    } catch {
      // No existe en esta instalación.
    }
  }
}

/** Terminal real con node-pty (ConPTY en Windows). */
export class NodePtyTerminal implements TerminalPort {
  private prepared = false;

  open(options: TerminalOptions, callbacks: TerminalCallbacks): TerminalHandle {
    if (!this.prepared) {
      ensureSpawnHelperExecutable();
      this.prepared = true;
    }
    const pty = spawn(options.command, options.args, {
      name: 'xterm-256color',
      cwd: options.cwd,
      cols: options.cols,
      rows: options.rows,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
    pty.onData(callbacks.onData);
    pty.onExit(({ exitCode }) => {
      callbacks.onExit(exitCode);
    });
    return {
      write: (data) => {
        pty.write(data);
      },
      resize: (cols, rows) => {
        pty.resize(cols, rows);
      },
      kill: () => {
        pty.kill();
      },
    };
  }
}
