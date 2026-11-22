import { HYAnchoredPopup, HY_COMBOBOX_STYLES } from './internal/anchored-popup.js';
export interface HYTreeSelectOption { value: string; label: string; disabled?: boolean; selectable?: boolean; expanded?: boolean; children?: HYTreeSelectOption[]; }
export interface HYTreeSelectChangeDetail { value: string | string[]; values: string[]; options: HYTreeSelectOption[]; }
export interface HYTreeSelectExpandDetail { expandedKeys: string[]; }
interface TreeEntry { option: HYTreeSelectOption; parent: string | null; depth: number; disabled: boolean; row: HTMLElement; toggle: HTMLButtonElement; }
let treeSelectId = 0;

export class HYTreeSelect extends HTMLElement {
  static readonly formAssociated = true;
  private readonly _internals = this.attachInternals();
  private readonly _control = document.createElement('div');
  private readonly _tags = document.createElement('span');
  private readonly _input = document.createElement('input');
  private readonly _clear = document.createElement('button');
  private readonly _panel = document.createElement('div');
  private readonly _tree = document.createElement('div');
  private readonly _status = document.createElement('div');
  private readonly _id = `hy-tree-select-${++treeSelectId}`;
  private readonly _popup = new HYAnchoredPopup(this, this._control, this._panel, () => this._setOpen(false));
  private _options: HYTreeSelectOption[] = [];
  private _entries = new Map<string, TreeEntry>();
  private _expanded = new Set<string>();
  private _visible: TreeEntry[] = [];
  private _active = '';
  private _query = '';
  private _composing = false;
  private _formDisabled = false;
  private _initialValues: string[] | null = null;
  private _listeners: AbortController | null = null;
  private _customError = '';
  static get observedAttributes(): string[] { return ['options', 'value', 'multiple', 'expanded-keys', 'open', 'disabled', 'readonly', 'searchable', 'clearable', 'required', 'loading', 'name', 'placeholder', 'aria-label', 'not-found-content']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = HY_COMBOBOX_STYLES + `
      .control { flex-wrap: wrap; cursor: text; } .tags { display: contents; } .tag { display: inline-flex; align-items: center; gap: 3px; max-width: 100%; margin-block: 3px; padding-inline: 5px; border-radius: var(--hy-radius-xs, 2px); background: var(--hy-hover-bg-color, #273241); }
      .tag-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .tag button { border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
      .option { display: flex; align-items: center; gap: 4px; padding-inline-start: calc(var(--_depth, 0) * 16px + 4px); }
      .toggle { width: 22px; flex: 0 0 22px; height: 24px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
      .check { flex: 0 0 14px; width: 14px; height: 14px; display: grid; place-items: center; border: 1px solid var(--hy-border-color, #303746); border-radius: 2px; }
      [aria-checked="true"] .check { background: var(--hy-accent-strong-color, #554cc6); color: var(--hy-selected-text-color, #fff); } .label { min-width: 0; overflow-wrap: anywhere; }
    `;
    this._control.className = 'control'; this._control.part.add('control'); this._tags.className = 'tags'; this._tags.part.add('tags');
    this._input.type = 'text'; this._input.autocomplete = 'off'; this._input.part.add('input'); this._input.setAttribute('role', 'combobox'); this._input.setAttribute('aria-haspopup', 'tree'); this._input.setAttribute('aria-controls', this._id); this._input.setAttribute('aria-autocomplete', 'list');
    this._clear.type = 'button'; this._clear.className = 'clear'; this._clear.textContent = '×'; this._clear.part.add('clear'); this._clear.setAttribute('aria-label', 'Clear selection');
    this._panel.className = 'panel'; this._panel.part.add('panel'); this._tree.id = this._id; this._tree.setAttribute('role', 'tree'); this._tree.part.add('tree');
    this._status.className = 'status'; this._status.part.add('status'); this._status.setAttribute('role', 'status'); this._panel.append(this._tree, this._status); this._control.append(this._tags, this._input, this._clear); root.append(style, this._control, this._panel);
  }
  connectedCallback(): void {
    this._initialValues ??= this.values;
    this._listeners?.abort(); this._listeners = new AbortController(); const { signal } = this._listeners;
    this._input.addEventListener('focus', () => this._setOpen(true), { signal }); this._input.addEventListener('click', () => this._setOpen(true), { signal });
    this._input.addEventListener('blur', () => this._setOpen(false), { signal }); this._input.addEventListener('keydown', this._onKeydown, { signal });
    this._input.addEventListener('input', () => { this._query = this._input.value; this._active = ''; this._setOpen(true); this._render(); if (!this._composing) this._emitSearch(); }, { signal });
    this._input.addEventListener('compositionstart', () => { this._composing = true; }, { signal }); this._input.addEventListener('compositionend', () => { this._composing = false; this._query = this._input.value; this._render(); this._emitSearch(); }, { signal });
    this._panel.addEventListener('pointerdown', event => event.preventDefault(), { signal }); this._panel.addEventListener('click', this._onTreeClick, { signal });
    this._clear.addEventListener('click', () => { if (this._disabled || this.readOnly) return; this._query = ''; this._commit([]); this._input.focus(); this._setOpen(false); this.dispatchEvent(new Event('clear', { bubbles: true, composed: true })); }, { signal });
    this._tags.addEventListener('click', event => { const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-remove]') : null; if (button && !this._disabled && !this.readOnly) this._commit(this.values.filter(value => value !== button.dataset.remove)); }, { signal });
    this._popup.connect(); this._sync();
  }
  disconnectedCallback(): void { this._listeners?.abort(); this._listeners = null; this._popup.dispose(); this._composing = false; }
  attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
    if (previous === next) return;
    if (name === 'options') { let value: unknown = []; try { value = JSON.parse(next ?? '[]'); } catch { /* Invalid options are empty. */ } this._setOptions(value); }
    if (name === 'expanded-keys') { try { const value: unknown = JSON.parse(next ?? '[]'); this._expanded = new Set(Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : []); } catch { this._expanded.clear(); } }
    this._sync(); if (this._disabled || this.readOnly) this._setOpen(false);
  }
  get options(): HYTreeSelectOption[] { return this._options.map(cloneOption); }
  set options(value: HYTreeSelectOption[]) { this._setOptions(value); this._sync(); }
  get values(): string[] { const raw = this.getAttribute('value') ?? ''; if (!this.multiple) return raw ? [raw] : []; try { const value: unknown = JSON.parse(raw || '[]'); return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))] : raw ? [raw] : []; } catch { return raw ? [raw] : []; } }
  set values(value: string[]) { this.value = this.multiple ? value : value[0] ?? ''; }
  get value(): string | string[] { return this.multiple ? this.values : this.values[0] ?? ''; }
  set value(value: string | readonly string[]) { const values = Array.isArray(value) ? value : value ? [String(value)] : []; this.setAttribute('value', this.multiple ? JSON.stringify([...new Set(values)]) : values[0] ?? ''); }
  get multiple(): boolean { return this.hasAttribute('multiple'); }
  set multiple(value: boolean) { const values = this.values; this.toggleAttribute('multiple', value); this.values = values; }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', value); }
  get readOnly(): boolean { return this.hasAttribute('readonly'); }
  set readOnly(value: boolean) { this.toggleAttribute('readonly', value); }
  get searchable(): boolean { return this.getAttribute('searchable') !== 'false'; }
  set searchable(value: boolean) { this.setAttribute('searchable', String(value)); }
  get clearable(): boolean { return this.getAttribute('clearable') !== 'false'; }
  set clearable(value: boolean) { this.setAttribute('clearable', String(value)); }
  get loading(): boolean { return this.hasAttribute('loading'); }
  set loading(value: boolean) { this.toggleAttribute('loading', value); }
  get open(): boolean { return this.hasAttribute('open'); }
  set open(value: boolean) { this._setOpen(value); }
  get expandedKeys(): string[] { return [...this._expanded]; }
  set expandedKeys(value: string[]) { this.setAttribute('expanded-keys', JSON.stringify(value)); }
  get placeholder(): string { return this.getAttribute('placeholder') ?? 'Select an item'; }
  set placeholder(value: string) { this.setAttribute('placeholder', value); }
  get form(): HTMLFormElement | null { return this._internals.form; }
  get validity(): ValidityState { return this._internals.validity; }
  get validationMessage(): string { return this._internals.validationMessage; }
  checkValidity(): boolean { return this._internals.checkValidity(); }
  reportValidity(): boolean { return this._internals.reportValidity(); }
  setCustomValidity(message: string): void { this._customError = message; this._syncForm(); }
  formDisabledCallback(disabled: boolean): void { this._formDisabled = disabled; this._sync(); if (disabled) this._setOpen(false); }
  formResetCallback(): void { this.values = this._initialValues ?? []; this._query = ''; this._customError = ''; this._setOpen(false); this._sync(); }
  formStateRestoreCallback(state: string | File | FormData | null): void { if (typeof state === 'string') { try { const values: unknown = JSON.parse(state); if (Array.isArray(values)) this.values = values.filter((value): value is string => typeof value === 'string'); } catch { this.value = state; } } }
  override focus(options?: FocusOptions): void { this._input.focus(options); }
  override blur(): void { this._input.blur(); }
  private get _disabled(): boolean { return this.disabled || this._formDisabled; }
  private _setOptions(value: unknown): void {
    this._options = normalizeTree(value); this._entries.clear();
    const build = (options: HYTreeSelectOption[], parent: string | null, depth: number, disabled: boolean): HTMLElement[] => options.flatMap((option, position) => {
      const row = document.createElement('div'); row.className = 'option'; row.part.add('option'); row.id = `${this._id}-${this._entries.size}`; row.dataset.value = option.value; row.setAttribute('role', 'treeitem'); row.style.setProperty('--_depth', String(depth)); row.setAttribute('aria-level', String(depth + 1)); row.setAttribute('aria-posinset', String(position + 1)); row.setAttribute('aria-setsize', String(options.length));
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'toggle'; toggle.part.add('toggle'); toggle.tabIndex = -1; toggle.dataset.toggle = option.value; toggle.textContent = option.children?.length ? '›' : ''; toggle.setAttribute('aria-label', `Expand ${option.label}`); toggle.disabled = !option.children?.length || disabled || Boolean(option.disabled);
      const check = document.createElement('span'); check.className = 'check'; check.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.className = 'label'; label.textContent = option.label; row.append(toggle, check, label);
      const entry: TreeEntry = { option, parent, depth, disabled: disabled || Boolean(option.disabled), row, toggle }; this._entries.set(option.value, entry); if (option.expanded) this._expanded.add(option.value);
      return [row, ...build(option.children ?? [], option.value, depth + 1, entry.disabled)];
    });
    this._tree.replaceChildren(...build(this._options, null, 0, false));
  }
  private _sync(): void {
    if (this._input.disabled !== this._disabled) this._input.disabled = this._disabled;
    this._input.readOnly = !this.searchable || this.readOnly; this._control.classList.toggle('disabled', this._disabled);
    const text = this.open ? this._query : this.multiple ? '' : this._entries.get(this.values[0] ?? '')?.option.label ?? this.values[0] ?? '';
    if (this._input.value !== text) this._input.value = text;
    if (this._input.placeholder !== this.placeholder) this._input.placeholder = this.placeholder;
    this._input.setAttribute('aria-label', this.getAttribute('aria-label') || 'Tree selection');
    this._clear.hidden = !this.clearable || !this.values.length || this.readOnly; this._clear.disabled = this._disabled;
    const tagKey = JSON.stringify(this.multiple ? this.values.map(value => [value, this._entries.get(value)?.option.label ?? value]) : []);
    if (this._tags.dataset.values !== tagKey) {
      this._tags.dataset.values = tagKey;
      this._tags.replaceChildren(...(this.multiple ? this.values : []).map(value => { const tag = document.createElement('span'); tag.className = 'tag'; tag.part.add('tag'); const label = document.createElement('span'); label.className = 'tag-label'; label.textContent = this._entries.get(value)?.option.label ?? value; const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.dataset.remove = value; remove.setAttribute('aria-label', `Remove ${label.textContent}`); tag.append(label, remove); return tag; }));
    }
    for (const button of this._tags.querySelectorAll('button')) button.disabled = this._disabled || this.readOnly;
    this._syncForm(); this._render();
  }
  private _syncForm(): void {
    const name = this.getAttribute('name') ?? ''; const values = this.values;
    if (this._disabled) this._internals.setFormValue(null, JSON.stringify(values));
    else if (this.multiple) { const data = new FormData(); for (const value of values) if (name) data.append(name, value); this._internals.setFormValue(data, JSON.stringify(values)); }
    else this._internals.setFormValue(values[0] ?? '', JSON.stringify(values));
    const missing = !this._disabled && this.hasAttribute('required') && !values.length;
    this._internals.setValidity(this._disabled ? {} : this._customError ? { customError: true } : missing ? { valueMissing: true } : {}, this._disabled ? '' : this._customError || (missing ? 'Select an item' : ''), this._input);
  }
  private _render(): void {
    const query = this._query.toLocaleLowerCase(); const matches = new Set<string>();
    if (query) for (const entry of this._entries.values()) if (entry.option.label.toLocaleLowerCase().includes(query) || entry.option.value.toLocaleLowerCase().includes(query)) { let key: string | null = entry.option.value; while (key) { matches.add(key); key = this._entries.get(key)?.parent ?? null; } }
    const visible = new Set<string>(); this._visible = [];
    for (const entry of this._entries.values()) {
      const show = !this.loading && (query ? matches.has(entry.option.value) : !entry.parent || visible.has(entry.parent) && this._expanded.has(entry.parent));
      entry.row.hidden = !show; if (show) { visible.add(entry.option.value); this._visible.push(entry); }
      entry.row.setAttribute('aria-disabled', String(entry.disabled || entry.option.selectable === false && !entry.option.children?.length));
      const selected = this.values.includes(entry.option.value); entry.row.setAttribute(this.multiple ? 'aria-checked' : 'aria-selected', String(selected)); entry.row.removeAttribute(this.multiple ? 'aria-selected' : 'aria-checked');
      const check = entry.row.querySelector<HTMLElement>('.check')!; check.hidden = !this.multiple; if (check.textContent !== (selected ? '✓' : '')) check.textContent = selected ? '✓' : '';
      const expanded = Boolean(query) || this._expanded.has(entry.option.value);
      if (entry.option.children?.length) entry.row.setAttribute('aria-expanded', String(expanded)); else entry.row.removeAttribute('aria-expanded');
      const symbol = entry.option.children?.length ? expanded ? '⌄' : '›' : ''; if (entry.toggle.textContent !== symbol) entry.toggle.textContent = symbol; entry.toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${entry.option.label}`);
    }
    if (!this._visible.some(entry => entry.option.value === this._active && !entry.disabled)) this._active = this._visible.find(entry => !entry.disabled)?.option.value ?? '';
    const message = this.loading ? 'Loading…' : this.getAttribute('not-found-content') ?? 'No results'; if (this._status.textContent !== message) this._status.textContent = message; this._status.hidden = this._visible.length > 0;
    this._tree.setAttribute('aria-label', this.getAttribute('aria-label') || 'Options'); this._tree.setAttribute('aria-multiselectable', String(this.multiple)); this._tree.setAttribute('aria-busy', String(this.loading));
    const show = this.open && !this._disabled && !this.readOnly && this.isConnected; this._input.setAttribute('aria-expanded', String(show)); if (show) this._popup.show(); else this._popup.hide();
    this._syncActive();
  }
  private _syncActive(): void { for (const entry of this._entries.values()) entry.row.classList.toggle('active', entry.option.value === this._active); const active = this._entries.get(this._active); if (this.open && active && !active.row.hidden) this._input.setAttribute('aria-activedescendant', active.row.id); else this._input.removeAttribute('aria-activedescendant'); }
  private _setOpen(open: boolean): void { if (open && (this._disabled || this.readOnly)) return; if (this.open === open) return; if (!open) this._query = ''; this.toggleAttribute('open', open); this.dispatchEvent(new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true })); }
  private _emitSearch(): void { this.dispatchEvent(new CustomEvent('search', { detail: { text: this._query }, bubbles: true, composed: true })); }
  private _commit(values: string[]): void { if (this._disabled || this.readOnly) return; this.values = values; this.dispatchEvent(new CustomEvent<HYTreeSelectChangeDetail>('value-change', { detail: { value: this.value, values: this.values, options: this.values.flatMap(value => { const option = this._entries.get(value)?.option; return option ? [cloneOption(option)] : []; }) }, bubbles: true, composed: true })); this.dispatchEvent(new Event('change', { bubbles: true, composed: true })); }
  private _select(key: string): void { const entry = this._entries.get(key); if (!entry || entry.disabled || this.loading || entry.option.selectable === false) return; this._commit(this.multiple ? this.values.includes(key) ? this.values.filter(value => value !== key) : [...this.values, key] : [key]); if (!this.multiple) this._setOpen(false); }
  private _toggle(key: string, open?: boolean): void { const entry = this._entries.get(key); if (!entry?.option.children?.length || entry.disabled) return; const keys = new Set(this._expanded); if (open ?? !keys.has(key)) keys.add(key); else keys.delete(key); this.expandedKeys = [...keys]; this.dispatchEvent(new CustomEvent<HYTreeSelectExpandDetail>('expand-change', { detail: { expandedKeys: this.expandedKeys }, bubbles: true, composed: true })); }
  private _onTreeClick = (event: MouseEvent): void => { const target = event.target instanceof Element ? event.target : null; const toggle = target?.closest<HTMLElement>('[data-toggle]'); if (toggle) this._toggle(toggle.dataset.toggle!); else { const row = target?.closest<HTMLElement>('[data-value]'); if (row) { this._active = row.dataset.value!; this._select(this._active); } } };
  private _onKeydown = (event: KeyboardEvent): void => {
    if (event.isComposing || this._composing || event.keyCode === 229 || this._disabled || this.readOnly) return;
    if (event.key === 'Escape' || event.key === 'Tab') { if (this.open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); } this._setOpen(false); return; }
    const wasOpen = this.open; if (['ArrowDown', 'ArrowUp'].includes(event.key)) this._setOpen(true); if (!this.open) return;
    const entries = this._visible.filter(entry => !entry.disabled); const index = entries.findIndex(entry => entry.option.value === this._active); const current = this._entries.get(this._active); let target: TreeEntry | undefined;
    if (event.key === 'ArrowDown') target = entries[wasOpen ? (index + 1) % entries.length : 0];
    else if (event.key === 'ArrowUp') target = entries[wasOpen ? (index - 1 + entries.length) % entries.length : entries.length - 1];
    else if (event.key === 'Home' && !this._query) target = entries[0]; else if (event.key === 'End' && !this._query) target = entries.at(-1);
    else if (event.key === 'ArrowRight' && !this._query && current?.option.children?.length) { event.preventDefault(); if (!this._expanded.has(current.option.value)) this._toggle(current.option.value, true); else target = entries.find(entry => entry.parent === current.option.value); }
    else if (event.key === 'ArrowLeft' && !this._query && current) { event.preventDefault(); if (this._expanded.has(current.option.value)) this._toggle(current.option.value, false); else if (current.parent) target = this._entries.get(current.parent); }
    else if (event.key === 'Enter' && current && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); if (current.option.selectable === false) this._toggle(current.option.value); else this._select(current.option.value); }
    if (target) { event.preventDefault(); this._active = target.option.value; this._syncActive(); target.row.scrollIntoView({ block: 'nearest' }); }
  };
}
function cloneOption(option: HYTreeSelectOption): HYTreeSelectOption { return { ...option, ...(option.children ? { children: option.children.map(cloneOption) } : {}) }; }
function normalizeTree(value: unknown): HYTreeSelectOption[] {
  const keys = new Set<string>(); const visiting = new Set<unknown>();
  const visit = (items: unknown, depth: number): HYTreeSelectOption[] => !Array.isArray(items) || depth > 64 ? [] : items.flatMap(item => { if (!item || typeof item !== 'object' || typeof item.value !== 'string' || !item.value || keys.has(item.value) || visiting.has(item)) return []; keys.add(item.value); visiting.add(item); const children = visit(item.children, depth + 1); visiting.delete(item); return [{ value: item.value, label: typeof item.label === 'string' ? item.label : item.value, ...(item.disabled ? { disabled: true } : {}), ...(item.selectable === false ? { selectable: false } : {}), ...(item.expanded ? { expanded: true } : {}), ...(children.length ? { children } : {}) }]; }); return visit(value, 0);
}
export function defineTreeSelectComponents(): void { if (!customElements.get('hy-tree-select')) customElements.define('hy-tree-select', HYTreeSelect); }
