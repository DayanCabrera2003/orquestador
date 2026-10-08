import {
  childrenOf,
  composeInstructions,
  findSession,
  ROLE_TEMPLATES,
  subagentOwnersOf,
  type Flow,
  type SessionNode,
} from '@orquestador/core';
import type { ChatMessage, InboxItem } from '@orquestador/protocol';
import { join } from 'node:path';
import type {
  AgentHandle,
  AgentRuntime,
  CoordinationHandlers,
  InboxKind,
} from '../ports/AgentRuntime';
import type { AppContext } from './context';
import { AppError } from './errors';
import { getFlow, projectOfFlow } from './flows';
import { requireProject } from './projects';
import type { RuntimeRegistry } from './runtime';
import { describeToolUse, slug } from './text';

interface Running {
  flowId: string;
  sessionId: string;
  handle: AgentHandle;
  /** La sesión llamó a report_done en este turno. */
  finished: boolean;
  /** La sesión espera una respuesta (de su padre o del usuario). */
  blocked: boolean;
}

interface PendingQuestion {
  id: string;
  flowId: string;
  fromSessionId: string;
  /** Sesiones por las que pasó: la que preguntó y cada una que la recibió. */
  route: string[];
  question: string;
}

type Author = { kind: 'user' } | { kind: 'session'; sessionId: string } | { kind: 'system' };

const key = (flowId: string, sessionId: string): string => `${flowId}\u0000${sessionId}`;
const quote = (s: SessionNode): string => `«${s.name}»`;

/** Ciclo de vida de las sesiones reales y enrutamiento de la coordinación entre ellas. */
export class SessionManager {
  private readonly running = new Map<string, Running>();
  private readonly questions = new Map<string, PendingQuestion>();
  private nextQuestion = 1;

  constructor(
    private readonly ctx: AppContext,
    private readonly runtime: RuntimeRegistry,
    private readonly agents: AgentRuntime,
    private readonly worktreesDir: string,
  ) {}

  isRunning(flowId: string, sessionId: string): boolean {
    return this.running.has(key(flowId, sessionId));
  }

  /** Inicia la sesión si no está en marcha. */
  async start(flowId: string, sessionId: string): Promise<Running> {
    const existing = this.running.get(key(flowId, sessionId));
    if (existing) return existing;

    const flow = getFlow(this.ctx, flowId);
    const session = this.requireSession(flow, sessionId);
    const project = requireProject(this.ctx, projectOfFlow(this.ctx, flowId));
    const instructions = composeInstructions(flow, sessionId);
    if (!instructions.ok) throw new AppError('not-found', `Sesión ${sessionId} no existe`);

    let cwd = project.path;
    let worktreePath: string | null = null;
    let branch: string | null = null;
    if (session.permissions.editFiles) {
      const path = join(
        this.worktreesDir,
        project.id.slice(0, 8),
        `${flowId.slice(0, 8)}-${slug(session.id)}`,
      );
      const wt = await this.ctx.workspace.ensureWorktree(
        project.path,
        path,
        `orq/${slug(flow.name)}/${slug(session.name)}`,
      );
      if (!wt.ok) throw new AppError('conflict', `No se pudo crear el worktree: ${wt.detail}`);
      cwd = wt.path;
      worktreePath = wt.path;
      branch = wt.branch;
    }

    const subagents = session.subagents.flatMap((id) => {
      const sub = findSession(flow, id);
      const prompt = sub ? composeInstructions(flow, id) : undefined;
      if (!sub || !prompt?.ok) return [];
      return [
        {
          name: slug(sub.name),
          description: `${ROLE_TEMPLATES[sub.role].defaultName}: ${sub.name}`,
          prompt: prompt.value,
          model: sub.model,
        },
      ];
    });

    const entry: Running = {
      flowId,
      sessionId,
      finished: false,
      blocked: false,
      handle: undefined as unknown as AgentHandle,
    };
    this.running.set(key(flowId, sessionId), entry);
    entry.handle = this.agents.start(
      {
        model: session.model,
        cwd,
        instructions: instructions.value,
        permissions: session.permissions,
        subagents,
        resumeId: this.ctx.store.getAgentSessionId(flowId, sessionId),
        coordination: this.coordination(flowId, sessionId),
      },
      {
        onSessionId: (id) => {
          this.ctx.store.setAgentSessionId(flowId, sessionId, id);
        },
        onDelta: (text) => {
          this.ctx.events.publish({
            type: 'session.delta',
            flowId,
            sessionId,
            messageId: 'draft',
            text,
          });
        },
        onText: (text) => {
          this.record(flowId, sessionId, { kind: 'agent' }, text);
        },
        onToolUse: (name, input) => {
          this.runtime.update(flowId, sessionId, { currentTask: describeToolUse(name, input) });
        },
        onTurnEnd: (result) => {
          this.runtime.recordUsage(flowId, sessionId, result.usage, result.contextTokens);
          const status = result.isError
            ? 'error'
            : entry.finished
              ? 'done'
              : entry.blocked
                ? 'blocked'
                : 'waiting';
          this.runtime.update(flowId, sessionId, {
            status,
            ...(result.error ? { currentTask: `Error: ${result.error}` } : {}),
          });
        },
        onClosed: (error) => {
          this.running.delete(key(flowId, sessionId));
          if (error)
            this.runtime.update(flowId, sessionId, {
              status: 'error',
              currentTask: `Error: ${error}`,
            });
        },
      },
    );
    this.runtime.update(flowId, sessionId, { status: 'waiting', worktreePath, branch });
    return entry;
  }

