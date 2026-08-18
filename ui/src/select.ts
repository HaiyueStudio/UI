export interface GESelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface GESelectChangeDetail {
  value: string;
  option: GESelectOption | null;
}

export class GESelect extends HTMLElement {
  private readonly _wrap = document.createElement('div');
  private readonly _search = document.createElement('input');
  private readonly _select = document.createElement('select');
  private _options: GESelectOption[] = [];
  private _filterText = '';

  static get observedAttributes(): string[] {
    return ['options', 'value', 'disabled', 'searchable', 'aria-label', 'label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }
      .wrap {
        display: grid;
        gap: 4px;
        width: 100%;
        min-width: 0;
      }
      input,
      select {
        box-sizing: border-box;
        width: 100%;
        height: 28px;
        min-width: 0;
        padding: 0 28px 0 8px;
        border: 1px solid var(--ge-border-color, #303746);
        border-radius: 4px;
        color: var(--ge-text-color, #d8e2f2);
        background-color: var(--ge-input-bg-color, var(--ge-surface-color, #121822));
        font: 12px system-ui, sans-serif;
        outline: none;
        color-scheme: dark;
      }
      select {
        appearance: none;
        cursor: pointer;
        background-image:
          linear-gradient(45deg, transparent 50%, var(--ge-select-arrow-color, var(--ge-secondary-text-color, #8fa7c8)) 50%),
          linear-gradient(135deg, var(--ge-select-arrow-color, var(--ge-secondary-text-color, #8fa7c8)) 50%, transparent 50%);
        background-position:
          calc(100% - 15px) 11px,
          calc(100% - 10px) 11px;
        background-size: 5px 5px, 5px 5px;
        background-repeat: no-repeat;
      }
      select:hover:not(:disabled) {
        border-color: var(--ge-hover-border-color, #435268);
        background-color: var(--ge-select-hover-bg-color, var(--ge-input-bg-color, #151d2a));
      }
      option {
        min-height: 28px;
        padding: 6px 8px;
        color: var(--ge-select-option-text-color, var(--ge-text-color, #d8e2f2));
        background: var(--ge-select-option-bg-color, var(--ge-menu-bg-color, #1b2230));
        font: 12px system-ui, sans-serif;
      }
      option:checked {
        color: var(--ge-select-option-selected-text-color, var(--ge-selected-text-color, #ffffff));
        background: var(--ge-select-option-selected-bg-color, var(--ge-selected-bg-color, #255a91));
      }
      option:disabled {
        color: var(--ge-disabled-text-color, #65738a);
        background: var(--ge-select-option-bg-color, var(--ge-menu-bg-color, #1b2230));
      }
      input {
        display: none;
      }
      :host([searchable]) input {
        display: block;
      }
      input:focus,
      select:focus {
        border-color: var(--ge-focus-border-color, #3d6fa8);
        box-shadow: 0 0 0 2px var(--ge-focus-ring-color, rgba(61, 111, 168, 0.24));
      }
      input:disabled,
      select:disabled {
        opacity: 0.55;
        cursor: default;
        background-image: none;
      }
    `;
    this._wrap.className = 'wrap';
    this._search.type = 'search';
    this._search.placeholder = 'Search...';
    this._wrap.append(this._search, this._select);
    root.append(style, this._wrap);
  }

  connectedCallback(): void {
    this._select.addEventListener('change', this._onChange);
    this._search.addEventListener('input', this._onSearchInput);
    this._syncFromAttributes();
    this._render();
  }

  disconnectedCallback(): void {
    this._select.removeEventListener('change', this._onChange);
    this._search.removeEventListener('input', this._onSearchInput);
    this._filterText = '';
    this._search.value = '';
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'options') this._readOptionsAttribute();
    if (name === 'value') this._select.value = newValue ?? '';
    if (name === 'disabled' || name === 'searchable') this._syncDisabled();
    if (name === 'aria-label' || name === 'label') this._syncAriaLabel();
    if (name === 'options' || name === 'searchable') this._render();
  }

  get options(): GESelectOption[] {
    return this._options;
  }

  set options(value: GESelectOption[]) {
    this._options = Array.isArray(value) ? value : [];
    this._render();
  }

  get value(): string {
    return this.getAttribute('value') ?? '';
  }

  set value(value: string) {
    this.setAttribute('value', value);
    this._select.value = value;
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }

  set disabled(value: boolean) {
    if (value) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get searchable(): boolean {
    return this.hasAttribute('searchable');
  }

  set searchable(value: boolean) {
    if (value) this.setAttribute('searchable', '');
    else this.removeAttribute('searchable');
  }

  get label(): string {
    return this.getAttribute('label') ?? '';
  }

  set label(value: string) {
    if (value) this.setAttribute('label', value);
    else this.removeAttribute('label');
  }

  private _syncFromAttributes(): void {
    // Dynamic consumers commonly assign `options` before appending the element.
    // Do not erase that programmatic state merely because no attribute exists.
    if (this.hasAttribute('options')) this._readOptionsAttribute();
    this._select.value = this.value;
    this._syncDisabled();
    this._syncAriaLabel();
  }

  private _readOptionsAttribute(): void {
    const raw = this.getAttribute('options');
    if (!raw) {
      this._options = [];
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      this._options = Array.isArray(parsed)
        ? parsed.map((item) => ({
            label: String(item.label ?? item.value ?? ''),
            value: String(item.value ?? item.label ?? ''),
            disabled: Boolean(item.disabled),
          }))
        : [];
    } catch (error) {
      console.warn('Invalid ge-select options attribute.', error);
    }
  }

  private _render(): void {
    this._select.replaceChildren();
    const visibleOptions = this.searchable && this._filterText
      ? this._options.filter(item => this._matchesFilter(item, this._filterText))
      : this._options;
    for (const item of visibleOptions) {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      option.disabled = Boolean(item.disabled);
      this._select.append(option);
    }
    this._select.value = this.value;
    this._syncDisabled();
  }

  private _syncDisabled(): void {
    this._select.disabled = this.disabled;
    this._search.disabled = this.disabled;
  }

  private _syncAriaLabel(): void {
    const label = this.getAttribute('aria-label') ?? this.getAttribute('label') ?? '';
    if (label) {
      this._select.setAttribute('aria-label', label);
      this._search.setAttribute('aria-label', `${label} search`);
    } else {
      this._select.removeAttribute('aria-label');
      this._search.removeAttribute('aria-label');
    }
  }

  private _matchesFilter(option: GESelectOption, filter: string): boolean {
    const haystack = `${option.label} ${option.value}`.toLowerCase();
    const needle = filter.trim().toLowerCase();
    if (!needle) return true;
    let index = 0;
    for (const char of needle) {
      index = haystack.indexOf(char, index);
      if (index < 0) return false;
      index++;
    }
    return true;
  }

  private _onChange = (): void => {
    this.value = this._select.value;
    const option = this._options.find(item => item.value === this.value) ?? null;
    this.dispatchEvent(new CustomEvent<GESelectChangeDetail>('value-change', {
      detail: { value: this.value, option },
      bubbles: true,
      composed: true,
    }));
  };

  private _onSearchInput = (): void => {
    this._filterText = this._search.value;
    this._render();
  };
}

export function defineSelectComponents(): void {
  if (!customElements.get('ge-select')) {
    customElements.define('ge-select', GESelect);
  }
}
