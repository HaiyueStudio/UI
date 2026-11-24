/** Missing and empty attributes use their default; an explicit zero remains a value. */
export function finiteNumber(value: unknown, fallback: number): number {
  if (value == null || typeof value === 'string' && !value.trim()) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
