import type { HYCapabilities, HYComponentKind, HYComponentProps, HYDispose, HYMutation, HYNode, HYReason, HYRenderer, HYStore, HYUIEvent } from '../core/types.js';
import { HYUIError, hyValidateCapabilities, hyValidateNode, hyValidateProps, snapshotValidatedProps } from '../core/validation.js';
import { equalData, snapshot } from '../core/data.js';
import { diff, flatten, type Tree } from './tree.js';

export type HYPageStatus = 'new' | 'mounted' | 'suspended' | 'faulted' | 'disposed';
export interface HYPageOptions {
  readonly onEvent?: (event: HYUIEvent) => void;
  /** Scoped key from hyKey(). If unavailable the root receives focus. */
  readonly defaultFocus?: string;
}
export type HYBinding<S> = { [K in HYComponentKind]: {
  readonly key: string; readonly kind: K;
  readonly select: (state: Readonly<S>) => Readonly<HYComponentProps[K]>;
  readonly equal?: (a: Readonly<HYComponentProps[K]>, b: Readonly<HYComponentProps[K]>) => boolean;
} }[HYComponentKind];
type Props = HYComponentProps[HYComponentKind];
const interactive = new Set<HYComponentKind>(['Button','Toggle','Select','Tabs','TextInput','TextArea','Slider','PlatformView']);

