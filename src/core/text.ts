import type { HYReason, HYTextProps, HYUIEvent } from './types.js';
import { equalData, snapshot } from './data.js';
import { HYUIError, hyKey, hyValidateProps } from './validation.js';

export interface HYTextViewState { readonly props: HYTextProps; readonly value: string; readonly composing: boolean; }
export interface HYTextView { apply(state: HYTextViewState): void; }
/** Local draft/IME state only. The application accepts or rejects commit through props/revision. */
export class HYTextController {
  #props!: HYTextProps; #revision = -1; #draft = ''; #composing = false;
  #pending: { value: string; revision: number } | undefined;
  #transaction = 0; #active = 0; #disposed = false; #applying = false;
  #view: HYTextView | undefined; #applied: HYTextViewState | undefined;
  constructor(readonly key: string, props: HYTextProps, private readonly emit: (event: HYUIEvent) => void,
    readonly multiline = false, revision = 0) { hyKey(key); this.update(props, revision); }
  get value(): string { return this.#draft; }
  get composing(): boolean { return this.#composing; }
  update(props: HYTextProps, revision = this.#revision): void {
    if (this.#disposed) return;
    hyValidateProps(this.multiline ? 'TextArea' : 'TextInput', props, { key: this.key });
    if (!Number.isSafeInteger(revision) || revision < 0) throw new HYUIError('invalid-props', 'Invalid application revision', { key: this.key });
    if (revision < this.#revision) return;
    const changed = !this.#props || props.value !== this.#props.value;
    if (this.#props && changed && revision === this.#revision) throw new HYUIError('invalid-props', 'Changed accepted value requires a newer revision', { key: this.key });
    this.#props = snapshot(props); this.#revision = revision;
    if (changed) {
      if (this.#composing) this.#pending = { value: props.value, revision };
      else { this.#draft = props.value; this.#active = 0; this.#pending = undefined; }
    }
    if (props.disabled || props.readOnly) {
      if (this.#pending) this.#draft = this.#pending.value;
      this.#composing = false; this.#pending = undefined; this.#active = 0;
    }
    // Reapplying the accepted value never discards an unaccepted draft or its selection.
    this.#apply();
  }
  attach(view: HYTextView): void {
    if (this.#view || this.#disposed) throw new HYUIError('lifecycle', 'Text disposed or already attached', { key: this.key });
    this.#view = view; this.#apply();
  }
  #apply(): void {
    if (!this.#view || this.#disposed) return;
    const state = snapshot({ props: this.#props, value: this.#draft, composing: this.#composing });
    if (equalData(state, this.#applied)) return;
    this.#applying = true;
    try { this.#view.apply(state); this.#applied = state; } finally { this.#applying = false; }
  }
  #enabled(): boolean { return !this.#disposed && !this.#applying && !this.#props.disabled && !this.#props.readOnly; }
  #send(type: HYUIEvent['type'], reason: HYReason, value?: string): void {
    if (this.#disposed) return;
    this.emit({ key: this.key, type, reason, transaction: this.#active, composing: this.#composing, ...(value === undefined ? {} : { value }) });
  }
  input(value: string, reason: HYReason = 'keyboard'): boolean {
    if (!this.#enabled() || typeof value !== 'string' || value === this.#draft) return false;
    this.#draft = value; this.#active ||= ++this.#transaction;
    this.#send(this.#composing ? 'compositionUpdate' : 'valueChange', reason, value); this.#apply(); return true;
  }
  compositionStart(reason: HYReason = 'keyboard'): boolean {
    if (!this.#enabled() || this.#composing) return false;
    this.#composing = true; this.#active ||= ++this.#transaction;
    this.#send('compositionStart', reason); return true;
  }
  compositionEnd(value: string, reason: HYReason = 'keyboard'): boolean {
    if (this.#disposed || this.#applying || !this.#composing || typeof value !== 'string') return false;
    this.#draft = value; this.#composing = false;
    this.#send('compositionEnd', reason, value);
    this.#send('valueChange', reason, value);
    if (this.#pending) {
      // A newer authoritative update wins; an acceptance during emit can supersede it.
      if (this.#pending.revision === this.#revision) this.#draft = this.#pending.value;
      this.#pending = undefined; this.#active = 0;
    }
    this.#apply(); return true;
  }
  commit(reason: HYReason = 'keyboard'): boolean {
    if (!this.#enabled() || this.#composing || !this.#active) return false;
    const transaction = this.#active; this.#active = 0;
    if (this.#draft === this.#props.value) return false;
    this.emit({ key: this.key, type: 'commit', value: this.#draft, reason, transaction, composing: false });
    this.#apply(); return true;
  }
  /** The adapter supplies wasComposing from its native event; confirmation Enter never submits. */
  enter(wasComposing = false): boolean { return !this.multiline && !wasComposing && this.commit('keyboard'); }
  focus(reason: HYReason = 'keyboard'): void { if (!this.#disposed && !this.#applying) this.#send('focus', reason); }
  blur(reason: HYReason = 'keyboard'): void {
    if (this.#disposed || this.#applying) return;
    this.commit(reason); this.#send('blur', reason);
  }
  cancel(reason: HYReason = 'keyboard'): void {
    if (this.#disposed || this.#applying) return;
    this.#draft = this.#props.value; this.#composing = false; this.#pending = undefined;
    this.#send('cancel', reason); this.#active = 0; this.#apply();
  }
  dispose(): void { this.#disposed = true; this.#view = undefined; this.#pending = undefined; this.#active = 0; }
}