  /** Entrega un mensaje a una sesión, iniciándola si hace falta, y lo guarda en su chat. */
  async deliver(flowId: string, sessionId: string, author: Author, text: string): Promise<void> {
    const entry = await this.start(flowId, sessionId);
    const flow = getFlow(this.ctx, flowId);
    const from = author.kind === 'session' ? findSession(flow, author.sessionId) : undefined;
    this.record(
      flowId,
      sessionId,
      author.kind === 'session' ? { kind: 'session', sessionId: author.sessionId } : author,
      text,
    );
    entry.finished = false;
    entry.blocked = false;
    this.runtime.update(flowId, sessionId, {
      status: 'thinking',
      currentTask: this.firstLine(text),
    });
    entry.handle.send(
      from
        ? `[Mensaje de ${quote(from)}]\n${text}`
        : author.kind === 'system'
          ? `[Orquestador]\n${text}`
          : text,
    );
  }

  async pause(flowId: string, sessionId: string): Promise<void> {
    const entry = this.running.get(key(flowId, sessionId));
    if (entry) await entry.handle.interrupt();
    this.runtime.update(flowId, sessionId, { status: 'paused' });
  }

  async resume(flowId: string, sessionId: string): Promise<void> {
    await this.deliver(
      flowId,
      sessionId,
      { kind: 'system' },
      'Continúa con tu tarea donde la dejaste.',
    );
  }

  /** Inicia las sesiones raíz del flujo: las que reportan al usuario y no son solo subagentes. */
  async startFlow(flowId: string): Promise<void> {
    const flow = getFlow(this.ctx, flowId);
    const roots = flow.sessions.filter(
      (s) => s.reportsTo === null && subagentOwnersOf(flow, s.id).length === 0,
    );
    for (const s of roots) await this.start(flowId, s.id);
  }

  async pauseFlow(flowId: string): Promise<void> {
    for (const entry of [...this.running.values()].filter((e) => e.flowId === flowId)) {
      await this.pause(entry.flowId, entry.sessionId);
    }
  }

  /** Respuesta del usuario a una pregunta de la bandeja: baja hasta la sesión que preguntó. */
  async answerInbox(itemId: string, answer: string): Promise<void> {
    const item = this.ctx.store.getInboxItem(itemId);
    if (!item) throw new AppError('not-found', `Pregunta ${itemId} no existe`);
    this.ctx.store.deleteInboxItem(itemId);
    this.ctx.events.publish({ type: 'inbox.resolved', itemId });
    this.pulseDown(item.flowId, item.route, answer);
    await this.deliver(
      item.flowId,
      item.fromSessionId,
      { kind: 'user' },
      `Respuesta del usuario a «${item.question}»:\n${answer}`,
    );
  }

  closeAll(): void {
    for (const entry of this.running.values()) entry.handle.close();
    this.running.clear();
  }

