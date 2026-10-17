import type { HYDispose, HYReason, HYSelectionEvent, HYSelectionProps, HYSelectionView } from './types.js';
import { equalData, snapshot } from './data.js';
import { HYUIError, hyKey, hyValidateProps } from './validation.js';

/** Controlled Select/Tabs semantics. Views report user actions, never delayed setter echoes. */
export class HYSelectionController {
  #props!: HYSelectionProps;
  #view: HYSelectionView | undefined;
  #off: HYDispose | undefined;
  #applying = false; #disposed = false; #choosing = false;
  #generation = 0; #transaction = 0;
  #lastApplied: HYSelectionProps | undefined;
  constructor(readonly key: string, props: HYSelectionProps, private readonly emit: (event: HYSelectionEvent) => void) {
    hyKey(key);
    this.update(props);
  }
  update(props: HYSelectionProps): void {
    if (this.#disposed) return;
    hyValidateProps('Select', props, { key: this.key });
    if (equalData(props, this.#props)) return;
    this.#props = snapshot(props); this.#generation++; this.#apply();
  }
  #apply(): void {
    if (!this.#view || this.#disposed || equalData(this.#lastApplied, this.#props)) return;
    this.#applying = true;
    try { this.#view.apply(this.#props); this.#lastApplied = this.#props; } finally { this.#applying = false; }
  }
  attach(view: HYSelectionView): void {
    if (this.#disposed || this.#view) throw new HYUIError('lifecycle', 'Selection disposed or already attached', { key: this.key });
    this.#view = view;
    this.#off = view.listen((value, reason = 'pointer') => this.choose(value, reason));
    this.#apply();
  }
  choose(value: string, reason: HYReason = 'pointer'): boolean {
    if (this.#disposed || this.#applying || this.#choosing || this.#props.disabled) return false;
    const option = this.#props.options.find(item => item.value === value);
    if (!option || option.disabled || value === this.#props.value) return false;
    this.#lastApplied = undefined; this.#choosing = true;
    const transaction = ++this.#transaction;
    try {
      this.emit({ type: 'valueChange', key: this.key, value, reason, transaction });
      if (this.#disposed) return false;
      this.emit({ type: 'commit', key: this.key, value, reason, transaction });
      return true;
    } finally { this.#choosing = false; this.#apply(); }
  }
  async pick(open: () => Promise<string | null>, reason: HYReason = 'pointer'): Promise<boolean> {
    if (this.#disposed || this.#props.disabled) return false;
    const generation = ++this.#generation;
    const value = await open();
    if (this.#disposed || generation !== this.#generation || value === null) return false;
    return this.choose(value, reason);
  }
  cancel(): void { this.#generation++; }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true; this.cancel();
    const off = this.#off; this.#off = undefined; this.#view = undefined; off?.();
  }
}
