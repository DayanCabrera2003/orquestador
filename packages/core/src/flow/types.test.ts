import { describe, expect, it } from 'vitest';
import { FlowSchema, SessionNodeSchema } from './types';

const session = {
  id: 's1',
  name: 'Líder técnico',
  model: 'opus',
  role: 'lider',
  instructions: 'Planifica y revisa.',
  permissions: {
    editFiles: false,
    runCommands: true,
    openPullRequests: true,
    startInPlanMode: true,
  },
  budgetUsd: 8,
  position: { x: 0, y: 0 },
  reportsTo: null,
  subagents: [],
};

describe('SessionNodeSchema', () => {
  it('acepta una sesión válida', () => {
    expect(SessionNodeSchema.parse(session)).toEqual(session);
  });

  it('rechaza un modelo desconocido', () => {
    expect(SessionNodeSchema.safeParse({ ...session, model: 'gpt' }).success).toBe(false);
  });

  it('rechaza un presupuesto negativo', () => {
    expect(SessionNodeSchema.safeParse({ ...session, budgetUsd: -1 }).success).toBe(false);
  });

  it('rechaza un nombre vacío', () => {
    expect(SessionNodeSchema.safeParse({ ...session, name: '  ' }).success).toBe(false);
  });
});

describe('FlowSchema', () => {
  const flow = {
    schemaVersion: 1,
    id: 'f1',
    name: 'feature/pagos',
    budgetUsd: 15,
    sessions: [session],
  };

  it('acepta un flujo válido', () => {
    expect(FlowSchema.parse(flow)).toEqual(flow);
  });

  it('exige schemaVersion 1', () => {
    expect(FlowSchema.safeParse({ ...flow, schemaVersion: 2 }).success).toBe(false);
  });
});
