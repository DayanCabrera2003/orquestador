import { describe, expect, it } from 'vitest';
import * as core from './index';

describe('API pública de core', () => {
  it('expone las funciones principales', () => {
    for (const name of [
      'FlowSchema',
      'setReportsTo',
      'addSubagent',
      'addSession',
      'removeSession',
      'validateFlow',
      'migrateFlow',
      'composeInstructions',
      'costUsd',
      'parseFlowYaml',
      'serializeFlowYaml',
      'COORDINATION_TOOLS',
      'ROLE_TEMPLATES',
    ]) {
      expect(core).toHaveProperty(name);
    }
  });

  it('no expone los fixtures de tests', () => {
    expect(core).not.toHaveProperty('makeSession');
  });
});
