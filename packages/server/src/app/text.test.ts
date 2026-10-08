import { describe, expect, it } from 'vitest';
import { describeToolUse, slug } from './text';

describe('texto', () => {
  it('slug quita acentos y símbolos', () => {
    expect(slug('Ejecutor 1 · API de pagos')).toBe('ejecutor-1-api-de-pagos');
    expect(slug('feature/pagos')).toBe('feature-pagos');
    expect(slug('···')).toBe('sesion');
  });

  it('describe una herramienta por su detalle principal', () => {
    expect(describeToolUse('Edit', { file_path: 'src/a.ts' })).toBe('Edit: src/a.ts');
    expect(describeToolUse('mcp__orquestador__report_done', {})).toBe('report_done');
  });
});
