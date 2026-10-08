/** Convierte un nombre en un fragmento seguro para ramas y carpetas. */
export function slug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'sesion'
  );
}

/** Resume la entrada de una herramienta para mostrar qué está haciendo la sesión. */
export function describeToolUse(name: string, input: Record<string, unknown>): string {
  const pick = (key: string): string | undefined => {
    const v = input[key];
    return typeof v === 'string' ? v : undefined;
  };
  const detail =
    pick('file_path') ??
    pick('path') ??
    pick('command') ??
    pick('pattern') ??
    pick('description') ??
    pick('url');
  const short = name.replace(/^mcp__\w+__/, '');
  const text = detail ? `${short}: ${detail}` : short;
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}
