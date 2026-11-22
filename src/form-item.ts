export type HYFormItemStatus = '' | 'validating' | 'success' | 'error';
export interface HYFormRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  message?: string;
  validator?: (value: unknown, signal: AbortSignal) => void | string | Promise<void | string>;
}
export interface HYFormItemValidateDetail { name: string; valid: boolean; error: string; }
type Field = HTMLElement & { value?: unknown; checked?: boolean; files?: unknown; fileList?: unknown; disabled?: boolean; validationMessage?: string; checkValidity?: () => boolean };

export class HYFormItem extends HTMLElement {
  private readonly _label = document.createElement('label');
  private readonly _slot = document.createElement('slot');
  private readonly _help = document.createElement('div');
  private readonly _error = document.createElement('div');
  private readonly _pending = document.createElement('div');
  private _rules: HYFormRule[] = [];
  private _status: HYFormItemStatus = '';
  private _validation: AbortController | null = null;
  private _listeners: AbortController | null = null;
  private _observer: MutationObserver | null = null;
  private _managed = new Map<HTMLElement, Map<string, string | null>>();
  static get observedAttributes(): string[] { return ['label', 'name', 'required', 'help', 'error', 'validate-trigger']; }

  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      .field { display: grid; grid-template-columns: var(--hy-form-item-columns, minmax(0,1fr)); gap: var(--hy-space-3, 6px) var(--hy-space-6, 12px); align-items: start; } label { font-weight: 500; cursor: pointer; }
      .control, .help, .error, .pending { grid-column: var(--hy-form-control-column, 1); }
      :host([required]) label::before { content: '* '; color: var(--hy-error-color, #d95d72); }
      .help { color: var(--hy-secondary-text-color, #aebbd0); } .error { color: var(--hy-error-color, #d95d72); } .pending { color: var(--hy-muted-text-color, #8290a3); }
      [hidden] { display: none !important; } ::slotted(*) { min-width: 0; }
    `;
    const field = document.createElement('div'); field.className = 'field'; field.part.add('field');
    this._label.part.add('label'); this._help.className = 'help'; this._help.part.add('help');
    this._error.className = 'error'; this._error.part.add('error'); this._error.setAttribute('role', 'alert');
    this._pending.className = 'pending'; this._pending.part.add('pending'); this._pending.setAttribute('role', 'status'); this._pending.textContent = 'Validating…';
    const control = document.createElement('div'); control.className = 'control'; control.part.add('control'); control.append(this._slot);
    field.append(this._label, control, this._help, this._error, this._pending); root.append(style, field);
  }
  connectedCallback(): void {
    this._listeners?.abort(); this._listeners = new AbortController(); const { signal } = this._listeners;
    this._label.addEventListener('click', () => this.focus(), { signal });
    this.addEventListener('input', this._onInput, { signal }); this.addEventListener('change', this._onChange, { signal }); this.addEventListener('focusout', this._onBlur, { signal });
    this._slot.addEventListener('slotchange', this._sync, { signal });
    this._observer = new MutationObserver(this._sync); this._observer.observe(this, { childList: true, subtree: true }); this._sync();
  }
  disconnectedCallback(): void { this._validation?.abort(); this._listeners?.abort(); this._observer?.disconnect(); this._observer = null; this._restoreManaged(); }
  attributeChangedCallback(): void { this._sync(); }
  get label(): string { return this.getAttribute('label') ?? ''; }
  set label(value: string) { this.setAttribute('label', value); }
  get name(): string { return this.getAttribute('name') ?? this._field()?.getAttribute('name') ?? ''; }
  set name(value: string) { this.setAttribute('name', value); }
  get required(): boolean { return this.hasAttribute('required'); }
  set required(value: boolean) { this.toggleAttribute('required', value); }
  get help(): string { return this.getAttribute('help') ?? ''; }
  set help(value: string) { this.setAttribute('help', value); }
  get error(): string { return this.getAttribute('error') ?? ''; }
  set error(value: string) { if (value) this.setAttribute('error', value); else this.removeAttribute('error'); }
  get status(): HYFormItemStatus { return this.error ? 'error' : this._status; }
  get rules(): HYFormRule[] { return this._rules.map(rule => ({ ...rule })); }
  set rules(value: HYFormRule[]) { this._validation?.abort(); this._rules = Array.isArray(value) ? value.map(rule => ({ ...rule })) : []; this.clearValidation(); }
  get validateTrigger(): 'blur' | 'change' | 'submit' { const value = this.getAttribute('validate-trigger'); return value === 'change' || value === 'submit' ? value : 'blur'; }
  set validateTrigger(value: 'blur' | 'change' | 'submit') { this.setAttribute('validate-trigger', value); }
  get value(): unknown {
    const field = this._field();
    if (!field) return undefined;
    if (field.tagName === 'HY-UPLOAD') return field.fileList;
    if ('checked' in field && (field.tagName.startsWith('HY-') || field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type))) return field.checked;
    if (field instanceof HTMLInputElement && field.type === 'file') return [...(field.files ?? [])];
    return field.value;
  }
  override focus(options?: FocusOptions): void { this._field()?.focus(options); }
  clearValidation(): void { this._validation?.abort(); this._validation = null; this._status = ''; this.error = ''; this._sync(); }

  async validate(): Promise<boolean> {
    this._validation?.abort(); const validation = new AbortController(); this._validation = validation;
    const field = this._field(); const value = this.value;
    if (!field || field.disabled || field.matches(':disabled')) { this.clearValidation(); return true; }
    this._status = 'validating'; this.error = ''; this._sync();
    let error = '';
    const rules = this.required ? [{ required: true, message: `${this.label || this.name || 'This field'} is required` }, ...this._rules] : this._rules;
    try {
      for (const rule of rules) {
        const empty = value === undefined || value === null || value === false || typeof value === 'string' && !value.trim() || Array.isArray(value) && value.length === 0;
        const length = typeof value === 'number' ? value : typeof value === 'string' || Array.isArray(value) ? value.length : 0;
        if (rule.required && empty) error = rule.message || 'This field is required';
        else if (!empty && rule.min !== undefined && length < rule.min) error = rule.message || `Minimum: ${rule.min}`;
        else if (!empty && rule.max !== undefined && length > rule.max) error = rule.message || `Maximum: ${rule.max}`;
        else if (!empty && rule.pattern) { rule.pattern.lastIndex = 0; if (!rule.pattern.test(String(value))) error = rule.message || 'Invalid format'; }
        if (!error && rule.validator) error = await rule.validator(value, validation.signal) || '';
        if (validation.signal.aborted || !this.isConnected) return false;
        if (error) break;
      }
      if (!error && field.checkValidity && !field.checkValidity()) error = field.validationMessage || 'Invalid value';
    } catch (cause) { if (!validation.signal.aborted) error = cause instanceof Error ? cause.message : 'Validation failed'; }
    if (validation.signal.aborted || !this.isConnected) return false;
    this._status = error ? 'error' : 'success'; this.error = error; this._sync();
    this.dispatchEvent(new CustomEvent<HYFormItemValidateDetail>('field-validate', { detail: { name: this.name, valid: !error, error }, bubbles: true, composed: true }));
    return !error;
  }

  private _field(): Field | null {
    return [...this.querySelectorAll<Field>('input,textarea,select,[name],hy-input,hy-select,hy-checkbox,hy-radio,hy-switch,hy-mentions,hy-upload,hy-auto-complete,hy-tree-select')]
      .find(field => field.closest('hy-form-item') === this && field.tagName !== 'HY-FORM-ITEM') ?? null;
  }
  private _manage(node: HTMLElement, name: string, value: string | null): void {
    let attributes = this._managed.get(node);
    if (!attributes) { attributes = new Map(); this._managed.set(node, attributes); }
    if (!attributes.has(name)) attributes.set(name, node.getAttribute(name));
    if (value === null) { if (node.hasAttribute(name)) node.removeAttribute(name); }
    else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  }
  private _restoreManaged(): void { for (const [node, attributes] of this._managed) for (const [name, value] of attributes) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value); } this._managed.clear(); }
  private _sync = (): void => {
    this._label.textContent = this.label; this._label.hidden = !this.label;
    this._help.textContent = this.help; this._help.hidden = !this.help || Boolean(this.error);
    this._error.textContent = this.error; this._error.hidden = !this.error;
    this._pending.hidden = this._status !== 'validating';
    const field = this._field(); if (!field || !this.isConnected) return;
    if (this.hasAttribute('name') && (!field.hasAttribute('name') || this._managed.get(field)?.has('name'))) this._manage(field, 'name', this.getAttribute('name'));
    if (this.label && (!field.hasAttribute('aria-label') || this._managed.get(field)?.has('aria-label'))) this._manage(field, 'aria-label', this.label);
    const controls = field.shadowRoot ? [...field.shadowRoot.querySelectorAll<HTMLElement>('input:not([type="file"]),textarea,select,button')] : [field];
    for (const native of controls) {
      this._manage(native, 'aria-invalid', this.error ? 'true' : null);
      this._manage(native, 'aria-description', this.error || this.help || null);
      this._manage(native, 'aria-busy', this._status === 'validating' ? 'true' : null);
    }
  };
  private _isOwnEvent(event: Event): boolean { return event.target instanceof Element && event.target.closest('hy-form-item') === this; }
  private _onInput = (event: Event): void => {
    if (!this._isOwnEvent(event)) return;
    this._validation?.abort(); this._validation = null;
    if (this._status === 'validating') { this._status = ''; this._sync(); }
    if (this.validateTrigger === 'change' && !(event instanceof InputEvent && event.isComposing)) void this.validate();
  };
  private _onChange = (event: Event): void => { this._onInput(event); };
  private _onBlur = (event: FocusEvent): void => { if (this._isOwnEvent(event) && this.validateTrigger === 'blur') void this.validate(); };
}
export function defineFormItemComponents(): void { if (!customElements.get('hy-form-item')) customElements.define('hy-form-item', HYFormItem); }
