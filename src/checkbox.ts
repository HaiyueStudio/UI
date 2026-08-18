export interface GECheckboxChangeDetail {
  checked: boolean;
  value: string;
}

export class GECheckbox extends HTMLElement {
  private readonly _input = document.createElement('input');
  private readonly _box = document.createElement('span');
  private readonly _label = document.createElement('span');
  private readonly _slot = document.createElement('slot');

  static get observedAttributes(): string[] {
    return ['checked', 'disabled', 'indeterminate', 'label', 'value', 'name', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: inline-block;
        width: max-content;
        min-width: 0;
        color: var(--ge-checkbox-text-color, var(--ge-text-color, #d8e2f2));
        font: 12px system-ui, sans-serif;
      }
      :host([disabled]) {
        opacity: 0.55;
        cursor: default;
      }
      label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        cursor: pointer;
        user-select: none;
      }
      :host([disabled]) label {
        cursor: default;
      }
      input {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        border: 0;
      }
      .box {
        box-sizing: border-box;
        width: 14px;
        height: 14px;
        flex: 0 0 14px;
        display: inline-grid;
        place-items: center;
        border: 1px solid var(--ge-checkbox-border-color, var(--ge-border-color, #303746));
        border-radius: 3px;
        background: var(--ge-checkbox-bg-color, var(--ge-input-bg-color, #121822));
        color: var(--ge-checkbox-mark-color, var(--ge-selected-text-color, #ffffff));
        transition: background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
      }
      input:focus-visible + .box {
        border-color: var(--ge-focus-border-color, #3d6fa8);
        box-shadow: 0 0 0 2px var(--ge-focus-ring-color, rgba(61, 111, 168, 0.28));
      }
      input:checked + .box,
      input:indeterminate + .box {
        border-color: var(--ge-checkbox-checked-border-color, var(--ge-accent-color, #3d6fa8));
        background: var(--ge-checkbox-checked-bg-color, var(--ge-accent-strong-color, #255a91));
      }
      input:disabled + .box {
        cursor: default;
      }
      .box::after {
        content: "";
        width: 7px;
        height: 4px;
        border: solid currentColor;
        border-width: 0 0 2px 2px;
        transform: rotate(-45deg) scale(0);
        transform-origin: center;
        transition: transform 0.12s ease;
      }
      input:checked + .box::after {
        transform: rotate(-45deg) scale(1);
      }
      input:indeterminate + .box::after {
        width: 7px;
        height: 0;
        border-width: 0 0 2px;
        transform: rotate(0deg) scale(1);
      }
      .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;

    const label = document.createElement('label');
    this._input.type = 'checkbox';
    this._box.className = 'box';
    this._box.setAttribute('aria-hidden', 'true');
    this._label.className = 'label';
    this._label.append(this._slot);
    label.append(this._input, this._box, this._label);
    root.append(style, label);
  }

  connectedCallback(): void {
    this._input.addEventListener('change', this._onChange);
    this._sync();
  }

  disconnectedCallback(): void {
    this._input.removeEventListener('change', this._onChange);
  }

  attributeChangedCallback(): void {
    this._sync();
  }

  get checked(): boolean {
    return this.hasAttribute('checked');
  }

  set checked(value: boolean) {
    if (value) this.setAttribute('checked', '');
    else this.removeAttribute('checked');
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }

  set disabled(value: boolean) {
    if (value) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get indeterminate(): boolean {
    return this.hasAttribute('indeterminate');
  }

  set indeterminate(value: boolean) {
    if (value) this.setAttribute('indeterminate', '');
    else this.removeAttribute('indeterminate');
  }

  get label(): string {
    return this.getAttribute('label') ?? '';
  }

  set label(value: string) {
    if (value) this.setAttribute('label', value);
    else this.removeAttribute('label');
  }

  get value(): string {
    return this.getAttribute('value') ?? 'on';
  }

  set value(value: string) {
    this.setAttribute('value', value);
  }

  get name(): string {
    return this.getAttribute('name') ?? '';
  }

  set name(value: string) {
    if (value) this.setAttribute('name', value);
    else this.removeAttribute('name');
  }

  private _sync(): void {
    this._input.checked = this.checked;
    this._input.disabled = this.disabled;
    this._input.indeterminate = this.indeterminate;
    this._input.value = this.value;
    this._input.name = this.name;

    const label = this.getAttribute('label');
    if (label !== null) this._slot.textContent = label;
    else if (this._slot.textContent !== '') this._slot.textContent = '';

    const ariaLabel = this.getAttribute('aria-label') ?? label ?? '';
    if (ariaLabel) this._input.setAttribute('aria-label', ariaLabel);
    else this._input.removeAttribute('aria-label');
  }

  private _onChange = (): void => {
    if (this._input.checked) this.setAttribute('checked', '');
    else this.removeAttribute('checked');
    this.removeAttribute('indeterminate');
    this.dispatchEvent(new CustomEvent<GECheckboxChangeDetail>('checked-change', {
      detail: { checked: this.checked, value: this.value },
      bubbles: true,
      composed: true,
    }));
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };
}

export function defineCheckboxComponents(): void {
  if (!customElements.get('ge-checkbox')) {
    customElements.define('ge-checkbox', GECheckbox);
  }
}
