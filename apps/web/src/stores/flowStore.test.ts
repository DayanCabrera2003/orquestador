import { setReportsTo } from '@orquestador/core';
import { makeFlow, makeSession } from '@orquestador/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFlow } from './flowStore';
import { useUi } from './uiStore';

vi.mock('../api/http', () => ({ request: vi.fn(() => Promise.resolve({})), ApiError: Error }));

const flow = makeFlow([makeSession({ id: 'a' }), makeSession({ id: 'b', reportsTo: 'a' })]);

describe('useFlow', () => {
  beforeEach(() => {
    useFlow.setState({ flow, pending: false });
    useUi.setState({ toasts: [] });
  });

  it('aplica un cambio válido y lo marca pendiente de guardar', () => {
    expect(useFlow.getState().apply((f) => setReportsTo(f, 'b', null))).toBe(true);
    expect(useFlow.getState().flow?.sessions[1]?.reportsTo).toBeNull();
    expect(useFlow.getState().pending).toBe(true);
  });

  it('rechaza un cambio inválido y avisa con el texto del error', () => {
    expect(useFlow.getState().apply((f) => setReportsTo(f, 'a', 'b'))).toBe(false);
    expect(useFlow.getState().flow).toBe(flow);
    expect(useUi.getState().toasts[0]?.text).toBe('No se puede: crearía un ciclo de reportes.');
  });

  it('ignora cambios remotos mientras hay cambios locales pendientes', () => {
    useFlow.getState().apply((f) => ({ ...f, name: 'local' }));
    useFlow.getState().receive({ ...flow, name: 'remoto' });
    expect(useFlow.getState().flow?.name).toBe('local');
  });
});