  private coordination(flowId: string, sessionId: string): CoordinationHandlers {
    const self = (): { flow: Flow; me: SessionNode } => {
      const flow = getFlow(this.ctx, flowId);
      return { flow, me: this.requireSession(flow, sessionId) };
    };
    const entry = (): Running | undefined => this.running.get(key(flowId, sessionId));

    return {
      askParent: async (question) => {
        const { flow, me } = self();
        const parent = me.reportsTo ? findSession(flow, me.reportsTo) : undefined;
        if (!parent)
          return this.toInbox(flowId, sessionId, [sessionId], question, 'question', [], '');
        const q = this.newQuestion(flowId, sessionId, [sessionId, parent.id], question);
        this.markBlocked(sessionId, `Esperando respuesta de ${quote(parent)}`);
        this.relation(flowId, sessionId, parent.id, 'question', question);
        await this.deliver(
          flowId,
          parent.id,
          { kind: 'session', sessionId },
          this.questionText(q, me, me),
        );
        return `Pregunta enviada a ${quote(parent)} (id ${q.id}). Espera: la respuesta te llegará como mensaje.`;
      },

      askUser: (question, kind, options, context) =>
        Promise.resolve(
          this.toInbox(flowId, sessionId, [sessionId], question, kind, options, context),
        ),

      delegateTask: async (target, task) => {
        const { flow, me } = self();
        const children = childrenOf(flow, me.id);
        const wanted = target.trim().toLowerCase();
        const child = children.find((c) => c.id === target || c.name.toLowerCase() === wanted);
        if (!child) {
          return `No puedes delegar en "${target}". Te reportan: ${children.map((c) => quote(c)).join(', ') || 'nadie'}.`;
        }
        this.relation(flowId, sessionId, child.id, 'delegation', task);
        await this.deliver(flowId, child.id, { kind: 'session', sessionId }, task);
        return `Tarea enviada a ${quote(child)}. Te enviará su resumen cuando termine.`;
      },

      answerQuestion: async (questionId, answer) => {
        const q = this.questions.get(questionId);
        if (q?.flowId !== flowId || q.route[q.route.length - 1] !== sessionId) {
          return `No tienes una pregunta pendiente con id ${questionId}.`;
        }
        this.questions.delete(questionId);
        const { flow, me } = self();
        const asker = findSession(flow, q.fromSessionId);
        this.pulseDown(flowId, q.route, answer);
        await this.deliver(
          flowId,
          q.fromSessionId,
          { kind: 'session', sessionId },
          `Respuesta de ${quote(me)} a tu pregunta «${q.question}»:\n${answer}`,
        );
        return `Respuesta enviada a ${asker ? quote(asker) : q.fromSessionId}.`;
      },

      escalateQuestion: async (questionId) => {
        const q = this.questions.get(questionId);
        if (q?.flowId !== flowId || q.route[q.route.length - 1] !== sessionId) {
          return `No tienes una pregunta pendiente con id ${questionId}.`;
        }
        const { flow, me } = self();
        const next = me.reportsTo ? findSession(flow, me.reportsTo) : undefined;
        const asker = findSession(flow, q.fromSessionId);
        if (!next || !asker) {
          this.questions.delete(questionId);
          this.toInbox(
            flowId,
            q.fromSessionId,
            q.route,
            q.question,
            'question',
            [],
            `Subió por ${String(q.route.length)} sesiones sin respuesta segura.`,
          );
          return 'La pregunta subió al usuario. La respuesta llegará directamente a quien preguntó.';
        }
        q.route.push(next.id);
        this.relation(flowId, sessionId, next.id, 'escalation', q.question);
        await this.deliver(
          flowId,
          next.id,
          { kind: 'session', sessionId },
          this.questionText(q, asker, me),
        );
        return `Pregunta escalada a ${quote(next)}.`;
      },

      reportDone: async (summary, files, risks) => {
        const { flow, me } = self();
        const current = entry();
        if (current) current.finished = true;
        const body = [
          `Resumen de ${quote(me)}:`,
          summary,
          files.length > 0 ? `Archivos: ${files.join(', ')}` : '',
          risks ? `Riesgos: ${risks}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        const parent = me.reportsTo ? findSession(flow, me.reportsTo) : undefined;
        if (parent) {
          this.relation(flowId, sessionId, parent.id, 'report', summary);
          await this.deliver(
            flowId,
            parent.id,
            { kind: 'session', sessionId },
            `${body}\n\nRevísalo y, si algo está mal, devuélvelo con delegate_task.`,
          );
          return `Resumen entregado a ${quote(parent)}.`;
        }
        this.relation(flowId, sessionId, null, 'report', summary);
        return 'Resumen entregado al usuario.';
      },

      listPeers: () => {
        const { flow } = self();
        const lines = flow.sessions
          .filter((s) => s.id !== sessionId)
          .map((s) => {
            const live = this.runtime.liveState(flowId, s.id);
            const parent = s.reportsTo ? findSession(flow, s.reportsTo) : undefined;
            return `- ${quote(s)} (${s.role}, ${s.model}) · estado: ${live.status} · reporta a: ${parent ? parent.name : 'el usuario'}${live.worktreePath ? ` · worktree: ${live.worktreePath}` : ''}`;
          });
        return Promise.resolve(lines.length > 0 ? lines.join('\n') : 'No hay otras sesiones.');
      },
    };
  }

  private questionText(q: PendingQuestion, asker: SessionNode, via: SessionNode): string {
    const origin = asker.id === via.id ? quote(asker) : `${quote(asker)} (vía ${quote(via)})`;
    return `Pregunta de ${origin} · id ${q.id}:\n${q.question}\n\nSi estás segura, responde con answer_question. Si no, súbela con escalate_question.`;
  }

  private newQuestion(
    flowId: string,
    fromSessionId: string,
    route: string[],
    question: string,
  ): PendingQuestion {
    const q = { id: `q${String(this.nextQuestion++)}`, flowId, fromSessionId, route, question };
    this.questions.set(q.id, q);
    return q;
  }

  private toInbox(
    flowId: string,
    fromSessionId: string,
    route: string[],
    question: string,
    kind: InboxKind,
    options: string[],
    context: string,
  ): string {
    const item: InboxItem = {
      id: this.ctx.newId(),
      flowId,
      fromSessionId,
      route,
      kind,
      question,
      context,
      options,
      createdAt: this.ctx.now(),
    };
    this.ctx.store.insertInboxItem(item);
    this.ctx.events.publish({ type: 'inbox.added', item });
    this.markBlocked(fromSessionId, 'Esperando tu respuesta');
    const last = route[route.length - 1];
    if (last) this.relation(flowId, last, null, 'escalation', question);
    return 'Pregunta enviada al usuario. Espera: la respuesta te llegará como mensaje.';
  }

  private markBlocked(sessionId: string, task: string): void {
    for (const e of this.running.values()) {
      if (e.sessionId === sessionId) {
        e.blocked = true;
        this.runtime.update(e.flowId, sessionId, { status: 'blocked', currentTask: task });
      }
    }
  }

  /** Anima la respuesta bajando por la ruta de una pregunta. */
  private pulseDown(flowId: string, route: string[], summary: string): void {
    for (let i = route.length - 1; i > 0; i--) {
      const from = route[i];
      const to = route[i - 1];
      if (from && to) this.relation(flowId, from, to, 'answer', summary);
    }
  }

  private relation(
    flowId: string,
    fromSessionId: string,
    toSessionId: string | null,
    kind: 'question' | 'answer' | 'escalation' | 'report' | 'delegation',
    summary: string,
  ): void {
    this.ctx.events.publish({
      type: 'relation.message',
      flowId,
      fromSessionId,
      toSessionId,
      kind,
      summary: this.firstLine(summary),
    });
  }

  private record(
    flowId: string,
    sessionId: string,
    author:
      | { kind: 'user' }
      | { kind: 'agent' }
      | { kind: 'system' }
      | { kind: 'session'; sessionId: string },
    text: string,
  ): void {
    const message: ChatMessage = {
      id: this.ctx.newId(),
      sessionId,
      author: author.kind,
      fromSessionId: author.kind === 'session' ? author.sessionId : null,
      text,
      createdAt: this.ctx.now(),
    };
    this.ctx.store.insertMessage(flowId, message);
    this.ctx.events.publish({ type: 'session.message', message });
  }

  private requireSession(flow: Flow, sessionId: string): SessionNode {
    const session = findSession(flow, sessionId);
    if (!session) throw new AppError('not-found', `Sesión ${sessionId} no existe`);
    return session;
  }

  private firstLine(text: string): string {
    const line = text.split('\n').find((l) => l.trim()) ?? '';
    return line.length > 120 ? `${line.slice(0, 117)}…` : line;
  }
}
