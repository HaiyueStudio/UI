import assert from 'node:assert/strict';
import { HY_COMPONENTS, HY_FEATURES, HYUIError } from '../../dist/core/index.js';

// Test double only: this is not a Web, NativeScript, or desktop implementation.
export class RecordingRenderer {
  capabilities = { contract: 1, backend: 'web', components: HY_COMPONENTS, features: HY_FEATURES };
  nodes = new Map(); batches = []; released = []; focused = []; lifecycle = [];
  revision = 0; sequence = 0; failAt = -1; setterFeedback = false; mounted = false; disposed = false;
  groups = new Map();
  mount(emit) { assert.equal(this.mounted, false); this.mounted = true; this.emit = emit; this.lifecycle.push('mount'); }
  group(parent, slot) { return JSON.stringify([parent, slot ?? null]); }
  detach(key) { for (const list of this.groups.values()) { const i = list.indexOf(key); if (i !== -1) list.splice(i, 1); } }
  release(key) {
    for (const [id, node] of this.nodes) if (node.parent === key) this.release(id);
    const node = this.nodes.get(key); assert.ok(node, `double release ${key}`);
    this.released.push(node.instance); this.detach(key); this.nodes.delete(key);
  }
  commit(revision, mutations) {
    assert.ok(this.mounted && !this.disposed); assert.ok(revision > this.revision);
    this.batches.push({ revision, mutations });
    for (const [index, m] of mutations.entries()) {
      try {
        if (index === this.failAt) throw new Error('injected platform setter failure');
        if (m.type === 'create') {
          assert.equal(this.nodes.has(m.node.key), false); assert.equal(m.node.children, undefined); assert.equal(m.node.slots, undefined);
          this.nodes.set(m.node.key, { instance: ++this.sequence, node: m.node, parent: undefined, slot: undefined });
        } else if (m.type === 'update') {
          const node = this.nodes.get(m.node.key); assert.equal(node.node.kind, m.node.kind); node.node = m.node;
          if (this.setterFeedback) this.emit({ key: m.node.key, type: 'commit', reason: 'pointer', transaction: revision, value: 'setter-echo' });
        } else if (m.type === 'remove') this.release(m.key);
        else {
          const node = this.nodes.get(m.key); assert.ok(node);
          assert.ok(m.parent === null || this.nodes.has(m.parent));
          if (m.type === 'insert') assert.equal(node.parent, undefined); else assert.notEqual(node.parent, undefined);
          this.detach(m.key); node.parent = m.parent; node.slot = m.slot;
          const id = this.group(m.parent, m.slot);
          if (!this.groups.has(id)) this.groups.set(id, []);
          const list = this.groups.get(id), at = m.before === null ? list.length : list.indexOf(m.before);
          assert.ok(at >= 0); list.splice(at, 0, m.key);
        }
      } catch (cause) { throw new HYUIError('renderer', cause.message, { key: m.key ?? m.node.key, operation: m.type, revision }, cause); }
    }
    this.revision = revision;
  }
  focus(key) { assert.ok(this.nodes.has(key)); this.focused.push(key); }
  suspend() { this.lifecycle.push('suspend'); }
  resume() { this.lifecycle.push('resume'); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.lifecycle.push('dispose');
    while (this.nodes.size) this.release(this.nodes.keys().next().value);
  }
  props(key) { return this.nodes.get(key)?.node.props; }
  order(parent, slot) { return this.groups.get(this.group(parent, slot)) ?? []; }
}

// Application-owned store fixture. UI does not publish or own an application store.
export function store(initial) {
  let state = Object.freeze(initial), depth = 0;
  const subscriptions = new Set(); let disposed = 0;
  const notify = () => {
    for (const item of [...subscriptions]) {
      const value = item.select(state);
      if (!item.equal(item.value, value)) { item.value = value; item.notify(value); }
    }
  };
  return {
    getSnapshot: () => state,
    dispatch: patch => { state = Object.freeze({ ...state, ...patch }); if (!depth) notify(); },
    subscribe(select, notify, equal = Object.is) {
      const item = { select, notify, equal, value: select(state) }; subscriptions.add(item);
      return () => subscriptions.delete(item);
    },
    transaction(run) { depth++; try { run(); } finally { if (!--depth) notify(); } },
    dispose() { disposed++; subscriptions.clear(); },
    get subscriptionCount() { return subscriptions.size; }, get disposed() { return disposed; },
  };
}
