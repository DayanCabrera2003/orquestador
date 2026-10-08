import { spawn } from 'node-pty';
import type {
  TerminalCallbacks,
  TerminalHandle,
  TerminalOptions,
  TerminalPort,
} from '../../ports/Terminal';

/** Terminal real con node-pty (ConPTY en Windows). */
export class NodePtyTerminal implements TerminalPort {
  open(options: TerminalOptions, callbacks: TerminalCallbacks): TerminalHandle {
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
