import type { HYComponentProps, HYReason, HYUIEvent } from './types.js';
import { snapshot } from './data.js';
import { hyKey, hyValidateProps } from './validation.js';

export class HYButtonController {
  #props!: HYComponentProps['Button']; #disposed = false; #emitting = false; #transaction = 0;
  #gestures = new Set<string | number>();
  constructor(readonly key: string, props: HYComponentProps['Button'], private readonly emit: (event: HYUIEvent) => void) { hyKey(key); this.update(props); }
  update(props: HYComponentProps['Button']): void {
    if (this.#disposed) return;
    hyValidateProps('Button', props, { key: this.key }); this.#props = snapshot(props);
  }
  /** Adapters pass the same gesture id for overlapping tap/click/accessibility callbacks. */
  activate(reason: HYReason = 'pointer', gesture?: string | number): boolean {
    if (this.#disposed || this.#emitting || this.#props.disabled || this.#props.busy || this.#props.visible === false) return false;
    if (gesture !== undefined) {
      if (this.#gestures.has(gesture)) return false;
      this.#gestures.add(gesture);
      if (this.#gestures.size > 64) this.#gestures.delete(this.#gestures.values().next().value!);
    }
    this.#emitting = true;
    try { this.emit({ key: this.key, type: 'activate', reason, transaction: ++this.#transaction }); return true; }
    finally { this.#emitting = false; }
  }
  dispose(): void { this.#disposed = true; this.#gestures.clear(); }
}

export class HYToggleController {
  #props!: HYComponentProps['Toggle']; #disposed = false; #emitting = false; #transaction = 0;
  constructor(readonly key: string, props: HYComponentProps['Toggle'], private readonly emit: (event: HYUIEvent) => void) { hyKey(key); this.update(props); }
  update(props: HYComponentProps['Toggle']): void {
    if (this.#disposed) return;
    hyValidateProps('Toggle', props, { key: this.key }); this.#props = snapshot(props);
  }
  choose(checked: boolean, reason: HYReason = 'pointer'): boolean {
    if (typeof checked !== 'boolean' || this.#disposed || this.#emitting || this.#props.disabled || this.#props.visible === false || checked === this.#props.checked) return false;
    this.#emitting = true;
    const event = { key: this.key, value: checked, reason, transaction: ++this.#transaction };
    try {
      this.emit({ ...event, type: 'valueChange' });
      if (this.#disposed) return false;
      this.emit({ ...event, type: 'commit' }); return true;
    } finally { this.#emitting = false; }
  }
  dispose(): void { this.#disposed = true; }
}

export class HYSliderController {
  #props!: HYComponentProps['Slider']; #draft = 0; #transaction = 0; #active = 0; #disposed = false;
  constructor(readonly key: string, props: HYComponentProps['Slider'], private readonly emit: (event: HYUIEvent) => void) { hyKey(key); this.update(props); }
  get value(): number { return this.#draft; }
  update(props: HYComponentProps['Slider']): void {
    if (this.#disposed) return;
    hyValidateProps('Slider', props, { key: this.key });
    if (!this.#props || props.value !== this.#props.value || props.min !== this.#props.min || props.max !== this.#props.max || props.step !== this.#props.step || props.disabled || props.visible === false) {
      this.#draft = props.value; this.#active = 0;
    }
    this.#props = snapshot(props);
  }
  change(value: number, reason: HYReason = 'pointer'): boolean {
    if (this.#disposed || this.#props.disabled || this.#props.visible === false || !Number.isFinite(value)) return false;
    const { min, max, step } = this.#props;
    const quantized = min + Math.round((Math.max(min, Math.min(max, value)) - min) / step) * step;
    const next = Math.max(min, Math.min(max, Number(quantized.toPrecision(14))));
    if (next === this.#draft) return false;
    this.#draft = next; this.#active ||= ++this.#transaction;
    this.emit({ key: this.key, type: 'valueChange', value: next, reason, transaction: this.#active }); return true;
  }
  commit(reason: HYReason = 'pointer'): boolean {
    if (this.#disposed || this.#props.disabled || !this.#active) return false;
    const transaction = this.#active; this.#active = 0;
    if (this.#draft === this.#props.value) return false;
    try { this.emit({ key: this.key, type: 'commit', value: this.#draft, reason, transaction }); return true; }
    finally { this.#draft = this.#props.value; }
  }
  cancel(reason: HYReason = 'pointer'): void {
    if (this.#disposed || !this.#active) return;
    const transaction = this.#active; this.#active = 0; this.#draft = this.#props.value;
    this.emit({ key: this.key, type: 'cancel', reason, transaction });
  }
  dispose(): void { this.#disposed = true; this.#active = 0; }
}
