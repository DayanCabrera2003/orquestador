import { describe, expect, it } from 'vitest';
import { RoleSchema } from '../flow/types';
import { ROLE_TEMPLATES } from './templates';

describe('ROLE_TEMPLATES', () => {
  it('tiene una plantilla para cada rol', () => {
    expect(Object.keys(ROLE_TEMPLATES).sort()).toEqual([...RoleSchema.options].sort());
  });

  it('asigna el modelo por defecto de cada rol', () => {
    expect(ROLE_TEMPLATES.lider.model).toBe('opus');
    expect(ROLE_TEMPLATES.consultor.model).toBe('sonnet');
    expect(ROLE_TEMPLATES.revisor.model).toBe('sonnet');
    expect(ROLE_TEMPLATES.ejecutor.model).toBe('haiku');
    expect(ROLE_TEMPLATES.qa.model).toBe('haiku');
  });

  it('solo los roles que implementan editan archivos', () => {
    expect(ROLE_TEMPLATES.ejecutor.permissions.editFiles).toBe(true);
    expect(ROLE_TEMPLATES.consultor.permissions.editFiles).toBe(false);
    expect(ROLE_TEMPLATES.revisor.permissions.editFiles).toBe(false);
  });

  it('todas menos la personalizada traen instrucciones', () => {
    for (const [role, t] of Object.entries(ROLE_TEMPLATES)) {
      expect(t.instructions.length > 0).toBe(role !== 'personalizado');
    }
  });
});
