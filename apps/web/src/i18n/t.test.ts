import { describe, expect, it } from 'vitest';
import { t, tMaybe } from './t';

describe('t', () => {
  it('devuelve el texto y sustituye variables', () => {
    expect(t('flows.sessions', { n: 3 })).toBe('3 sesiones');
    expect(t('relation.reportSet', { child: 'A', parent: 'B' })).toBe('A ahora reporta a B.');
  });

  it('tMaybe usa el texto de respaldo si la clave no existe', () => {
    expect(tMaybe('errors.cycle', 'errors.generic')).toBe(
      'No se puede: crearía un ciclo de reportes.',
    );
    expect(tMaybe('errors.otro', 'errors.generic', { message: 'x' })).toBe('Algo salió mal: x');
  });
});
