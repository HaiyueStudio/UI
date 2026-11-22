export type HYFormValue = FormDataEntryValue | FormDataEntryValue[];
export interface HYFormSubmitDetail { values: Record<string, HYFormValue>; formData: FormData; }
export interface HYFormInvalidDetail { errors: Record<string, string>; }
export type HYFormLayout = 'vertical' | 'horizontal' | 'inline';
interface FormItem extends HTMLElement { name: string; error: string; validate(): Promise<boolean>; clearValidation(): void; }

/** Owns a real light-DOM form so native and form-associated custom controls share one owner. */
export class HYForm extends HTMLElement {
  private readonly _form = document.createElement('form');
  private readonly _observer = new MutationObserver(() => this._adoptChildren());
  private _listeners: AbortController | null = null;
  private _revision = 0;
  private _submission = 0;
  static get observedAttributes(): string[] { return ['layout', 'aria-label', 'autocomplete']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      ::slotted(form) { display: flex; flex-direction: column; gap: var(--hy-form-gap, var(--hy-space-8, 16px)); margin: 0; }
      :host([layout="inline"]) ::slotted(form) { flex-direction: row; flex-wrap: wrap; align-items: flex-start; }
    `;
    this._form.noValidate = true; this._form.setAttribute('part', 'form'); root.append(style, document.createElement('slot'));
  }
  connectedCallback(): void {
    this._adoptChildren(); this._observer.observe(this, { childList: true });
    this._listeners?.abort(); this._listeners = new AbortController(); const { signal } = this._listeners;
    this._form.addEventListener('submit', this._onSubmit, { signal }); this._form.addEventListener('reset', this._onReset, { signal });
    this._form.addEventListener('input', this._onInput, { signal }); this._form.addEventListener('change', this._onInput, { signal });
    this._form.addEventListener('click', this._onButtonClick, { signal }); this._form.addEventListener('keydown', this._onKeydown, { signal });
    this._sync();
  }
  disconnectedCallback(): void { this._observer.disconnect(); this._listeners?.abort(); this._listeners = null; this._submission++; this._revision++; }
  attributeChangedCallback(): void { this._sync(); }
  get layout(): HYFormLayout { const value = this.getAttribute('layout'); return value === 'horizontal' || value === 'inline' ? value : 'vertical'; }
  set layout(value: HYFormLayout) { this.setAttribute('layout', value); }
  get formElement(): HTMLFormElement { return this._form; }
  get formData(): FormData { return new FormData(this._form); }
  get values(): Record<string, HYFormValue> {
    const values: Record<string, HYFormValue> = Object.create(null) as Record<string, HYFormValue>;
    for (const [name, value] of this.formData) { const previous = values[name]; values[name] = previous === undefined ? value : Array.isArray(previous) ? [...previous, value] : [previous, value]; }
    return values;
  }
  setValues(values: Readonly<Record<string, string | number | boolean | readonly string[]>>): void {
    for (const element of this._form.elements) {
      if (!(element instanceof HTMLElement)) continue;
      const name = element.getAttribute('name'); if (!name || !Object.hasOwn(values, name)) continue;
      const value = values[name];
      const field = element as HTMLElement & { value?: string; checked?: boolean };
      if ('checked' in field) field.checked = typeof value === 'boolean' ? value : Array.isArray(value) ? value.includes(field.value ?? '') : String(value) === field.value;
      else if ('value' in field) {
        if (Array.isArray(value) && Reflect.get(field, 'multiple') === true) {
          if (field instanceof HTMLSelectElement) for (const option of field.options) option.selected = value.includes(option.value);
          else Reflect.set(field, 'value', [...value]);
        } else field.value = String(value ?? '');
      }
    }
    this._revision++;
  }
  async validate(): Promise<boolean> {
    const revision = this._revision; const items = this._items();
    const results = await Promise.all(items.map(item => item.validate()));
    if (!this.isConnected || revision !== this._revision) return false;
    const nativeValid = this._form.checkValidity(); const valid = nativeValid && results.every(Boolean);
    if (!valid) {
      const invalid = items.find(item => item.error); if (invalid) invalid.focus(); else this._form.reportValidity();
      const errors: Record<string, string> = Object.create(null) as Record<string, string>;
      for (const item of items) if (item.error) errors[item.name] = item.error;
      this.dispatchEvent(new CustomEvent<HYFormInvalidDetail>('form-invalid', { detail: { errors }, bubbles: true, composed: true }));
    }
    return valid;
  }
  async submit(): Promise<boolean> {
    const submission = ++this._submission; const revision = this._revision;
    if (!await this.validate() || submission !== this._submission || revision !== this._revision || !this.isConnected) return false;
    return this.dispatchEvent(new CustomEvent<HYFormSubmitDetail>('form-submit', { detail: { values: this.values, formData: this.formData }, bubbles: true, composed: true, cancelable: true }));
  }
  reset(): void { this._form.reset(); }
  clearValidation(): void { for (const item of this._items()) item.clearValidation(); }
  private _items(): FormItem[] { return [...this._form.querySelectorAll<FormItem>('hy-form-item')].filter(item => item.closest('hy-form') === this && typeof item.validate === 'function'); }
  private _adoptChildren(): void {
    const nodes = [...this.childNodes].filter(node => node !== this._form);
    if (nodes.length) this._form.append(...nodes);
    if (this._form.parentNode !== this) this.append(this._form);
  }
  private _sync(): void {
    this._form.setAttribute('aria-label', this.getAttribute('aria-label') || 'Form');
    this._form.autocomplete = this.getAttribute('autocomplete') === 'off' ? 'off' : 'on';
    this._form.style.setProperty('--hy-form-item-columns', this.layout === 'horizontal' ? 'var(--hy-form-label-width, 120px) minmax(0,1fr)' : 'minmax(0,1fr)');
    this._form.style.setProperty('--hy-form-control-column', this.layout === 'horizontal' ? '2' : '1');
  }
  private _onInput = (): void => { this._revision++; };
  private _onSubmit = (event: SubmitEvent): void => { event.preventDefault(); void this.submit(); };
  private _onReset = (event: Event): void => { queueMicrotask(() => { if (!event.defaultPrevented && this.isConnected) { this._revision++; this._submission++; this.clearValidation(); this.dispatchEvent(new Event('form-reset', { bubbles: true, composed: true })); } }); };
  private _onButtonClick = (event: MouseEvent): void => {
    const button = event.composedPath().find(node => node instanceof HTMLElement && node.tagName === 'HY-BUTTON') as HTMLElement | undefined;
    if (!button || event.defaultPrevented || button.hasAttribute('disabled') || button.hasAttribute('loading')) return;
    if (button.getAttribute('type') === 'submit') { event.preventDefault(); this._form.requestSubmit(); }
    else if (button.getAttribute('type') === 'reset') { event.preventDefault(); this.reset(); }
  };
  private _onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented || event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
    const target = event.composedPath()[0];
    if (target instanceof HTMLInputElement && !['button', 'submit', 'reset', 'checkbox', 'radio', 'file'].includes(target.type) && target.getRootNode() !== this._form.getRootNode()) { event.preventDefault(); this._form.requestSubmit(); }
  };
}
export function defineFormComponents(): void { if (!customElements.get('hy-form')) customElements.define('hy-form', HYForm); }
