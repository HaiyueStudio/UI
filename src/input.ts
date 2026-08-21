export type HYInputType = 'text' | 'number' | 'color';

export interface HYInputChangeDetail {
  value: string;
  valueAsNumber: number | null;
  valid: boolean;
}

export class HYInput extends HTMLElement {
  private readonly _input = document.createElement('input');

  static get observedAttributes(): string[] {
    return [
      'type', 'value', 'min', 'max', 'step', 'placeholder', 'disabled', 'readonly',
      'required', 'name', 'autocomplete', 'aria-label', 'title',
    ];
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
      input {
        box-sizing: border-box;
        width: 100%;
        height: var(--hy-input-height, 28px);
        min-width: 0;
        padding: 0 8px;
        border: 1px solid var(--hy-border-color, #303746);
        border-radius: 4px;
        outline: none;
        color: var(--hy-text-color, #d8e2f2);
        background: var(--hy-input-bg-color, var(--hy-surface-color, #121822));
        font: var(--hy-input-font, 12px system-ui, sans-serif);
        color-scheme: inherit;
      }
      input:hover:not(:disabled):not(:read-only) {
        border-color: var(--hy-hover-border-color, #435268);
      }
      input:focus {
        border-color: var(--hy-focus-border-color, #3d6fa8);
        box-shadow: 0 0 0 2px var(--hy-focus-ring-color, rgba(61, 111, 168, 0.24));
      }
      input:invalid {
        border-color: var(--hy-invalid-border-color, #b64f62);
      }
      input:disabled,
      input:read-only {
        opacity: 0.55;
        cursor: default;
      }
      input[type="color"] {
        padding: 3px;
        cursor: pointer;
      }
      input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
      input[type="color"]::-webkit-color-swatch {
        border: 0;
        border-radius: 2px;
      }
    `;
    root.append(style, this._input);
  }

  connectedCallback(): void {
    this._input.addEventListener('input', this._onInput);
    this._input.addEventListener('change', this._onChange);
    this._sync();
  }

  disconnectedCallback(): void {
    this._input.removeEventListener('input', this._onInput);
    this._input.removeEventListener('change', this._onChange);
  }

  attributeChangedCallback(): void {
    this._sync();
  }

  get type(): HYInputType { return normalizedType(this.getAttribute('type')); }
  set type(value: HYInputType) { this.setAttribute('type', normalizedType(value)); }

  get value(): string { return this.getAttribute('value') ?? ''; }
  set value(value: string) {
    this.setAttribute('value', String(value));
    this._input.value = String(value);
  }

  get valueAsNumber(): number {
    return this._input.valueAsNumber;
  }

  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', value); }

  get readOnly(): boolean { return this.hasAttribute('readonly'); }
  set readOnly(value: boolean) { this.toggleAttribute('readonly', value); }

  get valid(): boolean { return this._input.validity.valid; }

  override focus(options?: FocusOptions): void { this._input.focus(options); }
  select(): void { this._input.select(); }

  private _sync(): void {
    const type = this.type;
    if (this._input.type !== type) this._input.type = type;
    const value = this.value;
    if (this._input.value !== value) this._input.value = type === 'color' && !/^#[0-9a-f]{6}$/iu.test(value)
      ? '#000000'
      : value;
    for (const name of ['min', 'max', 'step', 'placeholder', 'name', 'autocomplete', 'aria-label', 'title']) {
      const attribute = this.getAttribute(name);
      if (attribute === null) this._input.removeAttribute(name);
      else this._input.setAttribute(name, attribute);
    }
    this._input.disabled = this.disabled;
    this._input.readOnly = this.readOnly;
    this._input.required = this.hasAttribute('required');
  }

  private _onInput = (): void => {
    this.setAttribute('value', this._input.value);
  };

  private _onChange = (): void => {
    this.setAttribute('value', this._input.value);
    const number = this.type === 'number' && Number.isFinite(this._input.valueAsNumber)
      ? this._input.valueAsNumber
      : null;
    this.dispatchEvent(new CustomEvent<HYInputChangeDetail>('value-change', {
      detail: { value: this._input.value, valueAsNumber: number, valid: this.valid },
      bubbles: true,
      composed: true,
    }));
  };
}

export function defineInputComponents(): void {
  if (!customElements.get('hy-input')) customElements.define('hy-input', HYInput);
}

function normalizedType(value: string | null): HYInputType {
  return value === 'number' || value === 'color' ? value : 'text';
}
