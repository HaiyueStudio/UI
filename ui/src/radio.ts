export interface GERadioChangeDetail {
  checked: boolean;
  value: string;
  name: string;
}

export class GERadio extends HTMLElement {
  private readonly _input = document.createElement('input');
  private readonly _marker = document.createElement('span');
  private readonly _label = document.createElement('span');
  private readonly _slot = document.createElement('slot');

  static get observedAttributes(): string[] {
    return ['checked', 'disabled', 'label', 'value', 'name', 'aria-label'];
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
        color: var(--ge-radio-text-color, var(--ge-text-color, #d8e2f2));
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
      .marker {
        box-sizing: border-box;
        width: 14px;
        height: 14px;
        flex: 0 0 14px;
        display: inline-grid;
        place-items: center;
        border: 1px solid var(--ge-radio-border-color, var(--ge-border-color, #303746));
        border-radius: 50%;
        background: var(--ge-radio-bg-color, var(--ge-input-bg-color, #121822));
        color: var(--ge-radio-dot-color, var(--ge-selected-text-color, #ffffff));
        transition: background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
      }
      input:focus-visible + .marker {
        border-color: var(--ge-focus-border-color, #3d6fa8);
        box-shadow: 0 0 0 2px var(--ge-focus-ring-color, rgba(61, 111, 168, 0.28));
      }
      input:checked + .marker {
        border-color: var(--ge-radio-checked-border-color, var(--ge-accent-color, #3d6fa8));
        background: var(--ge-radio-checked-bg-color, var(--ge-accent-strong-color, #255a91));
      }
      .marker::after {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        transform: scale(0);
        transition: transform 0.12s ease;
      }
      input:checked + .marker::after {
        transform: scale(1);
      }
      .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;

    const label = document.createElement('label');
    this._input.type = 'radio';
    this._marker.className = 'marker';
    this._marker.setAttribute('aria-hidden', 'true');
    this._label.className = 'label';
    this._label.append(this._slot);
    label.append(this._input, this._marker, this._label);
    root.append(style, label);
  }

  connectedCallback(): void {
    this._input.addEventListener('change', this._onChange);
    this._sync();
    if (this.checked) this._uncheckNamedPeers();
  }

  disconnectedCallback(): void {
    this._input.removeEventListener('change', this._onChange);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    this._sync();
    if (name === 'checked' && oldValue !== newValue && newValue !== null) {
      this._uncheckNamedPeers();
    }
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
    if (!this._input.checked) return;
    this.setAttribute('checked', '');
    this._uncheckNamedPeers();
    this.dispatchEvent(new CustomEvent<GERadioChangeDetail>('checked-change', {
      detail: { checked: true, value: this.value, name: this.name },
      bubbles: true,
      composed: true,
    }));
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };

  private _uncheckNamedPeers(): void {
    if (!this.name) return;
    const root = this.getRootNode();
    const peers = root instanceof Document || root instanceof ShadowRoot
      ? root.querySelectorAll<GERadio>(`ge-radio[name="${cssEscape(this.name)}"]`)
      : [];
    for (const peer of peers) {
      if (peer === this || peer.disabled) continue;
      peer.removeAttribute('checked');
    }
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}

export function defineRadioComponents(): void {
  if (!customElements.get('ge-radio')) {
    customElements.define('ge-radio', GERadio);
  }
}
