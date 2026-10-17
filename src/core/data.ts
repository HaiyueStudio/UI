/** Internal structural comparison for immutable protocol data; never serializes props. */
export function equalData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && equalData(left[key], right[key]));
}

/** Called only after schema validation, so cycles and platform handles are impossible. */
export function snapshot<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(snapshot)) as T;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item)]))) as T;
}
