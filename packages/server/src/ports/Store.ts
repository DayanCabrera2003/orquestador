import type { Flow, TokenUsage } from '@orquestador/core';
import type { ChatMessage, FlowSummary, InboxItem, Project, Settings } from '@orquestador/protocol';

export interface StoredFlow {
  projectId: string;
  flow: Flow;
  updatedAt: string;
}

export interface UsageRecord {
  sessionId: string;
  usage: TokenUsage;
  contextTokens: number;
}

/** Persistencia del motor. Las operaciones son síncronas: la base es local y embebida. */
export interface Store {
  listProjects(): Project[];
  getProject(id: string): Project | undefined;
  findProjectByPath(path: string): Project | undefined;
  insertProject(project: Project): void;
  deleteProject(id: string): void;

  listFlows(projectId: string): FlowSummary[];
  getFlow(id: string): StoredFlow | undefined;
  saveFlow(stored: StoredFlow): void;
  deleteFlow(id: string): void;

  listMessages(flowId: string, sessionId: string): ChatMessage[];
  insertMessage(flowId: string, message: ChatMessage): void;

  listInbox(): InboxItem[];
  getInboxItem(id: string): InboxItem | undefined;
  insertInboxItem(item: InboxItem): void;
  deleteInboxItem(id: string): void;

  /** Suma consumo a una sesión y guarda el último tamaño de contexto. */
  addUsage(flowId: string, record: UsageRecord, at: string): void;
  usageByFlow(flowId: string): UsageRecord[];

  /** Id de la conversación del agente para una sesión, para poder retomarla. */
  getAgentSessionId(flowId: string, sessionId: string): string | undefined;
  setAgentSessionId(flowId: string, sessionId: string, agentSessionId: string): void;

  getSettings(): Settings | undefined;
  saveSettings(settings: Settings): void;

  close(): void;
}
