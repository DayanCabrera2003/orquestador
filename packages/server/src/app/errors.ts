export type AppErrorCode =
  'not-found' | 'invalid' | 'conflict' | 'not-a-repository' | 'unauthorized' | 'forbidden';

const STATUS: Record<AppErrorCode, number> = {
  'not-found': 404,
  invalid: 400,
  conflict: 409,
  'not-a-repository': 422,
  unauthorized: 401,
  forbidden: 403,
};

/** Error de dominio con código estable. La UI traduce el código; `message` es para logs. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = STATUS[code];
  }
}
