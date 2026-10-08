import { es, type Messages } from './es';

type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Paths<Messages>;

/** Devuelve el texto de `key` sustituyendo `{variable}` por su valor. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  let node: unknown = es;
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part];
  if (typeof node !== 'string') return key;
  return node.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Para textos cuya clave se calcula (por ejemplo, un código de error). */
export function tMaybe(
  key: string,
  fallback: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const text = t(key as MessageKey, vars);
  return text === key ? t(fallback, vars) : text;
}
