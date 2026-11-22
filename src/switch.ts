import { HYFormControl } from './internal/form-control.js';

export interface HYSwitchChangeDetail { checked: boolean; value: string; }
export type HYSwitchSize = 'small' | 'default';

export class HYSwitch extends HTMLElement {
  static readonly formAssociated = true;
  private readonly _input = document.createElement('input');
  private readonly _text = document.createElement('span');
  private readonly _labelSlot = document.createElement('slot');
  private readonly _formControl = new HYFormControl(this, this._input);

  static get observedAttributes(): string[] { return ['checked', 'disabled', 'loading', 'required', 'name', 'value', 'label', 'aria-label', 'checked-text', 'unchecked-text', 'size']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      label { display: inline-flex; align-items: center; gap: var(--hy-space-4, 8px); cursor: pointer; }
      input { position: absolute; width: 1px; height: 1px; opacity: 0; clip-path: inset(50%); }
      .track { position: relative; display: inline-flex; align-items: center; box-sizing: border-box; min-width: 38px; height: 22px; padding: 0 7px 0 24px; border-radius: 999px; background: var(--hy-switch-off-bg, var(--hy-disabled-text-color, #65738a)); color: var(--hy-selected-text-color, #fff); transition: background 120ms; }
      .thumb { position: absolute; inset-inline-start: 3px; top: 3px; width: 16px; height: 16px; box-sizing: border-box; border-radius: 50%; background: var(--hy-switch-thumb-color, var(--hy-selected-text-color, #fff)); transition: inset-inline-start 120ms; }
      .state { font-size: 11px; white-space: nowrap; }
      input:checked + .track { padding-inline: 7px 24px; background: var(--hy-switch-on-bg, var(--hy-accent-strong-color, #554cc6)); }
      input:checked + .track .thumb { inset-inline-start: calc(100% - 19px); }
      input:focus-visible + .track { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 2px; }
      input:disabled ~ * { opacity: .55; cursor: not-allowed; }
      :host([size="small"]) .track { min-width: 30px; height: 18px; padding-inline: 20px 5px; }
      :host([size="small"]) .thumb { width: 12px; height: 12px; }
      :host([size="small"]) input:checked + .track { padding-inline: 5px 20px; }
      :host([size="small"]) input:checked + .track .thumb { inset-inline-start: calc(100% - 15px); }
      :host([loading]) .thumb::after { content: ''; position: absolute; inset: 3px; border: 2px solid var(--hy-border-color, #65738a); border-top-color: transparent; border-radius: 50%; animation: hy-switch-spin .8s linear infinite; }
      @keyframes hy-switch-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .track, .thumb { transition: none; } :host([loading]) .thumb::after { animation: none; } }
    `;
    const label = document.createElement('label'); label.part.add('label');
    const track = document.createElement('span'); track.className = 'track'; track.part.add('track'); track.setAttribute('aria-hidden', 'true');
    const thumb = document.createElement('span'); thumb.className = 'thumb'; thumb.part.add('thumb');
    this._text.className = 'state'; this._text.part.add('state');
    this._input.type = 'checkbox'; this._input.setAttribute('role', 'switch'); this._input.part.add('input');
    track.append(thumb, this._text); label.append(this._input, track, this._labelSlot); root.append(style, label);
  }

  connectedCallback(): void { this._input.addEventListener('change', this._onChange); this._input.addEventListener('keydown', this._onKeydown); this._sync(); this._formControl.connect(); }
  disconnectedCallback(): void { this._input.removeEventListener('change', this._onChange); this._input.removeEventListener('keydown', this._onKeydown); }
  attributeChangedCallback(): void { this._sync(); }
  get checked(): boolean { return this.hasAttribute('checked'); }
  set checked(value: boolean) { this.toggleAttribute('checked', Boolean(value)); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }
  get loading(): boolean { return this.hasAttribute('loading'); }
  set loading(value: boolean) { this.toggleAttribute('loading', Boolean(value)); }
  get value(): string { return this.getAttribute('value') ?? 'on'; }
  set value(value: string) { this.setAttribute('value', String(value)); }
  get name(): string { return this.getAttribute('name') ?? ''; }
  set name(value: string) { this.setAttribute('name', value); }
  get label(): string { return this.getAttribute('label') ?? ''; }
  set label(value: string) { this.setAttribute('label', value); }
  get size(): HYSwitchSize { return this.getAttribute('size') === 'small' ? 'small' : 'default'; }
  set size(value: HYSwitchSize) { this.setAttribute('size', value); }
  get form(): HTMLFormElement | null { return this._formControl.internals.form; }
  checkValidity(): boolean { return this._formControl.internals.checkValidity(); }
  reportValidity(): boolean { return this._formControl.internals.reportValidity(); }
  setCustomValidity(message: string): void { this._formControl.setCustomValidity(message); }
  formDisabledCallback(disabled: boolean): void { this._formControl.disabled = disabled; this._sync(); }
  formResetCallback(): void { this._formControl.reset(); }
  formStateRestoreCallback(state: string | File | FormData | null): void { this._formControl.restore(state); }
  override focus(options?: FocusOptions): void { this._input.focus(options); }
  override click(): void { this._input.click(); }

  private _sync(): void {
    this._input.checked = this.checked; this._input.disabled = this.disabled || this.loading || this._formControl.disabled;
    this._input.required = this.hasAttribute('required'); this._input.value = this.value;
    this._input.setAttribute('aria-checked', String(this.checked)); this._input.setAttribute('aria-busy', String(this.loading));
    const name = this.getAttribute('aria-label') ?? this.label;
    if (name) this._input.setAttribute('aria-label', name); else this._input.removeAttribute('aria-label');
    this._labelSlot.textContent = this.label;
    this._text.textContent = this.getAttribute(this.checked ? 'checked-text' : 'unchecked-text') ?? '';
    this._formControl.sync();
  }
  private _onChange = (): void => {
    this.checked = this._input.checked;
    this.dispatchEvent(new CustomEvent<HYSwitchChangeDetail>('checked-change', { detail: { checked: this.checked, value: this.value }, bubbles: true, composed: true }));
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };
  private _onKeydown = (event: KeyboardEvent): void => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); this._input.click(); } };
}

export function defineSwitchComponents(): void { if (!customElements.get('hy-switch')) customElements.define('hy-switch', HYSwitch); }
