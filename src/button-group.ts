export type HYButtonGroupOrientation = 'horizontal' | 'vertical';

export class HYButtonGroup extends HTMLElement {
  private readonly _group = document.createElement('div');

  static get observedAttributes(): string[] {
    return ['orientation', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-flex; max-width: 100%; }
      .group { display: inline-flex; align-items: stretch; max-width: 100%; }
      :host([orientation="vertical"]) .group { flex-direction: column; }
      ::slotted(hy-button) {
        position: relative;
        display: block;
        --hy-button-radius: 0;
      }
      :host(:not([orientation="vertical"])) ::slotted(hy-button:not(:first-child)) { margin-left: -1px; }
      :host(:not([orientation="vertical"])) ::slotted(hy-button:first-child) {
        --hy-button-radius-top-left: var(--hy-button-group-radius, 4px);
        --hy-button-radius-bottom-left: var(--hy-button-group-radius, 4px);
      }
      :host(:not([orientation="vertical"])) ::slotted(hy-button:last-child) {
        --hy-button-radius-top-right: var(--hy-button-group-radius, 4px);
        --hy-button-radius-bottom-right: var(--hy-button-group-radius, 4px);
      }
      :host([orientation="vertical"]) ::slotted(hy-button:not(:first-child)) { margin-top: -1px; }
      :host([orientation="vertical"]) ::slotted(hy-button:first-child) {
        --hy-button-radius-top-left: var(--hy-button-group-radius, 4px);
        --hy-button-radius-top-right: var(--hy-button-group-radius, 4px);
      }
      :host([orientation="vertical"]) ::slotted(hy-button:last-child) {
        --hy-button-radius-bottom-left: var(--hy-button-group-radius, 4px);
        --hy-button-radius-bottom-right: var(--hy-button-group-radius, 4px);
      }
      ::slotted(hy-button:hover), ::slotted(hy-button:focus-within) { z-index: 1; }
    `;
    this._group.className = 'group';
    this._group.part.add('group');
    this._group.setAttribute('role', 'group');
    this._group.append(document.createElement('slot'));
    root.append(style, this._group);
  }

  connectedCallback(): void {
    if (!this.hasAttribute('orientation')) this.setAttribute('orientation', 'horizontal');
    this._sync();
  }

  attributeChangedCallback(): void {
    this._sync();
  }

  get orientation(): HYButtonGroupOrientation {
    return this.getAttribute('orientation') === 'vertical' ? 'vertical' : 'horizontal';
  }

  set orientation(value: HYButtonGroupOrientation) {
    this.setAttribute('orientation', value === 'vertical' ? 'vertical' : 'horizontal');
  }

  private _sync(): void {
    const label = this.getAttribute('aria-label');
    if (label) this._group.setAttribute('aria-label', label);
    else this._group.removeAttribute('aria-label');
  }
}

export function defineButtonGroupComponents(): void {
  if (!customElements.get('hy-button-group')) {
    customElements.define('hy-button-group', HYButtonGroup);
  }
}
