export interface HYTabOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface HYTabChangeDetail {
  value: string;
  option: HYTabOption | null;
}

export class HYTabs extends HTMLElement {
  private readonly _style = document.createElement('style');
  private readonly _tabs = document.createElement('div');
  private readonly _panels = document.createElement('div');
  private _options: HYTabOption[] = [];

  static get observedAttributes(): string[] {
    return ['options', 'value', 'aria-label'];
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
        color: var(--hy-text-color, #d8e2f2);
        background: var(--hy-panel-bg-color, #171d28);
        font: 12px system-ui, sans-serif;
      }
      .tabs {
        display: flex;
        align-items: end;
        gap: 2px;
        min-width: 0;
        padding: 4px 6px 0;
        border-bottom: 1px solid var(--hy-border-color, #303746);
        background: var(--hy-tabs-bar-bg-color, var(--hy-menu-bg-color, var(--hy-surface-elevated-color, #1b2230)));
      }
      button {
        height: 28px;
        min-width: 0;
        padding: 0 10px;
        border: 1px solid transparent;
        border-bottom: 0;
        border-radius: 4px 4px 0 0;
        color: var(--hy-secondary-text-color, #8fa7c8);
        background: transparent;
        font: inherit;
        cursor: pointer;
      }
      button:hover {
        color: var(--hy-text-color, #d8e2f2);
        background: var(--hy-hover-bg-color, #222b3a);
      }
      button.active {
        color: var(--hy-active-text-color, #eef3ff);
        border-color: var(--hy-border-color, #303746);
        background: var(--hy-panel-bg-color, #171d28);
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
    this._tabs.setAttribute('role', 'tablist');
    this._panels.className = 'panels';
    this._panels.id = 'panel';
    this._panels.setAttribute('role', 'tabpanel');
    root.append(this._style, this._tabs, this._panels);
  }

  connectedCallback(): void {
    this._syncFromAttributes();
    this._render();
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (_oldValue === newValue) return;
    if (name === 'options') this._readOptionsAttribute();
    if (name === 'value' && newValue === null && this._options[0]) {
      this.setAttribute('value', this._options[0].value);
      return;
    }
    this._render();
  }

  get options(): HYTabOption[] {
    return this._options;
  }

  set options(value: HYTabOption[]) {
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
  }

  private _syncFromAttributes(): void {
    if (this.hasAttribute('options')) this._readOptionsAttribute();
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
      console.warn('Invalid hy-tabs options attribute.', error);
    }
  }

  private _render(): void {
    const focusedValue = (this.shadowRoot?.activeElement as HTMLElement | null)?.dataset.value;
    this._tabs.replaceChildren();
    this._panels.replaceChildren();
    this._tabs.setAttribute('aria-label', this.getAttribute('aria-label') ?? 'Tabs');

    const value = this.value || this._options[0]?.value || '';
    const enabled = this._options.filter(option => !option.disabled);
    const focusValue = enabled.some(option => option.value === value) ? value : enabled[0]?.value;
    this._options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `tab-${index}`;
      button.dataset.value = option.value;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(option.value === value));
      button.setAttribute('aria-controls', this._panels.id);
      button.tabIndex = option.value === focusValue && !option.disabled ? 0 : -1;
      button.textContent = option.label;
      button.disabled = Boolean(option.disabled);
      button.classList.toggle('active', option.value === value);
      button.addEventListener('click', () => this._select(option.value));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !enabled.length) return;
        event.preventDefault();
        const position = enabled.findIndex(item => item.value === option.value);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
          : (position + (event.key === 'ArrowLeft' ? -1 : 1) + enabled.length) % enabled.length;
        this._select(enabled[next]!.value);
        this._focusTab(enabled[next]!.value);
      });
      this._tabs.append(button);
      if (option.value === value) this._panels.setAttribute('aria-labelledby', button.id);
    });
    if (!this._options.some(option => option.value === value)) this._panels.removeAttribute('aria-labelledby');

    const slot = document.createElement('slot');
    slot.name = value;
    this._panels.append(slot);
    if (focusedValue !== undefined) this._focusTab(focusedValue);
  }

  private _focusTab(value: string): void {
    [...this._tabs.querySelectorAll<HTMLButtonElement>('button')].find(button => button.dataset.value === value)?.focus();
  }

  private _select(value: string): void {
    if (value === this.value) return;
    if (!this._options.some(option => option.value === value && !option.disabled)) return;
    this.setAttribute('value', value);
    const option = this._options.find(item => item.value === value) ?? null;
    this.dispatchEvent(new CustomEvent<HYTabChangeDetail>('tab-change', {
      detail: { value, option },
      bubbles: true,
      composed: true,
    }));
  }
}

export function defineTabsComponents(): void {
  if (!customElements.get('hy-tabs')) {
    customElements.define('hy-tabs', HYTabs);
  }
}
