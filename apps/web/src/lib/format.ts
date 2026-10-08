export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Dólares con dos decimales; con tres si es menos de un dólar y no es cero, para que se note el gasto de modelos baratos. */
export function formatUsd(n: number): string {
  return `$${n > 0 && n < 1 ? n.toFixed(3) : n.toFixed(2)}`;
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}
