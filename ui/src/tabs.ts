export interface GETabOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface GETabChangeDetail {
  value: string;
  option: GETabOption | null;
}

export class GETabs extends HTMLElement {
  private readonly _style = document.createElement('style');
  private readonly _tabs = document.createElement('div');
  private readonly _panels = document.createElement('div');
  private _options: GETabOption[] = [];

  static get observedAttributes(): string[] {
    return ['options', 'value'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this._style.textContent = `
      :host {
        box-sizing: border-box;
        display: grid;
        grid-template-rows: 32px minmax(0, 1fr);
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        color: var(--ge-text-color, #d8e2f2);
        background: var(--ge-panel-bg-color, #171d28);
        font: 12px system-ui, sans-serif;
      }
      .tabs {
        display: flex;
        align-items: end;
        gap: 2px;
        min-width: 0;
        padding: 4px 6px 0;
        border-bottom: 1px solid var(--ge-border-color, #303746);
        background: var(--ge-tabs-bar-bg-color, var(--ge-menu-bg-color, var(--ge-surface-elevated-color, #1b2230)));
      }
      button {
        height: 28px;
        min-width: 0;
        padding: 0 10px;
        border: 1px solid transparent;
        border-bottom: 0;
        border-radius: 4px 4px 0 0;
        color: var(--ge-secondary-text-color, #8fa7c8);
        background: transparent;
        font: inherit;
        cursor: pointer;
      }
      button:hover {
        color: var(--ge-text-color, #d8e2f2);
        background: var(--ge-hover-bg-color, #222b3a);
      }
      button.active {
        color: var(--ge-active-text-color, #eef3ff);
        border-color: var(--ge-border-color, #303746);
        background: var(--ge-panel-bg-color, #171d28);
      }
      button:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .panels {
        min-width: 0;
        min-height: 0;
        overflow: auto;
      }
      ::slotted(*) {
        box-sizing: border-box;
      }
    `;
    this._tabs.className = 'tabs';
    this._panels.className = 'panels';
    root.append(this._style, this._tabs, this._panels);
  }

  connectedCallback(): void {
    this._syncFromAttributes();
    this._render();
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'options') this._readOptionsAttribute();
    if (name === 'value' && newValue === null && this._options[0]) {
      this.setAttribute('value', this._options[0].value);
      return;
    }
    this._render();
  }

  get options(): GETabOption[] {
    return this._options;
  }

  set options(value: GETabOption[]) {
    this._options = Array.isArray(value) ? value : [];
    if (!this._options.some(item => item.value === this.value)) {
      this.value = this._options[0]?.value ?? '';
    }
    this._render();
  }

  get value(): string {
    return this.getAttribute('value') ?? '';
  }

  set value(value: string) {
    this.setAttribute('value', value);
    this._render();
  }

  private _syncFromAttributes(): void {
    this._readOptionsAttribute();
    if (!this.value && this._options[0]) this.setAttribute('value', this._options[0].value);
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
        ? parsed.map(item => ({
            label: String(item.label ?? item.value ?? ''),
            value: String(item.value ?? item.label ?? ''),
            disabled: Boolean(item.disabled),
          }))
        : [];
    } catch (error) {
      console.warn('Invalid ge-tabs options attribute.', error);
    }
  }

  private _render(): void {
    this._tabs.replaceChildren();
    this._panels.replaceChildren();

    const value = this.value || this._options[0]?.value || '';
    for (const option of this._options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      button.disabled = Boolean(option.disabled);
      button.classList.toggle('active', option.value === value);
      button.addEventListener('click', () => this._select(option.value));
      this._tabs.append(button);
    }

    const slot = document.createElement('slot');
    slot.name = value;
    this._panels.append(slot);
  }

  private _select(value: string): void {
    if (value === this.value) return;
    this.setAttribute('value', value);
    const option = this._options.find(item => item.value === value) ?? null;
    this.dispatchEvent(new CustomEvent<GETabChangeDetail>('tab-change', {
      detail: { value, option },
      bubbles: true,
      composed: true,
    }));
  }
}

export function defineTabsComponents(): void {
  if (!customElements.get('ge-tabs')) {
    customElements.define('ge-tabs', GETabs);
  }
}
