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

/** Only internally copied, deeply frozen data may bypass later descriptor checks. */
const snapshots = new WeakSet<object>();
export function isSnapshot(value: object): boolean { return snapshots.has(value); }
export function snapshot<T>(value: T, reject: (message: string, property: string) => never = message => { throw new TypeError(message); }): T {
  const ancestors = new Set<object>();
  const copies = new WeakMap<object, object>();
  const copy = (value: unknown, path: string): unknown => {
    if (!value || typeof value !== 'object') return value;
    if (snapshots.has(value)) return value;
    if (ancestors.has(value)) return reject('Cyclic protocol data', path);
    const existing = copies.get(value); if (existing) return existing;
    const array = Array.isArray(value);
    if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return reject('Expected plain data object', path);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = array ? descriptors.length!.value as number : 0;
    const keys = Reflect.ownKeys(descriptors);
    if (array && keys.length !== length + 1) return reject('Expected dense array without extra properties', path);
    const result: Record<string, unknown> | unknown[] = array ? [] : {};
    ancestors.add(value);
    for (const key of keys) {
      if (array && key === 'length') continue;
      const property = path ? `${path}.${String(key)}` : String(key);
      if (typeof key !== 'string') return reject('Symbols are not protocol data', property);
      const descriptor = descriptors[key]!;
      if (!descriptor.enumerable || !('value' in descriptor)) return reject('Accessors or non-enumerable properties are not protocol data', property);
      if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) return reject('Expected dense array index', property);
      Object.defineProperty(result, key, { value: copy(descriptor.value, property), enumerable: true, writable: true, configurable: true });
    }
    ancestors.delete(value); Object.freeze(result); snapshots.add(result); copies.set(value, result); return result;
  };
  return copy(value, '') as T;
}
