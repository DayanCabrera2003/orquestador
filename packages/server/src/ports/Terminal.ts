export interface TerminalOptions {
  command: string;
  args: string[];
  cwd: string;
  cols: number;
  rows: number;
}

export interface TerminalCallbacks {
  onData: (data: string) => void;
  onExit: (exitCode: number | null) => void;
}

export interface TerminalHandle {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

/** Abre procesos en una pseudo-terminal. */
export interface TerminalPort {
  open: (options: TerminalOptions, callbacks: TerminalCallbacks) => TerminalHandle;
}
