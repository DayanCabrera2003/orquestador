import { describe, expect, it } from 'vitest';
import { makeFlow, makeSession } from '../flow/fixtures';
import { composeInstructions } from './compose';

const readOnly = {
  editFiles: false,
  runCommands: true,
  openPullRequests: false,
  startInPlanMode: false,
};

const flow = makeFlow([
  makeSession({
    id: 'lider',
    name: 'Líder técnico',
    role: 'lider',
    model: 'opus',
    instructions: 'Coordina el cobro con Stripe.',
    permissions: { ...readOnly, openPullRequests: true },
    subagents: ['revisor'],
  }),
  makeSession({
    id: 'consultor',
    name: 'Consultor',
    role: 'consultor',
    permissions: readOnly,
    reportsTo: 'lider',
  }),
  makeSession({
    id: 'e1',
    name: 'Ejecutor 1',
    instructions: 'Implementa la API.',
    reportsTo: 'consultor',
  }),
  makeSession({ id: 'e2', name: 'Ejecutor 2', reportsTo: 'consultor' }),
  makeSession({ id: 'revisor', name: 'Revisor', role: 'revisor', permissions: readOnly }),
]);

function compose(id: string): string {
  const r = composeInstructions(flow, id);
  if (!r.ok) throw new Error(`no se pudo componer ${id}`);
  return r.value;
}

describe('composeInstructions', () => {
  it('falla con una sesión desconocida', () => {
    expect(composeInstructions(flow, 'nadie')).toEqual({
      ok: false,
      error: { code: 'unknown-session', id: 'nadie' },
    });
  });

  it('incluye nombre, rol, tamaño del equipo e instrucciones propias', () => {
    const text = compose('e1');
    expect(text).toContain('Eres «Ejecutor 1» (ejecutor) en un equipo de 5 sesiones');
    expect(text).toContain('Implementa la API.');
  });

  it('nombra a las demás sesiones', () => {
    expect(compose('e1')).toContain(
      'Hay 4 sesiones más en este proyecto: «Líder técnico» (líder), «Consultor» (consultor), «Ejecutor 2» (ejecutor), «Revisor» (revisor).',
    );
  });

  it('describe el aislamiento según el permiso de edición', () => {
    expect(compose('e1')).toContain('Trabajas en tu propio worktree');
    expect(compose('consultor')).toContain('No modificas archivos');
  });

  it('da la cadena de escalamiento completa hasta el usuario', () => {
    const text = compose('e1');
    expect(text).toContain(
      'Reportas a «Consultor». Si tienes una duda de implementación, pregúntale con `ask_parent`',
    );
    expect(text).toContain('«Consultor» → «Líder técnico» → el usuario');
  });

  it('a una raíz le indica que reporta al usuario', () => {
    expect(compose('lider')).toContain('Reportas directamente al usuario');
  });

  it('manda siempre las decisiones de diseño al usuario', () => {
    for (const id of ['lider', 'consultor', 'e1']) expect(compose(id)).toContain('`ask_user`');
  });

  it('pide el resumen final a quien corresponde', () => {
    expect(compose('e1')).toContain('llama a `report_done` con un resumen breve para «Consultor»');
    expect(compose('lider')).toContain('llama a `report_done` con un resumen para el usuario');
  });

  it('explica a un padre cómo responder, escalar y revisar', () => {
    const text = compose('consultor');
    expect(text).toContain(
      'Te reportan: «Ejecutor 1», «Ejecutor 2». Para asignarles trabajo usa `delegate_task`',
    );
    expect(text).toContain('`answer_question`');
    expect(text).toContain('`escalate_question` y la duda subirá a «Líder técnico»');
    expect(text).toContain('Revisa cada resumen');
    expect(compose('lider')).toContain('la duda subirá al usuario');
  });

  it('lista los subagentes disponibles y avisa a un subagente de quién lo invoca', () => {
    expect(compose('lider')).toContain('Puedes delegar en estos subagentes: «Revisor» (revisor).');
    expect(compose('revisor')).toContain('Eres subagente de «Líder técnico»');
  });

  it('a un subagente puro no le da herramientas de coordinación', () => {
    const text = compose('revisor');
    expect(text).not.toContain('Reportas directamente al usuario');
    expect(text).not.toContain('`report_done`');
    expect(text).toContain('indícalo en tu respuesta en lugar de decidirlo');
  });

  it('controla los pull requests según el permiso', () => {
    expect(compose('lider')).toContain('Abre pull requests solo después de revisar');
    expect(compose('e1')).toContain('No abras pull requests.');
  });

  it('produce un texto estable', () => {
    expect(compose('e1')).toMatchInlineSnapshot(`
      "# Tu rol

      Eres «Ejecutor 1» (ejecutor) en un equipo de 5 sesiones que trabajan en el mismo proyecto.

      Implementa la API.

      # Coordinación

      - Hay 4 sesiones más en este proyecto: «Líder técnico» (líder), «Consultor» (consultor), «Ejecutor 2» (ejecutor), «Revisor» (revisor). Usa \`list_peers\` para ver qué hace cada una.
      - Trabajas en tu propio worktree. No modifiques archivos fuera de él.
      - Reportas a «Consultor». Si tienes una duda de implementación, pregúntale con \`ask_parent\`. Si no está segura, la duda sube sola por la cadena: «Consultor» → «Líder técnico» → el usuario.
      - Las decisiones de diseño (qué construir, cómo se comporta para el usuario, cambios de arquitectura) no las decides tú ni tu cadena: pregúntalas directamente al usuario con \`ask_user\`.
      - Al terminar, llama a \`report_done\` con un resumen breve para «Consultor»: qué hiciste, archivos cambiados y riesgos.
      - No abras pull requests.
      "
    `);
  });
});
