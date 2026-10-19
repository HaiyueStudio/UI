import type { HYMutation, HYNode } from '../core/types.js';
import { hyKey } from '../core/validation.js';
import { equalData } from '../core/data.js';

export interface Entry { readonly node: HYNode; readonly parent: string | null; readonly slot?: string; }
export type Tree = ReadonlyMap<string, Entry>;
export function flatten(root: HYNode): Tree {
  const entries = new Map<string, Entry>();
  const walk = (node: HYNode, path: readonly string[], parent: string | null, slot?: string): void => {
    const nextPath = [...path, node.key], key = hyKey(...nextPath);
    const { children, slots, ...shallow } = node;
    entries.set(key, { node: Object.freeze({ ...shallow, key }), parent, ...(slot === undefined ? {} : { slot }) });
    for (const child of children ?? []) walk(child, nextPath, key);
    for (const [name, list] of Object.entries(slots ?? {})) for (const child of list) walk(child, nextPath, key, name);
  };
  walk(root, [], null); return entries;
}
function group(entry: Entry): string { return JSON.stringify([entry.parent, entry.slot ?? null]); }
function groups(tree: Tree): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [key, entry] of tree) { const id = group(entry); if (!result.has(id)) result.set(id, []); result.get(id)!.push(key); }
  return result;
}
/** Returns a deterministic batch. Removing an ancestor releases descendants exactly once. */
export function diff(previous: Tree, next: Tree): readonly HYMutation[] {
  // Bound props preserve topology. Avoid building/serializing sibling groups
  // for these updates; keep the general reconciler for insert/move/remove.
  if (previous.size === next.size) {
    const entries = previous.entries(), updates: HYMutation[] = [];
    let sameStructure = true;
    for (const [key, entry] of next) {
      const [oldKey, old] = entries.next().value!;
      if (oldKey !== key || old.parent !== entry.parent || old.slot !== entry.slot || old.node.kind !== entry.node.kind) { sameStructure = false; break; }
      if (old !== entry && !equalData(old.node.props, entry.node.props)) updates.push(Object.freeze({ type: 'update', node: entry.node }));
    }
    if (sameStructure) return Object.freeze(updates);
  }
  const mutations: HYMutation[] = [];
  const removed = new Set<string>();
  for (const [key, old] of previous) {
    if ((old.parent !== null && removed.has(old.parent)) || !next.has(key) || next.get(key)!.node.kind !== old.node.kind) removed.add(key);
  }
  for (const [key, old] of previous) if (removed.has(key) && (old.parent === null || !removed.has(old.parent))) mutations.push({ type: 'remove', key });
  const created = new Set<string>();
  for (const [key, entry] of next) {
    const old = previous.get(key);
    if (!old || removed.has(key)) { created.add(key); mutations.push({ type: 'create', node: entry.node }); }
    else if (!equalData(old.node.props, entry.node.props)) mutations.push({ type: 'update', node: entry.node });
  }
  const oldGroups = groups(new Map([...previous].filter(([key]) => !removed.has(key))));
  // Drop cross-slot entries from their old location before placing them in their new group.
  for (const list of oldGroups.values()) for (let i = list.length - 1; i >= 0; i--) {
    const key = list[i]!;
    if (next.has(key) && group(previous.get(key)!) !== group(next.get(key)!)) list.splice(i, 1);
  }
  for (const [id, ordered] of groups(next)) {
    const current = oldGroups.get(id) ?? [];
    // The common props-only path never searches sibling positions.
    if (current.length === ordered.length && current.every((key, index) => key === ordered[index])) continue;
    let before: string | null = null;
    for (let i = ordered.length - 1; i >= 0; i--) {
      const key = ordered[i]!, entry = next.get(key)!;
      const at = current.indexOf(key), successor = at < 0 ? undefined : (current[at + 1] ?? null);
      if (at < 0 || successor !== before) {
        mutations.push({ type: created.has(key) ? 'insert' : 'move', key, parent: entry.parent, before,
          ...(entry.slot === undefined ? {} : { slot: entry.slot }) });
        if (at >= 0) current.splice(at, 1);
        current.splice(before === null ? current.length : current.indexOf(before), 0, key);
      }
      before = key;
    }
  }
  return Object.freeze(mutations.map(mutation => Object.freeze(mutation)));
}
