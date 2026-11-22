export interface HYMentionsOption {
  value: string;
  label?: string;
  disabled?: boolean;
}

export interface HYMentionsChangeDetail { value: string; }
export interface HYMentionsSearchDetail { text: string; prefix: string; }
export interface HYMentionsSelectDetail {
  value: string;
  option: HYMentionsOption;
  prefix: string;
}
export type HYMentionsPlacement = 'top' | 'bottom';
export type HYMentionsFilter = (text: string, option: HYMentionsOption) => boolean;

interface MentionSearch extends HYMentionsSearchDetail { start: number; end: number; }
let mentionsId = 0;

/** A multiline text input with caret-anchored mention suggestions. Registration is explicit. */
export class HYMentions extends HTMLElement {
  private readonly _textarea = document.createElement('textarea');
  private readonly _panel = document.createElement('div');
  private readonly _list = document.createElement('div');
  private readonly _status = document.createElement('div');
  private readonly _mirror = document.createElement('div');
  private readonly _marker = document.createElement('span');
  private readonly _mirrorBefore = document.createTextNode('');
  private readonly _mirrorAfter = document.createTextNode('');
  private readonly _markerText = document.createTextNode('');
  private readonly _listId = `hy-mentions-${++mentionsId}`;
  private _options: HYMentionsOption[] = [];
  private _filtered: HYMentionsOption[] = [];
  private _items: HTMLElement[] = [];
  private _visibleItems: HTMLElement[] = [];
  private _filterOption: HYMentionsFilter | false | null = null;
  private _search: MentionSearch | null = null;
  private _active = -1;
  private _dismissed = '';
  private _composing = false;
  private _committing = false;
  private _listeners: AbortController | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  static get observedAttributes(): string[] {
    return ['value', 'options', 'prefix', 'prefixes', 'split', 'placement', 'loading',
      'not-found-content', 'loading-text', 'placeholder', 'rows', 'disabled', 'readonly',
      'required', 'maxlength', 'name', 'aria-label', 'title'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; width: 100%; min-width: 0; }
      textarea {
        display: block; box-sizing: border-box; width: 100%; min-width: 0; resize: vertical;
        padding: var(--hy-space-3, 6px) var(--hy-space-4, 8px);
        border: 1px solid var(--hy-border-color, #303746);
        border-radius: var(--hy-input-radius, var(--hy-radius-sm, 4px)); outline: none;
        color: var(--hy-text-color, #d8e2f2);
        background: var(--hy-input-bg-color, var(--hy-surface-color, #121822));
        font: var(--hy-input-font, var(--hy-font-size-sm, 12px) var(--hy-font-family, system-ui, sans-serif));
        line-height: var(--hy-line-height-normal, 1.5); color-scheme: inherit;
        transition: border-color 120ms ease, box-shadow 120ms ease;
      }
      textarea:hover:not(:disabled):not(:read-only) { border-color: var(--hy-hover-border-color, #435268); }
      textarea:focus { border-color: var(--hy-focus-border-color, #3d6fa8); box-shadow: 0 0 0 2px var(--hy-focus-ring-color, rgba(61,111,168,.24)); }
      textarea:disabled { opacity: .55; cursor: not-allowed; }
      textarea:read-only { cursor: default; }
      textarea::placeholder { color: var(--hy-muted-text-color, var(--hy-muted-color, #8290a3)); }
      .panel {
        position: fixed; inset: auto; margin: 0; box-sizing: border-box;
        width: max-content; min-width: min(var(--hy-mentions-popup-min-width, 160px), calc(100vw - 16px));
        max-width: min(var(--hy-mentions-popup-max-width, 320px), calc(100vw - 16px));
        max-height: var(--hy-mentions-popup-max-height, 240px); overflow: auto;
        padding: var(--hy-space-2, 4px); border: 1px solid var(--hy-border-color, #303746);
        border-radius: var(--hy-radius-sm, 4px); color: var(--hy-text-color, #d8e2f2);
        background: var(--hy-menu-bg-color, var(--hy-surface-color, #121822));
        box-shadow: var(--hy-popup-shadow, 0 8px 24px rgba(0,0,0,.24));
        font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif);
        z-index: var(--hy-mentions-z-index, 1050);
      }
      [hidden] { display: none !important; }
      .option { padding: var(--hy-space-3, 6px) var(--hy-space-4, 8px); border-radius: var(--hy-radius-xs, 2px); cursor: pointer; overflow-wrap: anywhere; }
      .option[aria-selected="true"] { color: var(--hy-selected-text-color, #fff); background: var(--hy-selected-bg-color, #255a91); }
      .option[aria-disabled="true"] { color: var(--hy-disabled-text-color, #65738a); cursor: not-allowed; }
      .status { padding: var(--hy-space-3, 6px) var(--hy-space-4, 8px); color: var(--hy-muted-text-color, var(--hy-muted-color, #8290a3)); }
      .mirror { position: fixed; top: 0; left: 0; visibility: hidden; pointer-events: none; white-space: pre-wrap; overflow-wrap: break-word; overflow: hidden; }
      @media (prefers-reduced-motion: reduce) { textarea { transition: none; } }
    `;
    this._textarea.part.add('textarea');
    this._textarea.setAttribute('role', 'combobox');
    this._textarea.setAttribute('aria-autocomplete', 'list');
    this._textarea.setAttribute('aria-haspopup', 'listbox');
    this._textarea.setAttribute('aria-multiline', 'true');
    this._textarea.setAttribute('aria-expanded', 'false');
    this._textarea.setAttribute('aria-controls', this._listId);
    this._panel.className = 'panel'; this._panel.part.add('panel'); this._panel.hidden = true;
    this._panel.setAttribute('popover', 'manual');
    this._list.id = this._listId; this._list.part.add('list'); this._list.setAttribute('role', 'listbox');
    this._status.className = 'status'; this._status.part.add('status'); this._status.setAttribute('role', 'status');
    this._mirror.className = 'mirror'; this._mirror.setAttribute('aria-hidden', 'true');
    // Keep text nodes stable: replacing them during input splits Chromium's native undo group.
    this._marker.append(this._markerText);
    this._mirror.append(this._mirrorBefore, this._marker, this._mirrorAfter);
    this._panel.append(this._list, this._status);
    root.append(style, this._textarea, this._panel, this._mirror);
  }

  connectedCallback(): void {
    this._listeners?.abort();
    const controller = new AbortController(); this._listeners = controller;
    const { signal } = controller;
    this._textarea.addEventListener('input', this._onInput, { signal });
    this._textarea.addEventListener('keydown', this._onKeydown, { signal });
    this._textarea.addEventListener('click', this._onCaretChange, { signal });
    this._textarea.addEventListener('select', this._onCaretChange, { signal });
    this._textarea.addEventListener('keyup', this._onCaretKeyup, { signal });
    this._textarea.addEventListener('scroll', this._positionPanel, { signal });
    this._textarea.addEventListener('focus', this._onFocus, { signal });
    this._textarea.addEventListener('blur', this._onBlur, { signal });
    this._textarea.addEventListener('compositionstart', this._onCompositionStart, { signal });
    this._textarea.addEventListener('compositionend', this._onCompositionEnd, { signal });
    this._panel.addEventListener('pointerdown', this._onPanelPointerDown, { signal });
    this._panel.addEventListener('pointermove', this._onPanelPointerMove, { signal });
    this._panel.addEventListener('click', this._onPanelClick, { signal });
    this.ownerDocument.addEventListener('pointerdown', this._onOutsidePointerDown, { capture: true, signal });
    this.ownerDocument.addEventListener('scroll', this._onScroll, { capture: true, signal });
    this.ownerDocument.defaultView?.addEventListener('resize', this._positionPanel, { signal });
    this._resizeObserver = new ResizeObserver(this._positionPanel);
    this._resizeObserver.observe(this._textarea);
    this._sync();
  }

  disconnectedCallback(): void {
    this._listeners?.abort(); this._listeners = null;
    this._resizeObserver?.disconnect(); this._resizeObserver = null;
    this._composing = false; this._dismissed = ''; this._close();
    this._mirrorBefore.data = this._markerText.data = this._mirrorAfter.data = '';
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === 'options') {
      let parsed: unknown = [];
      try { parsed = JSON.parse(newValue ?? '[]'); } catch { /* Invalid JSON means no options. */ }
      this._setOptions(parsed);
    }
    this._sync();
    if (!this._committing) this._refreshSearch();
  }

  get value(): string { return this.getAttribute('value') ?? ''; }
  set value(value: string) { this.setAttribute('value', String(value ?? '')); }
  get options(): HYMentionsOption[] { return this._options.map(option => ({ ...option })); }
  set options(value: HYMentionsOption[]) { this._setOptions(value); this._refreshSearch(); }
  get prefix(): string { return this.getAttribute('prefix') || '@'; }
  set prefix(value: string) { this.removeAttribute('prefixes'); this.setAttribute('prefix', String(value)); }
  get prefixes(): string[] {
    try {
      const parsed: unknown = JSON.parse(this.getAttribute('prefixes') ?? 'null');
      if (Array.isArray(parsed)) {
        const values = parsed.filter((item): item is string => typeof item === 'string' && item.length > 0 && !/\s/u.test(item));
        if (values.length) return [...new Set(values)];
      }
    } catch { /* Fall back to the single prefix. */ }
    return [this.prefix];
  }
  set prefixes(value: string[]) { this.setAttribute('prefixes', JSON.stringify(value)); }
  get split(): string { return this.getAttribute('split') ?? ' '; }
  set split(value: string) { this.setAttribute('split', String(value)); }
  get placement(): HYMentionsPlacement { return this.getAttribute('placement') === 'top' ? 'top' : 'bottom'; }
  set placement(value: HYMentionsPlacement) { this.setAttribute('placement', value); }
  get loading(): boolean { return this.hasAttribute('loading'); }
  set loading(value: boolean) { this.toggleAttribute('loading', Boolean(value)); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }
  get readOnly(): boolean { return this.hasAttribute('readonly'); }
  set readOnly(value: boolean) { this.toggleAttribute('readonly', Boolean(value)); }
  get placeholder(): string { return this.getAttribute('placeholder') ?? ''; }
  set placeholder(value: string) { this.setAttribute('placeholder', String(value)); }
  get rows(): number { const value = Number(this.getAttribute('rows')); return Number.isInteger(value) && value > 0 ? Math.min(value, 1000) : 3; }
  set rows(value: number) { this.setAttribute('rows', String(value)); }
  get notFoundContent(): string { return this.getAttribute('not-found-content') ?? 'No results'; }
  set notFoundContent(value: string) { this.setAttribute('not-found-content', String(value)); }
  get loadingText(): string { return this.getAttribute('loading-text') ?? 'Loading…'; }
  set loadingText(value: string) { this.setAttribute('loading-text', String(value)); }
  get filterOption(): HYMentionsFilter | false | null { return this._filterOption; }
  set filterOption(value: HYMentionsFilter | false | null) { this._filterOption = value; this._refreshSearch(); }
  get open(): boolean { return !this._panel.hidden; }

  override focus(options?: FocusOptions): void { this._textarea.focus(options); }
  override blur(): void { this._textarea.blur(); }

  private _sync(): void {
    if (this._textarea.value !== this.value) this._textarea.value = this.value;
    if (this._textarea.disabled !== this.disabled) this._textarea.disabled = this.disabled;
    if (this._textarea.readOnly !== this.readOnly) this._textarea.readOnly = this.readOnly;
    if (this._textarea.rows !== this.rows) this._textarea.rows = this.rows;
    if (this._textarea.required !== this.hasAttribute('required')) this._textarea.required = this.hasAttribute('required');
    for (const name of ['placeholder', 'maxlength', 'name', 'aria-label', 'title']) {
      const value = this.getAttribute(name);
      if (value === null) { if (this._textarea.hasAttribute(name)) this._textarea.removeAttribute(name); }
      else if (this._textarea.getAttribute(name) !== value) this._textarea.setAttribute(name, value);
    }
    this._list.setAttribute('aria-label', this.getAttribute('aria-label') || 'Mention suggestions');
  }

  private _findSearch(): MentionSearch | null {
    if (!this.isConnected || this.disabled || this.readOnly || this._composing || this.shadowRoot?.activeElement !== this._textarea) return null;
    const end = this._textarea.selectionStart;
    if (end !== this._textarea.selectionEnd) return null;
    const before = this._textarea.value.slice(0, end);
    let found: MentionSearch | null = null;
    for (const prefix of this.prefixes) {
      const start = before.lastIndexOf(prefix);
      if (start < 0 || (start > 0 && !/\s/u.test(before[start - 1]!) && !(this.split && before.slice(0, start).endsWith(this.split)))) continue;
      const text = before.slice(start + prefix.length);
      if (/\s/u.test(text) || (this.split && text.includes(this.split))) continue;
      if (!found || start > found.start || (start === found.start && prefix.length > found.prefix.length)) found = { start, end, text, prefix };
    }
    return found;
  }

  private _refreshSearch = (): void => {
    const next = this._findSearch();
    if (!next || searchKey(next) === this._dismissed) { this._close(); return; }
    const previous = this._search;
    const changed = !previous || searchKey(next) !== searchKey(previous);
    this._search = next;
    if (changed) {
      this._active = -1;
      // Update identity before dispatch: consumers can synchronously replace options or set loading.
      this.dispatchEvent(new CustomEvent<HYMentionsSearchDetail>('search', {
        detail: { text: next.text, prefix: next.prefix }, bubbles: true, composed: true,
      }));
      if (this._search !== next || !this._findSearch()) return;
    }
    this._renderSuggestions();
  };

  private _renderSuggestions(): void {
    const search = this._search; if (!search) return;
    const activeValue = this._filtered[this._active]?.value;
    const filter = this._filterOption;
    this._filtered = this.loading ? [] : this._options.filter(option => filter === false || (filter
      ? filter(search.text, { ...option })
      : `${option.value}\n${option.label ?? ''}`.toLocaleLowerCase().includes(search.text.toLocaleLowerCase())));
    this._active = activeValue === undefined ? -1 : this._filtered.findIndex(option => option.value === activeValue && !option.disabled);
    if (this._active < 0) this._active = this._filtered.findIndex(option => !option.disabled);
    const indices = new Map(this._filtered.map((option, index) => [option, index]));
    this._visibleItems = [];
    this._items.forEach((item, index) => {
      const filteredIndex = indices.get(this._options[index]!);
      item.hidden = filteredIndex === undefined;
      item.dataset.index = String(filteredIndex ?? -1);
      if (filteredIndex !== undefined) this._visibleItems.push(item);
    });
    const message = this.loading ? this.loadingText : this.notFoundContent;
    if (this._status.textContent !== message) this._status.textContent = message;
    this._status.hidden = this._filtered.length > 0;
    this._list.setAttribute('aria-busy', String(this.loading));
    this._panel.hidden = false;
    if (this._panel.showPopover && !this._panel.matches(':popover-open')) this._panel.showPopover();
    this._textarea.setAttribute('aria-expanded', 'true');
    this._syncActive(); this._positionPanel();
  }

  private _setOptions(value: unknown): void {
    const options = normalizeOptions(value);
    if (options.length === this._options.length && options.every((option, index) => {
      const previous = this._options[index]!;
      return option.value === previous.value && option.label === previous.label && option.disabled === previous.disabled;
    })) return;
    this._options = options;
    this._items = this._options.map((option, index) => {
      const item = document.createElement('div'); item.className = 'option'; item.part.add('option');
      item.id = `${this._listId}-${index}`; item.hidden = true;
      item.setAttribute('role', 'option'); item.setAttribute('aria-disabled', String(Boolean(option.disabled)));
      item.textContent = option.label ?? option.value; return item;
    });
    this._list.replaceChildren(...this._items);
  }

  private _syncActive(): void {
    for (const item of this._items) item.setAttribute('aria-selected', String(!item.hidden && Number(item.dataset.index) === this._active));
    const active = this._visibleItems[this._active];
    if (!active) this._textarea.removeAttribute('aria-activedescendant');
    else this._textarea.setAttribute('aria-activedescendant', active.id);
  }

  private _close(): void {
    if (this._panel.hidePopover && this._panel.matches(':popover-open')) this._panel.hidePopover();
    this._panel.hidden = true; this._search = null; this._active = -1; this._filtered = [];
    this._textarea.setAttribute('aria-expanded', 'false'); this._textarea.removeAttribute('aria-activedescendant');
    this._visibleItems = [];
  }

  private _positionPanel = (): void => {
    if (!this.open || !this._search) return;
    const view = this.ownerDocument.defaultView; if (!view) return;
    const rect = this._textarea.getBoundingClientRect();
    const computed = view.getComputedStyle(this._textarea);
    // Mirror the native textarea so wrapped lines, proportional fonts and scrolling share the caret position.
    for (const property of ['box-sizing', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
      'letter-spacing', 'text-transform', 'text-indent', 'text-align', 'direction', 'tab-size',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width',
      'border-right-width', 'border-bottom-width', 'border-left-width', 'border-style']) {
      this._mirror.style.setProperty(property, computed.getPropertyValue(property));
    }
    // Exclude a vertical scrollbar from the mirror's text layout.
    this._mirror.style.width = `${this._textarea.clientWidth + parseFloat(computed.borderLeftWidth) + parseFloat(computed.borderRightWidth)}px`;
    this._mirrorBefore.data = this._textarea.value.slice(0, this._search.end);
    this._markerText.data = this._textarea.value[this._search.end] || '\u200b';
    this._mirrorAfter.data = this._textarea.value.slice(this._search.end + 1);
    const marker = this._marker.getBoundingClientRect();
    const mirror = this._mirror.getBoundingClientRect();
    const x = rect.left + marker.left - mirror.left - this._textarea.scrollLeft;
    const y = rect.top + marker.top - mirror.top - this._textarea.scrollTop;
    const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.5;
    if (y + lineHeight < rect.top || y > rect.bottom || rect.bottom < 0 || rect.top > view.innerHeight) { this._close(); return; }
    this._panel.style.maxHeight = '';
    const panelHeight = this._panel.getBoundingClientRect().height;
    const below = view.innerHeight - (y + lineHeight) - 8;
    const above = y - 8;
    const top = this.placement === 'top' ? above >= panelHeight || above > below : below < panelHeight && above > below;
    this._panel.style.maxHeight = `${Math.max(0, Math.min(parseFloat(view.getComputedStyle(this._panel).maxHeight) || 240, top ? above - 4 : below - 4))}px`;
    const bounds = this._panel.getBoundingClientRect();
    this._panel.style.left = `${Math.max(8, Math.min(x, view.innerWidth - bounds.width - 8))}px`;
    this._panel.style.top = `${Math.max(8, top ? y - bounds.height - 4 : y + lineHeight + 4)}px`;
  };

  private _commit(index: number): void {
    const search = this._search; const option = this._filtered[index];
    if (!search || !option || option.disabled || this.disabled || this.readOnly || this.loading) return;
    let end = search.end;
    const text = this._textarea.value;
    while (end < text.length && !/\s/u.test(text[end]!) && !(this.split && text.startsWith(this.split, end))) end++;
    if (this.split && text.startsWith(this.split, end)) end += this.split.length;
    const insertion = `${search.prefix}${option.value}${this.split}`;
    const next = text.slice(0, search.start) + insertion + text.slice(end);
    const maxLength = this._textarea.maxLength;
    if (maxLength >= 0 && next.length > maxLength) return;
    this._committing = true;
    try {
      this._textarea.setRangeText(insertion, search.start, end, 'end');
      this.value = this._textarea.value;
      this._dismissed = searchKey(this._findSearch());
      this._close(); this._textarea.focus();
      this._textarea.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText', data: insertion }));
      this.dispatchEvent(new CustomEvent<HYMentionsSelectDetail>('mention-select', {
        detail: { value: this.value, option: { ...option }, prefix: search.prefix }, bubbles: true, composed: true,
      }));
    } finally { this._committing = false; }
  }

  private _onInput = (): void => {
    this.value = this._textarea.value;
    this.dispatchEvent(new CustomEvent<HYMentionsChangeDetail>('value-change', { detail: { value: this.value }, bubbles: true, composed: true }));
    if (!this._committing) { this._dismissed = ''; this._refreshSearch(); }
  };
  private _onFocus = (): void => { this._dismissed = ''; this._refreshSearch(); };
  private _onBlur = (): void => { this._close(); };
  private _onCaretChange = (): void => { if (!this._committing) this._refreshSearch(); };
  private _onCaretKeyup = (event: KeyboardEvent): void => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) this._refreshSearch(); };
  private _onCompositionStart = (): void => { this._composing = true; this._close(); };
  private _onCompositionEnd = (): void => { this._composing = false; this._dismissed = ''; this._refreshSearch(); };
  private _onKeydown = (event: KeyboardEvent): void => {
    if (event.isComposing || this._composing || event.keyCode === 229 || !this.open) return;
    if (event.key === 'Escape' || event.key === 'Tab') {
      this._dismissed = searchKey(this._search); this._close();
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const enabled = this._filtered.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
      if (!enabled.length) return;
      event.preventDefault(); event.stopPropagation();
      const current = enabled.indexOf(this._active);
      this._active = enabled[(current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]!;
      this._syncActive(); this._visibleItems[this._active]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && this._active >= 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); event.stopPropagation(); this._commit(this._active);
    }
  };
  private _optionIndex(event: Event): number {
    const item = event.target instanceof Element ? event.target.closest<HTMLElement>('.option') : null;
    return item ? Number(item.dataset.index) : -1;
  }
  private _onPanelPointerDown = (event: PointerEvent): void => { event.preventDefault(); };
  private _onPanelPointerMove = (event: PointerEvent): void => {
    const index = this._optionIndex(event);
    if (index >= 0 && !this._filtered[index]?.disabled) { this._active = index; this._syncActive(); }
  };
  private _onPanelClick = (event: MouseEvent): void => { this._commit(this._optionIndex(event)); };
  private _onOutsidePointerDown = (event: PointerEvent): void => { if (!event.composedPath().includes(this)) this._close(); };
  private _onScroll = (event: Event): void => { if (!event.composedPath().includes(this._panel)) this._positionPanel(); };
}

export function defineMentionsComponents(): void {
  if (!customElements.get('hy-mentions')) customElements.define('hy-mentions', HYMentions);
}

function normalizeOptions(value: unknown): HYMentionsOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is HYMentionsOption => Boolean(item) && typeof item === 'object' && typeof item.value === 'string' && item.value.length > 0)
    .map(item => ({ value: item.value, ...(typeof item.label === 'string' ? { label: item.label } : {}), ...(item.disabled ? { disabled: true } : {}) }));
}

function searchKey(search: MentionSearch | null): string { return search ? JSON.stringify([search.start, search.end, search.prefix, search.text]) : ''; }
