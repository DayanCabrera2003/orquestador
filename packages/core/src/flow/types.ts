import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = 1;

export const ModelTierSchema = z.enum(['opus', 'sonnet', 'haiku']);
export type ModelTier = z.infer<typeof ModelTierSchema>;

export const RoleSchema = z.enum([
  'lider',
  'consultor',
  'ejecutor',
  'revisor',
  'qa',
  'personalizado',
]);
export type Role = z.infer<typeof RoleSchema>;

/** Estado en ejecución de una sesión. No forma parte de la definición del flujo. */
export const SessionStatusSchema = z.enum([
  'idle',
  'thinking',
  'waiting',
  'blocked',
  'done',
  'paused',
  'error',
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const PermissionsSchema = z.object({
  editFiles: z.boolean(),
  runCommands: z.boolean(),
  openPullRequests: z.boolean(),
  startInPlanMode: z.boolean(),
});
export type Permissions = z.infer<typeof PermissionsSchema>;

const IdSchema = z.string().min(1);

export const SessionNodeSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1),
  model: ModelTierSchema,
  role: RoleSchema,
  instructions: z.string(),
  permissions: PermissionsSchema,
  budgetUsd: z.number().nonnegative(),
  position: z.object({ x: z.number(), y: z.number() }),
  /** Sesión a la que reporta. `null` significa que reporta al usuario. */
  reportsTo: IdSchema.nullable(),
  /** Sesiones que puede invocar como subagentes. */
  subagents: z.array(IdSchema),
});
export type SessionNode = z.infer<typeof SessionNodeSchema>;

export const FlowSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: IdSchema,
  name: z.string().trim().min(1),
  budgetUsd: z.number().nonnegative(),
  sessions: z.array(SessionNodeSchema),
});
export type Flow = z.infer<typeof FlowSchema>;
