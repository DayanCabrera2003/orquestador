/**
 * Herramientas que el Orquestador expone a cada sesión por MCP.
 * Las instrucciones compuestas y el servidor MCP usan estos mismos nombres.
 */
export const COORDINATION_TOOLS = {
  /** Pregunta a la sesión a la que reporta. Si no está segura, la pregunta sube por la cadena. */
  askParent: 'ask_parent',
  /** Pregunta directamente al usuario. Para decisiones de diseño. */
  askUser: 'ask_user',
  /** Asigna una tarea a una sesión que le reporta. La inicia si no está en marcha. */
  delegateTask: 'delegate_task',
  /** Responde una pregunta recibida de una sesión hija. */
  answerQuestion: 'answer_question',
  /** Sube una pregunta recibida al siguiente eslabón de la cadena. */
  escalateQuestion: 'escalate_question',
  /** Entrega el resumen final y marca la sesión como terminada. */
  reportDone: 'report_done',
  /** Lista las otras sesiones del flujo y su alcance. */
  listPeers: 'list_peers',
} as const;

export type CoordinationTool = (typeof COORDINATION_TOOLS)[keyof typeof COORDINATION_TOOLS];
