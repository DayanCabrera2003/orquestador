import { makeFlow, makeSession } from '@orquestador/core/testing';
import { describe, expect, it } from 'vitest';
import { edgeForMessage, flowToEdges, flowToNodes, parseEdgeId } from './graphView';

const flow = makeFlow([
  makeSession({ id: 'lider', model: 'opus', subagents: ['rev'] }),
  makeSession({ id: 'e1', reportsTo: 'lider', position: { x: 10, y: 20 } }),
  makeSession({ id: 'rev', model: 'sonnet' }),
]);

describe('graphView', () => {
  it('crea un nodo por sesión con su posición', () => {
    expect(flowToNodes(flow)[1]).toEqual({
      id: 'e1',
      type: 'session',
      position: { x: 10, y: 20 },
      data: { sessionId: 'e1' },
    });
  });

  it('crea aristas de reporte y de subagente con el modelo que da el tono', () => {
    expect(flowToEdges(flow)).toEqual([
      {
        id: 's:lider:rev',
        source: 'lider',
        sourceHandle: 'subagent',
        target: 'rev',
        targetHandle: 'in-left',
        type: 'relation',
        data: { kind: 'subagent', model: 'sonnet' },
      },
      {
        id: 'r:e1',
        source: 'e1',
        sourceHandle: 'report',
        target: 'lider',
        targetHandle: 'in-bottom',
        type: 'relation',
        data: { kind: 'report', model: 'haiku' },
      },
    ]);
  });

  it('encuentra la arista y el sentido de un mensaje', () => {
    expect(edgeForMessage(flow, 'e1', 'lider')).toEqual({ edgeId: 'r:e1', reverse: false });
    expect(edgeForMessage(flow, 'lider', 'e1')).toEqual({ edgeId: 'r:e1', reverse: true });
    expect(edgeForMessage(flow, 'lider', 'rev')).toEqual({ edgeId: 's:lider:rev', reverse: false });
    expect(edgeForMessage(flow, 'rev', 'lider')).toEqual({ edgeId: 's:lider:rev', reverse: true });
    expect(edgeForMessage(flow, 'e1', null)).toBeUndefined();
    expect(edgeForMessage(flow, 'e1', 'rev')).toBeUndefined();
  });

  it('interpreta los ids de arista', () => {
    expect(parseEdgeId('r:e1')).toEqual({ kind: 'report', childId: 'e1' });
    expect(parseEdgeId('s:lider:rev')).toEqual({
      kind: 'subagent',
      parentId: 'lider',
      childId: 'rev',
    });
    expect(parseEdgeId('x')).toBeUndefined();
  });
});
