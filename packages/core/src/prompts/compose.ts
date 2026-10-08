import { COORDINATION_TOOLS as T } from '../coordination/tools';
import { childrenOf, escalationChain, findSession, subagentOwnersOf } from '../flow/graph';
import type { Flow, Role, SessionNode } from '../flow/types';
import { err, ok, type Result } from '../result';

const ROLE_LABELS: Record<Role, string> = {
  lider: 'líder',
  consultor: 'consultor',
  ejecutor: 'ejecutor',
  revisor: 'revisor',
  qa: 'QA',
  personalizado: 'personalizado',
};

const quote = (s: SessionNode): string => `«${s.name}»`;
const withRole = (s: SessionNode): string => `${quote(s)} (${ROLE_LABELS[s.role]})`;
const list = (sessions: SessionNode[], format: (s: SessionNode) => string): string =>
  sessions.map(format).join(', ');

/**
 * Compone las instrucciones completas de una sesión: su rol, sus instrucciones propias y las
 * reglas de coordinación que se derivan de su posición en el grafo.
 */
export function composeInstructions(
  flow: Flow,
  sessionId: string,
): Result<string, { code: 'unknown-session'; id: string }> {
  const session = findSession(flow, sessionId);
  if (!session) return err({ code: 'unknown-session', id: sessionId });

  const peers = flow.sessions.filter((s) => s.id !== session.id);
  const chain = escalationChain(flow, session.id);
  const parent = chain[0];
  const children = childrenOf(flow, session.id);
  const owners = subagentOwnersOf(flow, session.id);
  const subagents = session.subagents
    .map((id) => findSession(flow, id))
    .filter((s): s is SessionNode => s !== undefined);
  const isPureSubagent = !parent && owners.length > 0;

  const rules: string[] = [];

  if (peers.length > 0) {
    rules.push(
      `Hay ${String(peers.length)} sesiones más en este proyecto: ${list(peers, withRole)}.` +
        (isPureSubagent ? '' : ` Usa \`${T.listPeers}\` para ver qué hace cada una.`),
    );
  }

  rules.push(
    session.permissions.editFiles
      ? 'Trabajas en tu propio worktree. No modifiques archivos fuera de él.'
      : 'No modificas archivos: solo lees, investigas y respondes.',
  );

  if (isPureSubagent) {
    rules.push(
      `Eres subagente de ${list(owners, quote)}: cuando te invoque, céntrate en lo que pide y responde con el resultado.`,
      'Si algo requiere una decisión de diseño, indícalo en tu respuesta en lugar de decidirlo.',
    );
  } else {
    if (parent) {
      const route = [...chain.map(quote), 'el usuario'].join(' → ');
      rules.push(
        `Reportas a ${quote(parent)}. Si tienes una duda de implementación, pregúntale con \`${T.askParent}\`. ` +
          `Si no está segura, la duda sube sola por la cadena: ${route}.`,
      );
    } else {
      rules.push(`Reportas directamente al usuario. Para dudas, usa \`${T.askUser}\`.`);
    }

    rules.push(
      'Las decisiones de diseño (qué construir, cómo se comporta para el usuario, cambios de arquitectura) ' +
        `no las decides tú ni tu cadena: pregúntalas directamente al usuario con \`${T.askUser}\`.`,
    );

    if (children.length > 0) {
      const next = parent ? quote(parent) : 'al usuario';
      rules.push(
        `Te reportan: ${list(children, quote)}. Cuando te pregunten, responde con \`${T.answerQuestion}\` solo si estás segura; ` +
          `si no, usa \`${T.escalateQuestion}\` y la duda subirá ${parent ? `a ${next}` : next}.`,
        'Revisa cada resumen que recibas. Si algo está mal o incompleto, devuélvelo con correcciones concretas antes de darlo por bueno.',
      );
    }

    if (owners.length > 0) {
      rules.push(
        `También eres subagente de ${list(owners, quote)} y puede invocarte directamente.`,
      );
    }

    rules.push(
      parent
        ? `Al terminar, llama a \`${T.reportDone}\` con un resumen breve para ${quote(parent)}: qué hiciste, archivos cambiados y riesgos.`
        : `Al terminar, llama a \`${T.reportDone}\` con un resumen para el usuario: qué se hizo, qué queda pendiente y riesgos.`,
    );
  }

  if (subagents.length > 0) {
    rules.push(`Puedes delegar en estos subagentes: ${list(subagents, withRole)}.`);
  }

  if (!isPureSubagent) {
    rules.push(
      session.permissions.openPullRequests
        ? children.length > 0
          ? 'Abre pull requests solo después de revisar y aceptar los resúmenes de quienes te reportan.'
          : 'Puedes abrir pull requests cuando tu trabajo esté terminado y verificado.'
        : 'No abras pull requests.',
    );
  }

  const header = `Eres ${quote(session)} (${ROLE_LABELS[session.role]}) en un equipo de ${String(flow.sessions.length)} sesiones que trabajan en el mismo proyecto.`;
  const own = session.instructions.trim();

  return ok(
    [
      '# Tu rol',
      '',
      header,
      ...(own ? ['', own] : []),
      '',
      '# Coordinación',
      '',
      ...rules.map((r) => `- ${r}`),
      '',
    ].join('\n'),
  );
}
