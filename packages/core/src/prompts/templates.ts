import type { ModelTier, Permissions, Role } from '../flow/types';

export interface RoleTemplate {
  model: ModelTier;
  defaultName: string;
  instructions: string;
  permissions: Permissions;
}

const readOnly: Permissions = {
  editFiles: false,
  runCommands: true,
  openPullRequests: false,
  startInPlanMode: false,
};

export const ROLE_TEMPLATES: Record<Role, RoleTemplate> = {
  lider: {
    model: 'opus',
    defaultName: 'Líder técnico',
    instructions:
      'Eres el líder técnico. Planificas, divides el trabajo en tareas pequeñas y aisladas, ' +
      'y revisas cada resumen antes de abrir un PR. Si algo salió mal, lo devuelves con ' +
      'correcciones concretas.',
    permissions: {
      editFiles: false,
      runCommands: true,
      openPullRequests: true,
      startInPlanMode: true,
    },
  },
  consultor: {
    model: 'sonnet',
    defaultName: 'Consultor',
    instructions:
      'Resuelves dudas de implementación de las sesiones que te reportan. Respondes con la ' +
      'solución concreta y el archivo donde aplica.',
    permissions: readOnly,
  },
  ejecutor: {
    model: 'haiku',
    defaultName: 'Ejecutor',
    instructions:
      'Implementas solo la tarea que te asignaron. Respetas la arquitectura existente y no ' +
      'tocas nada fuera de tu alcance.',
    permissions: {
      editFiles: true,
      runCommands: true,
      openPullRequests: false,
      startInPlanMode: false,
    },
  },
  revisor: {
    model: 'sonnet',
    defaultName: 'Revisor',
    instructions:
      'Revisas cambios buscando errores, problemas de seguridad y violaciones de la ' +
      'arquitectura. Respondes con hallazgos concretos: archivo, línea y cómo corregirlo.',
    permissions: readOnly,
  },
  qa: {
    model: 'haiku',
    defaultName: 'QA',
    instructions:
      'Ejecutas las pruebas y verificas el comportamiento. Reportas cada fallo con los ' +
      'pasos para reproducirlo.',
    permissions: {
      editFiles: true,
      runCommands: true,
      openPullRequests: false,
      startInPlanMode: false,
    },
  },
  personalizado: {
    model: 'sonnet',
    defaultName: 'Sesión',
    instructions: '',
    permissions: {
      editFiles: true,
      runCommands: true,
      openPullRequests: false,
      startInPlanMode: false,
    },
  },
};