/** A synchronous, bounded page reconciler. It owns bindings/rendering, never the application store. */
export class HYPage {
  #renderer: HYRenderer; #capabilities: HYCapabilities;
  #status: HYPageStatus = 'new'; #revision = 0; #epoch = 0; #depth = 0; #committing = false;
  #desired: Tree = new Map(); #rendered: Tree = new Map();
  // Undefined means topology may have changed; otherwise only these props
  // need comparison. Keep tree order deterministic across grouped updates.
  #updates: Set<string> | undefined;
  #order = new Map<string, number>();
  #subscriptions = new Set<HYDispose>(); #focused: string | undefined;
  #boundStores = new Set<unknown>();
  #openers = new Map<string, string | undefined>(); #cancelTransaction = 0;
  constructor(renderer: HYRenderer, private readonly options: HYPageOptions = {}) {
    hyValidateCapabilities(renderer.capabilities);
    this.#renderer = renderer; this.#capabilities = snapshot(renderer.capabilities);
  }
  get status(): HYPageStatus { return this.#status; }
  get revision(): number { return this.#revision; }
  get capabilities(): HYCapabilities { return this.#capabilities; }
  #assertMutable(): void {
    if (this.#status === 'disposed' || this.#committing) throw new HYUIError('lifecycle', 'Page disposed or inside renderer commit');
  }
  mount(root: HYNode): void {
    if (this.#status !== 'new') throw new HYUIError('lifecycle', 'Page may only mount once');
    this.#desired = flatten(hyValidateNode(root, this.#capabilities));
    this.#mountRenderer(); this.#flush();
  }
  #mountRenderer(): void {
    const epoch = ++this.#epoch;
    this.#committing = true;
    try { this.#renderer.mount(event => { if (epoch === this.#epoch) this.#event(event); }); this.#status = 'mounted'; }
    catch (cause) { this.#fault(cause, 'mount'); }
    finally { this.#committing = false; }
  }
  render(root: HYNode): void {
    this.#assertMutable();
    if (this.#status === 'new') throw new HYUIError('lifecycle', 'Mount the page before render');
    this.#desired = flatten(hyValidateNode(root, this.#capabilities)); this.#updates = undefined; this.#flush();
  }
  setProps<K extends HYComponentKind>(key: string, kind: K, props: HYComponentProps[K]): void {
    this.#assertMutable();
    const entry = this.#desired.get(key);
    if (!entry || entry.node.kind !== kind) throw new HYUIError('invalid-props', 'Binding target missing or kind changed', { key });
    const context = { key, ...(entry.node.source ? { source: entry.node.source } : {}) };
    const accepted = snapshotValidatedProps(kind, props, context, this.#capabilities);
    if (equalData(entry.node.props, props)) return;
    const next = new Map(this.#desired);
    next.set(key, { ...entry, node: Object.freeze({ ...entry.node, props: accepted }) as HYNode });
    this.#desired = next; this.#updates?.add(key); this.#flush();
  }
  transaction(run: () => void): void {
    this.#assertMutable();
    const before = this.#desired, updates = this.#updates && new Set(this.#updates); this.#depth++;
    try {
      const result: unknown = run();
      if (result && typeof (result as { then?: unknown }).then === 'function') throw new HYUIError('lifecycle', 'Page transactions must be synchronous');
    } catch (cause) { this.#desired = before; this.#updates = updates; throw cause; }
    finally { this.#depth--; }
    this.#flush();
  }
  /** One store subscription: a store transaction produces one final page batch across all bindings. */
  bind<S, A>(store: HYStore<S, A>, bindings: readonly HYBinding<S>[]): HYDispose {
    this.#assertMutable();
    if (this.#boundStores.has(store)) throw new HYUIError('lifecycle', 'Group all bindings for one store in a single bind call');
    const definitions = [...bindings];
    if (new Set(definitions.map(b => b.key)).size !== definitions.length) throw new HYUIError('duplicate-key', 'Duplicate binding target');
    const select = (state: Readonly<S>): readonly Props[] => definitions.map(b => b.select(state));
    const equal = (a: readonly Props[], b: readonly Props[]): boolean => a.every((p, i) =>
      (definitions[i]!.equal as ((a: Props, b: Props) => boolean) | undefined ?? equalData)(p, b[i]!));
    let applied: (HYNode | undefined)[] = [];
    const apply = (props: readonly Props[]): void => {
      if (this.#status === 'disposed') return;
      this.transaction(() => definitions.forEach((binding, i) => {
        const node = this.#desired.get(binding.key)?.node;
        // A grouped subscription does not make every binding dirty. Reuse a
        // previously validated result only while its target is still unchanged.
        // External render/setProps and failed transactions invalidate this path.
        if (node === applied[i] && node && equalData(node.props, props[i])) return;
        this.setProps(binding.key, binding.kind, props[i]!);
      }));
      applied = definitions.map(binding => this.#desired.get(binding.key)?.node);
    };
    apply(select(store.getSnapshot()));
    let live = true;
    const unsubscribe = store.subscribe(select, values => { if (live) apply(values); }, equal);
    const dispose = (): void => { if (!live) return; live = false; this.#subscriptions.delete(dispose); this.#boundStores.delete(store); unsubscribe(); };
    this.#boundStores.add(store);
    this.#subscriptions.add(dispose);
    // Also captures synchronous changes caused by mount/update hooks before subscription began.
    try { apply(select(store.getSnapshot())); } catch (cause) { dispose(); throw cause; }
    return dispose;
  }
  #fault(cause: unknown, operation: string, key?: string): never {
    this.#status = 'faulted';
    const context = cause instanceof HYUIError ? cause.context : {};
    throw new HYUIError('renderer', 'Renderer failed; rebuild required', {
      key: key ?? this.#desired.keys().next().value ?? '<root>', operation, ...context,
      revision: operation === 'commit' || operation === 'mount' ? this.#revision + 1 : this.#revision,
    }, cause);
  }
  #flush(): void {
    if (this.#depth || this.#status !== 'mounted' || this.#committing) return;
    const next = this.#desired, previous = this.#rendered;
    if (next === previous) return;
    const topology = this.#updates === undefined;
    const mutations: readonly HYMutation[] = topology ? diff(previous, next)
      : Object.freeze([...this.#updates!].sort((a,b) => this.#order.get(a)! - this.#order.get(b)!).flatMap(key => {
        const node = next.get(key)!.node;
        return equalData(previous.get(key)!.node.props, node.props) ? [] : [Object.freeze({type:'update' as const,node})];
      }));
    const focusChanged = topology || mutations.some(m => {
      if (m.type !== 'update') return true;
      const a = previous.get(m.node.key)!.node.props, b = m.node.props;
      return a.visible !== b.visible || ('disabled' in a && a.disabled) !== ('disabled' in b && b.disabled)
        || ('busy' in a && a.busy) !== ('busy' in b && b.busy)
        || (m.node.kind === 'Dialog' && ('open' in a && a.open) !== m.node.props.open)
        || (m.node.kind === 'Tabs' && ('value' in a && a.value) !== m.node.props.value);
    });
    if (!mutations.length) { this.#rendered = next; this.#updates = new Set(); return; }
    this.#committing = true;
    try { this.#renderer.commit(this.#revision + 1, mutations); }
    catch (cause) { this.#fault(cause, 'commit'); }
    finally { this.#committing = false; }
    this.#rendered = next; this.#revision++;
    this.#updates = new Set();
    if (topology) this.#order = new Map([...next.keys()].map((key,index) => [key,index]));
    if (focusChanged) this.#restoreFocus(previous);
  }
  #available(key: string | undefined, tree = this.#rendered): boolean {
    if (!key) return false;
    let entry = tree.get(key);
    if (!entry) return false;
    while (entry) {
      const p = entry.node.props;
      if (p.visible === false || ('disabled' in p && p.disabled) || ('busy' in p && p.busy) || (entry.node.kind === 'Dialog' && !entry.node.props.open)) return false;
      const parent: typeof entry | undefined = entry.parent === null ? undefined : tree.get(entry.parent);
      if (parent?.node.kind === 'Tabs' && entry.slot !== parent.node.props.value) return false;
      entry = parent;
    }
    return true;
  }
  #dialogs(tree: Tree): string[] {
    return [...tree].filter(([key, entry]) => entry.node.kind === 'Dialog' && entry.node.props.open && this.#available(key, tree)).map(([key]) => key);
  }
  #inside(key: string, parent: string): boolean { return key === parent || key.startsWith(`${parent}/`); }
  #dialogTarget(key: string): string {
    return [...this.#rendered].find(([id, entry]) => this.#inside(id, key) && interactive.has(entry.node.kind) && this.#available(id))?.[0] ?? key;
  }
  #restoreFocus(previous: Tree): void {
    const oldDialogs = this.#dialogs(previous), dialogs = this.#dialogs(this.#rendered);
    const newDialogs = dialogs.filter(key => !oldDialogs.includes(key));
    for (const key of newDialogs) this.#openers.set(key, this.#focused);
    const top = dialogs.at(-1);
    const closed = oldDialogs.filter(key => !dialogs.includes(key));
    if (newDialogs.length || (top && (!this.#focused || !this.#inside(this.#focused, top)))) this.focus(this.#dialogTarget(top!));
    else if (this.#focused && !this.#available(this.#focused)) {
      const opener = closed.slice().reverse().map(key => this.#openers.get(key)).find(key => this.#available(key));
      const target = top ? this.#dialogTarget(top) : opener ?? (this.#available(this.options.defaultFocus) ? this.options.defaultFocus : this.#rendered.keys().next().value);
      if (target) this.focus(target); else this.#focused = undefined;
    }
    for (const key of closed) this.#openers.delete(key);
  }
  focus(key: string): boolean {
    if (this.#status !== 'mounted' || this.#committing || !this.#available(key)) return false;
    const top = this.#dialogs(this.#rendered).at(-1);
    if (top && !this.#inside(key, top)) return false;
    this.#committing = true;
    try { this.#renderer.focus(key); this.#focused = key; }
    catch (cause) { this.#fault(cause, 'focus', key); }
    finally { this.#committing = false; }
    return true;
  }
  #event(event: HYUIEvent): void {
    if (this.#committing || this.#status !== 'mounted' || !this.#available(event.key)) return;
    const top = this.#dialogs(this.#rendered).at(-1);
    if (top && !this.#inside(event.key, top)) return;
    if (event.type === 'focus') this.#focused = event.key;
    this.options.onEvent?.(Object.freeze({ ...event }));
  }
  /** The shell chooses this single system-back owner. A modal consumes even a non-dismissible back. */
  back(reason: HYReason = 'keyboard'): boolean {
    if (this.#status !== 'mounted' || this.#committing) return false;
    const key = this.#dialogs(this.#rendered).at(-1);
    if (!key) return false;
    const node = this.#rendered.get(key)!.node;
    if (node.kind === 'Dialog' && node.props.dismissible !== false) this.#event({ key, type: 'cancel', reason, transaction: ++this.#cancelTransaction });
    return true;
  }
  suspend(): void {
    if (this.#status !== 'mounted' || this.#committing) return;
    this.#status = 'suspended';
    try { this.#renderer.suspend(); } catch (cause) { this.#fault(cause, 'suspend'); }
  }
  resume(): void {
    if (this.#status !== 'suspended') return;
    try { this.#renderer.resume(); } catch (cause) { this.#fault(cause, 'resume'); }
    this.#status = 'mounted'; this.#flush();
  }
  /** Replaces the failed backend, preserving latest requested data and existing store bindings. */
  rebuild(renderer: HYRenderer): void {
    if (this.#status !== 'faulted') throw new HYUIError('lifecycle', 'Only a faulted page may rebuild');
    if (renderer === this.#renderer) throw new HYUIError('lifecycle', 'Rebuild needs a fresh renderer');
    hyValidateCapabilities(renderer.capabilities);
    for (const [key, entry] of this.#desired) {
      hyValidateProps(entry.node.kind, entry.node.props, { key }, renderer.capabilities);
      for (const feature of entry.node.requires ?? []) if (!renderer.capabilities.features.includes(feature)) throw new HYUIError('capability', `Missing capability ${feature}`, { key });
    }
    ++this.#epoch;
    this.#renderer.dispose();
    this.#renderer = renderer; this.#capabilities = snapshot(renderer.capabilities);
    this.#rendered = new Map(); this.#updates = undefined; this.#order.clear(); this.#focused = undefined; this.#openers.clear();
    this.#mountRenderer(); this.#flush();
  }
  dispose(): void {
    if (this.#status === 'disposed') return;
    this.#status = 'disposed'; ++this.#epoch;
    const errors: unknown[] = [];
    for (const unsubscribe of this.#subscriptions) try { unsubscribe(); } catch (cause) { errors.push(cause); }
    this.#subscriptions.clear();
    try { this.#renderer.dispose(); } catch (cause) { errors.push(cause); }
    this.#updates = undefined; this.#order.clear();
    this.#desired = new Map(); this.#rendered = new Map(); this.#openers.clear(); this.#focused = undefined;
    if (errors.length) throw new AggregateError(errors, 'Page cleanup failed');
  }
}
