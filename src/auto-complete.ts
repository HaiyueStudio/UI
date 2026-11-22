import { HYFormControl } from './internal/form-control.js';
import { HYAnchoredPopup, HY_COMBOBOX_STYLES } from './internal/anchored-popup.js';

export interface HYAutoCompleteOption { value: string; label?: string; disabled?: boolean; }
export interface HYAutoCompleteChangeDetail { value: string; }
export interface HYAutoCompleteSelectDetail { value: string; option: HYAutoCompleteOption; }
export type HYAutoCompleteFilter = (value: string, option: HYAutoCompleteOption) => boolean;
let autoCompleteId = 0;

export class HYAutoComplete extends HTMLElement {
  static readonly formAssociated = true;
  private readonly _control = document.createElement('div');
  private readonly _input = document.createElement('input');
  private readonly _clear = document.createElement('button');
  private readonly _panel = document.createElement('div');
  private readonly _list = document.createElement('div');
  private readonly _status = document.createElement('div');
  private readonly _id = `hy-autocomplete-${++autoCompleteId}`;
  private readonly _formControl = new HYFormControl(this, this._input);
  private readonly _popup = new HYAnchoredPopup(this, this._control, this._panel, () => this._setOpen(false));
  private _options: HYAutoCompleteOption[] = [];
  private _items: HTMLElement[] = [];
  private _visible: number[] = [];
  private _active = -1;
  private _filter: HYAutoCompleteFilter | false | null = null;
  private _listeners: AbortController | null = null;
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;
  private _composing = false;
  private _lastSearch: string | null = null;
  private _committing = false;
  static get observedAttributes(): string[] { return ['value', 'options', 'open', 'disabled', 'readonly', 'loading', 'allow-clear', 'required', 'name', 'placeholder', 'aria-label', 'maxlength', 'minlength', 'pattern', 'search-delay', 'not-found-content']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style'); style.textContent = HY_COMBOBOX_STYLES;
    this._control.className = 'control'; this._control.part.add('control'); this._input.type = 'text'; this._input.autocomplete = 'off'; this._input.part.add('input');
    this._input.setAttribute('role', 'combobox'); this._input.setAttribute('aria-autocomplete', 'list'); this._input.setAttribute('aria-haspopup', 'listbox'); this._input.setAttribute('aria-controls', this._id);
    this._clear.type = 'button'; this._clear.className = 'clear'; this._clear.part.add('clear'); this._clear.textContent = '×'; this._clear.setAttribute('aria-label', 'Clear value');
    this._panel.className = 'panel'; this._panel.part.add('panel'); this._list.id = this._id; this._list.setAttribute('role', 'listbox'); this._list.part.add('list');
    this._status.className = 'status'; this._status.part.add('status'); this._status.setAttribute('role', 'status');
    this._panel.append(this._list, this._status); this._control.append(this._input, this._clear); root.append(style, this._control, this._panel);
  }
  connectedCallback(): void {
    this._listeners?.abort(); this._listeners = new AbortController(); const { signal } = this._listeners;
    this._input.addEventListener('input', this._onInput, { signal }); this._input.addEventListener('keydown', this._onKeydown, { signal });
    this._input.addEventListener('focus', () => { if (!this._committing) this._setOpen(true); }, { signal });
    this._input.addEventListener('blur', () => this._setOpen(false), { signal });
    this._input.addEventListener('compositionstart', () => { this._composing = true; this._cancelSearch(); this._setOpen(false); }, { signal });
    this._input.addEventListener('compositionend', () => { this._composing = false; this._setOpen(true); this._scheduleSearch(); }, { signal });
    this._panel.addEventListener('pointerdown', event => event.preventDefault(), { signal });
    this._panel.addEventListener('click', event => { const item = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-index]') : null; if (item) this._select(Number(item.dataset.index)); }, { signal });
    this._panel.addEventListener('pointermove', event => { const item = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-index]') : null; const index = item ? Number(item.dataset.index) : -1; if (index >= 0 && !this._options[index]?.disabled) { this._active = index; this._syncActive(); } }, { signal });
    this._clear.addEventListener('click', () => { if (this._input.disabled || this.readOnly) return; this.value = ''; this._input.focus(); this._setOpen(false); this._committing = true; try { this._input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteContentBackward', data: null })); } finally { this._committing = false; } this._emitChange(); this._scheduleSearch(); this.dispatchEvent(new Event('clear', { bubbles: true, composed: true })); }, { signal });
    this._popup.connect(); this._sync(); this._formControl.connect();
  }
  disconnectedCallback(): void { this._listeners?.abort(); this._listeners = null; this._popup.dispose(); this._cancelSearch(); this._composing = false; }
  attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
    if (previous === next) return;
    if (name === 'options') { let value: unknown = []; try { value = JSON.parse(next ?? '[]'); } catch { /* Invalid data is empty. */ } this._setOptions(value); }
    this._sync();
    if (name === 'disabled' || name === 'readonly') this._cancelSearch();
    if (this.disabled || this.readOnly || this._formControl.disabled) this._setOpen(false);
  }
  get value(): string { return this.getAttribute('value') ?? ''; }
  set value(value: string) { this.setAttribute('value', String(value ?? '')); }
  get options(): HYAutoCompleteOption[] { return this._options.map(option => ({ ...option })); }
  set options(value: HYAutoCompleteOption[]) { this._setOptions(value); this._render(); }
  get filterOption(): HYAutoCompleteFilter | false | null { return this._filter; }
  set filterOption(value: HYAutoCompleteFilter | false | null) { this._filter = value; this._render(); }
  get open(): boolean { return this.hasAttribute('open'); }
  set open(value: boolean) { this._setOpen(Boolean(value)); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', value); }
  get readOnly(): boolean { return this.hasAttribute('readonly'); }
  set readOnly(value: boolean) { this.toggleAttribute('readonly', value); }
  get loading(): boolean { return this.hasAttribute('loading'); }
  set loading(value: boolean) { this.toggleAttribute('loading', value); }
  get allowClear(): boolean { return this.hasAttribute('allow-clear'); }
  set allowClear(value: boolean) { this.toggleAttribute('allow-clear', value); }
  get placeholder(): string { return this.getAttribute('placeholder') ?? ''; }
  set placeholder(value: string) { this.setAttribute('placeholder', value); }
  get searchDelay(): number { const value = Number(this.getAttribute('search-delay')); return Number.isFinite(value) ? Math.max(0, Math.min(60000, value)) : 0; }
  set searchDelay(value: number) { this.setAttribute('search-delay', String(value)); }
  get form(): HTMLFormElement | null { return this._formControl.internals.form; }
  get validity(): ValidityState { return this._formControl.internals.validity; }
  get validationMessage(): string { return this._formControl.internals.validationMessage; }
  checkValidity(): boolean { return this._formControl.internals.checkValidity(); }
  reportValidity(): boolean { return this._formControl.internals.reportValidity(); }
  setCustomValidity(message: string): void { this._formControl.setCustomValidity(message); }
  formDisabledCallback(disabled: boolean): void { this._formControl.disabled = disabled; this._sync(); if (disabled) { this._cancelSearch(); this._setOpen(false); } }
  formResetCallback(): void { this._formControl.reset(); this._cancelSearch(); this._setOpen(false); }
  formStateRestoreCallback(state: string | File | FormData | null): void { this._formControl.restore(state); }
  override focus(options?: FocusOptions): void { this._input.focus(options); }
  override blur(): void { this._input.blur(); }
  private _sync(): void {
    if (this._input.value !== this.value) this._input.value = this.value;
    const disabled = this.disabled || this._formControl.disabled;
    if (this._input.disabled !== disabled) this._input.disabled = disabled;
    if (this._input.readOnly !== this.readOnly) this._input.readOnly = this.readOnly;
    if (this._input.required !== this.hasAttribute('required')) this._input.required = this.hasAttribute('required');
    for (const name of ['placeholder', 'aria-label', 'maxlength', 'minlength', 'pattern']) { const value = this.getAttribute(name); if (value === null) { if (this._input.hasAttribute(name)) this._input.removeAttribute(name); } else if (this._input.getAttribute(name) !== value) this._input.setAttribute(name, value); }
    this._control.classList.toggle('disabled', disabled); this._clear.hidden = !this.allowClear || !this.value || this.readOnly; this._clear.disabled = disabled;
    this._formControl.sync(); this._render();
  }
  private _setOptions(value: unknown): void {
    const options: HYAutoCompleteOption[] = Array.isArray(value) ? value.filter(item => item && typeof item.value === 'string').map(item => ({ value: item.value, ...(typeof item.label === 'string' ? { label: item.label } : {}), ...(item.disabled ? { disabled: true } : {}) })) : [];
    if (JSON.stringify(options) === JSON.stringify(this._options)) return;
    this._options = options; this._items = options.map((option, index) => { const item = document.createElement('div'); item.className = 'option'; item.part.add('option'); item.id = `${this._id}-${index}`; item.dataset.index = String(index); item.setAttribute('role', 'option'); item.setAttribute('aria-disabled', String(Boolean(option.disabled))); item.textContent = option.label ?? option.value; return item; });
    this._list.replaceChildren(...this._items); this._active = -1;
  }
  private _render(): void {
    const previous = this._active;
    this._visible = this.loading ? [] : this._options.flatMap((option, index) => this._filter === false || (this._filter ? this._filter(this.value, { ...option }) : `${option.label ?? ''}\n${option.value}`.toLocaleLowerCase().includes(this.value.toLocaleLowerCase())) ? [index] : []);
    const visible = new Set(this._visible); this._items.forEach((item, index) => { item.hidden = !visible.has(index); });
    this._active = visible.has(previous) && !this._options[previous]?.disabled ? previous : this._visible.find(index => !this._options[index]?.disabled) ?? -1;
    const message = this.loading ? 'Loading…' : this.getAttribute('not-found-content') ?? 'No results';
    if (this._status.textContent !== message) this._status.textContent = message;
    this._status.hidden = this._visible.length > 0; this._list.setAttribute('aria-busy', String(this.loading)); this._list.setAttribute('aria-label', this.getAttribute('aria-label') || 'Suggestions');
    const shown = this.open && !this._input.disabled && !this.readOnly && !this._composing && this.isConnected;
    this._input.setAttribute('aria-expanded', String(shown)); if (shown) this._popup.show(); else this._popup.hide(); this._syncActive();
  }
  private _syncActive(): void { this._items.forEach((item, index) => { item.classList.toggle('active', index === this._active); item.setAttribute('aria-selected', String(index === this._active)); }); if (this.open && this._active >= 0) this._input.setAttribute('aria-activedescendant', `${this._id}-${this._active}`); else this._input.removeAttribute('aria-activedescendant'); }
  private _setOpen(open: boolean): void { if (open && (this.disabled || this._formControl.disabled || this.readOnly || this._composing)) return; if (this.open === open) return; this.toggleAttribute('open', open); this.dispatchEvent(new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true })); }
  private _emitChange(): void { this.dispatchEvent(new CustomEvent<HYAutoCompleteChangeDetail>('value-change', { detail: { value: this.value }, bubbles: true, composed: true })); }
  private _onInput = (): void => { if (!this._committing) this._active = -1; this.value = this._input.value; if (!this._committing) { this._emitChange(); if (!this._composing) { this._setOpen(true); this._scheduleSearch(); } } };
  private _cancelSearch(): void { if (this._searchTimer !== null) clearTimeout(this._searchTimer); this._searchTimer = null; }
  private _scheduleSearch(): void { this._cancelSearch(); const emit = (): void => { this._searchTimer = null; if (this.isConnected && !this._input.disabled && !this.readOnly && !this._composing && this._lastSearch !== this.value) { this._lastSearch = this.value; this.dispatchEvent(new CustomEvent<HYAutoCompleteChangeDetail>('search', { detail: { value: this.value }, bubbles: true, composed: true })); } }; if (this.searchDelay) this._searchTimer = setTimeout(emit, this.searchDelay); else emit(); }
  private _select(index: number): void {
    const option = this._options[index]; if (!option || option.disabled || this._input.disabled || this.readOnly || this.loading || !this._visible.includes(index)) return;
    this._cancelSearch(); this._committing = true;
    try { this.value = option.value; this._setOpen(false); this._input.focus(); this._input.setSelectionRange(this.value.length, this.value.length); this._input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText', data: this.value })); this._emitChange(); this.dispatchEvent(new CustomEvent<HYAutoCompleteSelectDetail>('option-select', { detail: { value: this.value, option: { ...option } }, bubbles: true, composed: true })); } finally { this._committing = false; }
  }
  private _onKeydown = (event: KeyboardEvent): void => {
    if (event.isComposing || this._composing || event.keyCode === 229 || this._input.disabled || this.readOnly) return;
    if (event.key === 'Escape' || event.key === 'Tab') { if (this.open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); } this._setOpen(false); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); const wasOpen = this.open; this._setOpen(true); const enabled = this._visible.filter(index => !this._options[index]?.disabled);
      if (!enabled.length) return; const position = enabled.indexOf(this._active);
      this._active = wasOpen ? enabled[(position + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]! : enabled[event.key === 'ArrowDown' ? 0 : enabled.length - 1]!;
      this._syncActive(); this._items[this._active]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && this.open && this._active >= 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); this._select(this._active); }
  };
}
export function defineAutoCompleteComponents(): void { if (!customElements.get('hy-auto-complete')) customElements.define('hy-auto-complete', HYAutoComplete); }
