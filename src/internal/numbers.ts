/** Missing and empty attributes use their default; an explicit zero remains a value. */
export function finiteNumber(value: unknown, fallback: number): number {
  if (value == null || typeof value === 'string' && !value.trim()) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Numeric milliseconds or CSS time tokens, bounded for interactive motion settings. */
export function boundedMilliseconds(value: unknown, fallback: number): number {
  const match = typeof value === 'string' ? /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(ms|s)$/iu.exec(value.trim()) : null;
  const parsed = match ? Number(match[1]) * (match[2]!.toLowerCase() === 's' ? 1000 : 1) : finiteNumber(value, fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10000, parsed)) : fallback;
}
