import { addUsage, costUsd, EMPTY_USAGE, type Flow, type TokenUsage } from '@orquestador/core';
import type { SessionRuntime } from '@orquestador/protocol';
import type { AppContext } from './context';
import { getFlow } from './flows';
import { getSettings } from './settings';

type LiveState = Pick<
  SessionRuntime,
  'status' | 'currentTask' | 'worktreePath' | 'branch' | 'terminalOpen'
>;

const IDLE: LiveState = {
  status: 'idle',
  currentTask: '',
  worktreePath: null,
  branch: null,
  terminalOpen: false,
};

const key = (flowId: string, sessionId: string): string => `${flowId}\u0000${sessionId}`;

/**
 * Estado en ejecución de las sesiones. El estado vivo está en memoria; el consumo se guarda en la
 * base para sobrevivir a reinicios.
 */
export class RuntimeRegistry {
  private readonly live = new Map<string, LiveState>();

  constructor(private readonly ctx: AppContext) {}

  list(flowId: string): SessionRuntime[] {
    const flow = getFlow(this.ctx, flowId);
    const usage = new Map(this.ctx.store.usageByFlow(flowId).map((u) => [u.sessionId, u]));
    return flow.sessions.map((s) => this.build(flow, s.id, usage.get(s.id)));
  }

  get(flowId: string, sessionId: string): SessionRuntime | undefined {
    return this.list(flowId).find((r) => r.sessionId === sessionId);
  }

  /** Cambia el estado vivo de una sesión y avisa a la UI. */
  update(flowId: string, sessionId: string, patch: Partial<LiveState>): void {
    const k = key(flowId, sessionId);
    this.live.set(k, { ...(this.live.get(k) ?? IDLE), ...patch });
    this.publish(flowId, sessionId);
  }

  /** Suma consumo de un turno y avisa a la UI. */
  recordUsage(flowId: string, sessionId: string, usage: TokenUsage, contextTokens: number): void {
    this.ctx.store.addUsage(flowId, { sessionId, usage, contextTokens }, this.ctx.now());
    this.publish(flowId, sessionId);
  }

  liveState(flowId: string, sessionId: string): LiveState {
    return this.live.get(key(flowId, sessionId)) ?? IDLE;
  }

  private publish(flowId: string, sessionId: string): void {
    const runtime = this.get(flowId, sessionId);
    if (runtime) this.ctx.events.publish({ type: 'session.runtime', runtime });
  }

  private build(
    flow: Flow,
    sessionId: string,
    recorded: { usage: TokenUsage; contextTokens: number } | undefined,
  ): SessionRuntime {
    const session = flow.sessions.find((s) => s.id === sessionId);
    const pricing = getSettings(this.ctx).pricing;
    const usage = addUsage(EMPTY_USAGE, recorded?.usage ?? EMPTY_USAGE);
    return {
      sessionId,
      flowId: flow.id,
      ...this.liveState(flow.id, sessionId),
      usage,
      contextTokens: recorded?.contextTokens ?? 0,
      costUsd: session ? costUsd(usage, pricing[session.model]) : 0,
    };
  }
}
