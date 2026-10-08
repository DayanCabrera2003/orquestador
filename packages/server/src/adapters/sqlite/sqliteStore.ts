import { migrateFlow } from '@orquestador/core';
import {
  ChatMessageSchema,
  InboxItemSchema,
  ProjectSchema,
  SettingsSchema,
  type ChatMessage,
  type FlowSummary,
  type InboxItem,
  type Project,
  type Settings,
} from '@orquestador/protocol';
import type { DatabaseSync } from 'node:sqlite';
import type { Store, StoredFlow, UsageRecord } from '../../ports/Store';
import { openDatabase } from './database';

type Row = Record<string, unknown>;

const str = (row: Row, key: string): string => {
  const v = row[key];
  if (typeof v !== 'string') throw new Error(`Columna ${key} inválida`);
  return v;
};
const num = (row: Row, key: string): number => {
  const v = row[key];
  if (typeof v !== 'number') throw new Error(`Columna ${key} inválida`);
  return v;
};

export class SqliteStore implements Store {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = openDatabase(path);
  }

  private all(sql: string, ...params: (string | number)[]): Row[] {
    return this.db.prepare(sql).all(...params);
  }

  private one(sql: string, ...params: (string | number)[]): Row | undefined {
    return this.db.prepare(sql).get(...params);
  }

  private run(sql: string, ...params: (string | number)[]): void {
    this.db.prepare(sql).run(...params);
  }

  private toProject = (row: Row): Project =>
    ProjectSchema.parse({ id: row.id, name: row.name, path: row.path, createdAt: row.created_at });

  listProjects(): Project[] {
    return this.all('SELECT * FROM projects ORDER BY name').map(this.toProject);
  }

  getProject(id: string): Project | undefined {
    const row = this.one('SELECT * FROM projects WHERE id = ?', id);
    return row && this.toProject(row);
  }

  findProjectByPath(path: string): Project | undefined {
    const row = this.one('SELECT * FROM projects WHERE path = ?', path);
    return row && this.toProject(row);
  }

  insertProject(p: Project): void {
    this.run(
      'INSERT INTO projects (id, name, path, created_at) VALUES (?, ?, ?, ?)',
      p.id,
      p.name,
      p.path,
      p.createdAt,
    );
  }

  deleteProject(id: string): void {
    this.run('DELETE FROM projects WHERE id = ?', id);
  }

  listFlows(projectId: string): FlowSummary[] {
    return this.all(
      'SELECT * FROM flows WHERE project_id = ? ORDER BY updated_at DESC',
      projectId,
    ).map((row) => {
      const flow = this.parseFlow(row);
      return {
        id: flow.id,
        projectId,
        name: flow.name,
        sessionCount: flow.sessions.length,
        updatedAt: str(row, 'updated_at'),
      };
    });
  }

  getFlow(id: string): StoredFlow | undefined {
    const row = this.one('SELECT * FROM flows WHERE id = ?', id);
    if (!row) return undefined;
    return {
      projectId: str(row, 'project_id'),
      flow: this.parseFlow(row),
      updatedAt: str(row, 'updated_at'),
    };
  }

  private parseFlow(row: Row): StoredFlow['flow'] {
    const r = migrateFlow(JSON.parse(str(row, 'data')));
    if (!r.ok) throw new Error(`El flujo ${str(row, 'id')} guardado no es válido: ${r.error.code}`);
    return r.value;
  }

  saveFlow({ projectId, flow, updatedAt }: StoredFlow): void {
    this.run(
      `INSERT INTO flows (id, project_id, name, data, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at`,
      flow.id,
      projectId,
      flow.name,
      JSON.stringify(flow),
      updatedAt,
    );
  }

  deleteFlow(id: string): void {
    this.run('DELETE FROM flows WHERE id = ?', id);
  }

  listMessages(flowId: string, sessionId: string): ChatMessage[] {
    return this.all(
      'SELECT data FROM messages WHERE flow_id = ? AND session_id = ? ORDER BY created_at, rowid',
      flowId,
      sessionId,
    ).map((row) => ChatMessageSchema.parse(JSON.parse(str(row, 'data'))));
  }

  insertMessage(flowId: string, m: ChatMessage): void {
    this.run(
      'INSERT INTO messages (id, flow_id, session_id, data, created_at) VALUES (?, ?, ?, ?, ?)',
      m.id,
      flowId,
      m.sessionId,
      JSON.stringify(m),
      m.createdAt,
    );
  }

  listInbox(): InboxItem[] {
    return this.all('SELECT data FROM inbox ORDER BY created_at').map((row) =>
      InboxItemSchema.parse(JSON.parse(str(row, 'data'))),
    );
  }

  getInboxItem(id: string): InboxItem | undefined {
    const row = this.one('SELECT data FROM inbox WHERE id = ?', id);
    return row && InboxItemSchema.parse(JSON.parse(str(row, 'data')));
  }

  insertInboxItem(item: InboxItem): void {
    this.run(
      'INSERT INTO inbox (id, flow_id, data, created_at) VALUES (?, ?, ?, ?)',
      item.id,
      item.flowId,
      JSON.stringify(item),
      item.createdAt,
    );
  }

  deleteInboxItem(id: string): void {
    this.run('DELETE FROM inbox WHERE id = ?', id);
  }

  addUsage(flowId: string, { sessionId, usage, contextTokens }: UsageRecord, at: string): void {
    this.run(
      `INSERT INTO usage_events (flow_id, session_id, input_tokens, output_tokens, cache_read_tokens,
         cache_write_tokens, context_tokens, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      flowId,
      sessionId,
      usage.inputTokens,
      usage.outputTokens,
      usage.cacheReadTokens,
      usage.cacheWriteTokens,
      contextTokens,
      at,
    );
  }

  usageByFlow(flowId: string): UsageRecord[] {
    return this.all(
      `SELECT session_id,
         SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens,
         SUM(cache_read_tokens) AS cache_read_tokens, SUM(cache_write_tokens) AS cache_write_tokens,
         (SELECT context_tokens FROM usage_events u2
            WHERE u2.flow_id = u.flow_id AND u2.session_id = u.session_id ORDER BY id DESC LIMIT 1) AS context_tokens
       FROM usage_events u WHERE flow_id = ? GROUP BY session_id ORDER BY session_id`,
      flowId,
    ).map((row) => ({
      sessionId: str(row, 'session_id'),
      usage: {
        inputTokens: num(row, 'input_tokens'),
        outputTokens: num(row, 'output_tokens'),
        cacheReadTokens: num(row, 'cache_read_tokens'),
        cacheWriteTokens: num(row, 'cache_write_tokens'),
      },
      contextTokens: num(row, 'context_tokens'),
    }));
  }

  getSettings(): Settings | undefined {
    const row = this.one('SELECT data FROM settings WHERE id = 1');
    return row && SettingsSchema.parse(JSON.parse(str(row, 'data')));
  }

  saveSettings(settings: Settings): void {
    this.run(
      'INSERT INTO settings (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
      JSON.stringify(settings),
    );
  }

  close(): void {
    this.db.close();
  }
}
