export type HYInputType = 'text' | 'number' | 'color' | 'search';
export type HYInputSearchSource = 'enter' | 'button' | 'api';

export interface HYInputChangeDetail {
  value: string;
  valueAsNumber: number | null;
  valid: boolean;
}

export interface HYInputSearchDetail {
  value: string;
  valid: boolean;
  source: HYInputSearchSource;
}

export class HYInput extends HTMLElement {
  private readonly _control = document.createElement('div');
  private readonly _prefix = document.createElement('span');
  private readonly _prefixSlot = document.createElement('slot');
  private readonly _prefixText = document.createElement('span');
  private readonly _input = document.createElement('input');
  private readonly _suffix = document.createElement('span');
  private readonly _suffixSlot = document.createElement('slot');
  private readonly _suffixText = document.createElement('span');
  private readonly _searchButton = document.createElement('button');

  static get observedAttributes(): string[] {
    return [
      'type', 'value', 'min', 'max', 'step', 'placeholder', 'disabled', 'readonly',
      'required', 'name', 'autocomplete', 'aria-label', 'title', 'prefix', 'suffix',
      'search-label',
    ];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; width: 100%; min-width: 0; }
      .control {
        display: flex;
        width: 100%;
        min-width: 0;
        height: var(--hy-input-height, 28px);
        box-sizing: border-box;
        align-items: stretch;
        overflow: hidden;
        border: 1px solid var(--hy-border-color, #303746);
        border-radius: var(--hy-input-radius, 4px);
        color: var(--hy-text-color, #d8e2f2);
        background: var(--hy-input-bg-color, var(--hy-surface-color, #121822));
        transition: border-color 120ms ease, box-shadow 120ms ease;
      }
      .control:hover:not(.disabled):not(.readonly) { border-color: var(--hy-hover-border-color, #435268); }
      .control:focus-within { border-color: var(--hy-focus-border-color, #3d6fa8); box-shadow: 0 0 0 2px var(--hy-focus-ring-color, rgba(61, 111, 168, 0.24)); }
      .control.invalid { border-color: var(--hy-invalid-border-color, #b64f62); }
      .control.disabled, .control.readonly { opacity: 0.55; }
      input {
        flex: 1 1 auto;
        width: 0;
        min-width: 0;
        box-sizing: border-box;
        padding: 0 var(--hy-input-padding-inline, 8px);
        border: 0;
        outline: none;
        color: inherit;
        background: transparent;
        font: var(--hy-input-font, 12px system-ui, sans-serif);
        color-scheme: inherit;
      }
      input:disabled, input:read-only { cursor: default; }
      input[type="color"] { min-width: 42px; padding: 3px; cursor: pointer; }
      input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
      input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 2px; }
      input[type="search"]::-webkit-search-cancel-button { cursor: pointer; }
      .affix {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        max-width: 42%;
        padding-inline: var(--hy-input-affix-padding, 8px);
        overflow: hidden;
        color: var(--hy-input-affix-color, var(--hy-muted-text-color, #8290a3));
        font: var(--hy-input-affix-font, 12px system-ui, sans-serif);
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .prefix { padding-right: 0; }
      .suffix { padding-left: 0; }
      .affix[hidden], .search-button[hidden] { display: none; }
      .search-button {
        display: grid;
        flex: 0 0 var(--hy-input-search-button-width, 32px);
        width: var(--hy-input-search-button-width, 32px);
        padding: 0;
        place-items: center;
        border: 0;
        border-left: 1px solid var(--hy-border-color, #303746);
        color: var(--hy-input-search-color, var(--hy-accent-color, #79a8ff));
        background: var(--hy-input-search-bg, color-mix(in srgb, var(--hy-accent-color, #79a8ff) 11%, transparent));
        cursor: pointer;
        font: 16px/1 system-ui, sans-serif;
      }
      .search-button:hover:not(:disabled) { background: var(--hy-input-search-hover-bg, color-mix(in srgb, var(--hy-accent-color, #79a8ff) 20%, transparent)); }
      .search-button:focus-visible { outline: 2px solid var(--hy-focus-border-color, #3d6fa8); outline-offset: -3px; }
      .search-button:disabled { cursor: default; }
      @media (prefers-reduced-motion: reduce) { .control { transition: none; } }
    `;

    this._control.className = 'control';
    this._control.part.add('control');
    this._prefix.className = 'affix prefix';
    this._prefix.part.add('prefix');
    this._prefixSlot.name = 'prefix';
    this._prefixText.className = 'affix-text';
    this._prefix.append(this._prefixSlot, this._prefixText);
    this._input.part.add('input');
    this._suffix.className = 'affix suffix';
    this._suffix.part.add('suffix');
    this._suffixSlot.name = 'suffix';
    this._suffixText.className = 'affix-text';
    this._suffix.append(this._suffixSlot, this._suffixText);
    this._searchButton.className = 'search-button';
    this._searchButton.type = 'button';
    this._searchButton.part.add('search-button');
    this._searchButton.textContent = '⌕';
    this._control.append(this._prefix, this._input, this._suffix, this._searchButton);
    root.append(style, this._control);
  }

  connectedCallback(): void {
    this._input.addEventListener('input', this._onInput);
    this._input.addEventListener('change', this._onChange);
    this._input.addEventListener('keydown', this._onKeydown);
    this._searchButton.addEventListener('click', this._onSearchClick);
    this._prefixSlot.addEventListener('slotchange', this._onSlotChange);
    this._suffixSlot.addEventListener('slotchange', this._onSlotChange);
    this._sync();
  }

  disconnectedCallback(): void {
    this._input.removeEventListener('input', this._onInput);
    this._input.removeEventListener('change', this._onChange);
    this._input.removeEventListener('keydown', this._onKeydown);
    this._searchButton.removeEventListener('click', this._onSearchClick);
    this._prefixSlot.removeEventListener('slotchange', this._onSlotChange);
    this._suffixSlot.removeEventListener('slotchange', this._onSlotChange);
  }

  attributeChangedCallback(): void { this._sync(); }

  get type(): HYInputType { return normalizedType(this.getAttribute('type')); }
  set type(value: HYInputType) { this.setAttribute('type', normalizedType(value)); }

  get value(): string { return this.getAttribute('value') ?? ''; }
  set value(value: string) {
    this.setAttribute('value', String(value));
    this._input.value = String(value);
    this._syncValidity();
  }

  get valueAsNumber(): number { return this._input.valueAsNumber; }

  get prefix(): string { return this.getAttribute('prefix') ?? ''; }
  set prefix(value: string) { this._setOptionalAttribute('prefix', value); }

  get suffix(): string { return this.getAttribute('suffix') ?? ''; }
  set suffix(value: string) { this._setOptionalAttribute('suffix', value); }

  get searchLabel(): string { return this.getAttribute('search-label')?.trim() || 'Search'; }
  set searchLabel(value: string) { this._setOptionalAttribute('search-label', value); }

  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', value); }

  get readOnly(): boolean { return this.hasAttribute('readonly'); }
  set readOnly(value: boolean) { this.toggleAttribute('readonly', value); }

  get valid(): boolean { return this._input.validity.valid; }

  override focus(options?: FocusOptions): void { this._input.focus(options); }
  select(): void { this._input.select(); }
  search(): boolean { return this._emitSearch('api'); }

  private _sync(): void {
    const type = this.type;
    if (this._input.type !== type) this._input.type = type;
    const value = this.value;
    if (this._input.value !== value) this._input.value = type === 'color' && !/^#[0-9a-f]{6}$/iu.test(value) ? '#000000' : value;
    for (const name of ['min', 'max', 'step', 'placeholder', 'name', 'autocomplete', 'aria-label', 'title']) {
      const attribute = this.getAttribute(name);
      if (attribute === null) this._input.removeAttribute(name);
      else this._input.setAttribute(name, attribute);
    }
    this._input.disabled = this.disabled;
    this._input.readOnly = this.readOnly;
    this._input.required = this.hasAttribute('required');
    this._searchButton.hidden = type !== 'search';
    this._searchButton.disabled = this.disabled;
    this._searchButton.setAttribute('aria-label', this.searchLabel);
    this._control.classList.toggle('disabled', this.disabled);
    this._control.classList.toggle('readonly', this.readOnly);
    this._syncAffixes();
    this._syncValidity();
  }

  private _syncAffixes(): void {
    this._syncAffix(this._prefix, this._prefixSlot, this._prefixText, this.prefix);
    this._syncAffix(this._suffix, this._suffixSlot, this._suffixText, this.suffix);
  }

  private _syncAffix(container: HTMLElement, slot: HTMLSlotElement, fallback: HTMLElement, text: string): void {
    const hasAssignedContent = slot.assignedNodes({ flatten: true }).some(node => node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()));
    fallback.textContent = hasAssignedContent ? '' : text;
    fallback.hidden = hasAssignedContent || !text;
    container.hidden = !hasAssignedContent && !text;
  }

  private _syncValidity(): void { this._control.classList.toggle('invalid', !this.valid); }

  private _setOptionalAttribute(name: string, value: string): void {
    const normalized = String(value ?? '').trim();
    if (normalized) this.setAttribute(name, normalized);
    else this.removeAttribute(name);
  }

  private _onSlotChange = (): void => { this._syncAffixes(); };

  private _onInput = (): void => {
    this.setAttribute('value', this._input.value);
    this._syncValidity();
  };

  private _onChange = (): void => {
    this.setAttribute('value', this._input.value);
    const number = this.type === 'number' && Number.isFinite(this._input.valueAsNumber) ? this._input.valueAsNumber : null;
    this.dispatchEvent(new CustomEvent<HYInputChangeDetail>('value-change', {
      detail: { value: this._input.value, valueAsNumber: number, valid: this.valid },
      bubbles: true,
      composed: true,
    }));
  };

  private _onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && this.type === 'search' && !event.isComposing) this._emitSearch('enter');
  };

  private _onSearchClick = (): void => { this._emitSearch('button'); };

  private _emitSearch(source: HYInputSearchSource): boolean {
    if (this.disabled || this.type !== 'search') return false;
    return this.dispatchEvent(new CustomEvent<HYInputSearchDetail>('search', {
      detail: { value: this._input.value, valid: this.valid, source },
      bubbles: true,
      composed: true,
      cancelable: true,
    }));
  }
}

export function defineInputComponents(): void {
  if (!customElements.get('hy-input')) customElements.define('hy-input', HYInput);
}

function normalizedType(value: string | null): HYInputType {
  return value === 'number' || value === 'color' || value === 'search' ? value : 'text';
}
