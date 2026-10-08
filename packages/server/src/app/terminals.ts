import type { AgentRuntime } from '../ports/AgentRuntime';
import type { TerminalHandle, TerminalPort } from '../ports/Terminal';
import type { AppContext } from './context';
import type { SessionManager } from './sessions';

const key = (flowId: string, sessionId: string): string => `${flowId}\u0000${sessionId}`;

/** Terminales interactivas de la CLI del agente, una por sesión. */
export class TerminalManager {
  private readonly open = new Map<string, TerminalHandle>();

  constructor(
    private readonly ctx: AppContext,
    private readonly sessions: SessionManager,
    private readonly agents: AgentRuntime,
    private readonly terminal: TerminalPort,
  ) {}

  async openTerminal(flowId: string, sessionId: string, cols: number, rows: number): Promise<void> {
    const k = key(flowId, sessionId);
    const current = this.open.get(k);
    if (current) {
      current.resize(cols, rows);
      return;
    }
    const { cwd, launch } = await this.sessions.beginTerminal(flowId, sessionId);
    const { command, args } = this.agents.terminalCommand(launch);
    try {
      const handle = this.terminal.open(
        { command, args, cwd, cols, rows },
        {
          onData: (data) => {
            this.ctx.events.publish({ type: 'terminal.data', flowId, sessionId, data });
          },
          onExit: (exitCode) => {
            this.open.delete(k);
            this.sessions.endTerminal(flowId, sessionId);
            this.ctx.events.publish({ type: 'terminal.exit', flowId, sessionId, exitCode });
          },
        },
      );
      this.open.set(k, handle);
    } catch (e) {
      this.sessions.endTerminal(flowId, sessionId);
      throw e;
    }
  }

  input(flowId: string, sessionId: string, data: string): void {
    this.open.get(key(flowId, sessionId))?.write(data);
  }

  resize(flowId: string, sessionId: string, cols: number, rows: number): void {
    this.open.get(key(flowId, sessionId))?.resize(cols, rows);
  }

  close(flowId: string, sessionId: string): void {
    this.open.get(key(flowId, sessionId))?.kill();
  }

  closeAll(): void {
    for (const handle of this.open.values()) handle.kill();
    this.open.clear();
  }
}
