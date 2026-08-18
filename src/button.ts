export class GEButton extends HTMLElement {
  private readonly _button = document.createElement('button');
  private readonly _slot = document.createElement('slot');

  static get observedAttributes(): string[] {
    return ['label', 'disabled', 'aria-label', 'title', 'icon-only'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; }
      button {
        min-height: 28px;
        padding: 0 10px;
        border: 1px solid #3d4654;
        border-radius: 4px;
        background: #202733;
        color: #eef3ff;
        font: 12px system-ui, sans-serif;
        cursor: pointer;
      }
      button.icon-only {
        width: 28px;
        padding: 0;
        display: inline-grid;
        place-items: center;
      }
      ::slotted(svg) {
        width: 16px;
        height: 16px;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `;
    root.append(style, this._button);
  }

  connectedCallback(): void {
    this._sync();
  }

  attributeChangedCallback(): void {
    this._sync();
  }

  private _sync(): void {
    const label = this.getAttribute('label');
    if (label !== null) {
      this._button.textContent = label;
      this._button.classList.remove('icon-only');
      this._button.removeAttribute('aria-label');
    } else {
      if (this._button.firstChild !== this._slot) this._button.replaceChildren(this._slot);
      this._button.classList.toggle('icon-only', this.hasAttribute('icon-only'));
      const accessibleLabel = this.getAttribute('aria-label') ?? this.getAttribute('title') ?? '';
      if (accessibleLabel) this._button.setAttribute('aria-label', accessibleLabel);
      else this._button.removeAttribute('aria-label');
    }
    this._button.disabled = this.hasAttribute('disabled');
  }
}

export function defineButtonComponents(): void {
  if (!customElements.get('ge-button')) {
    customElements.define('ge-button', GEButton);
  }
}
