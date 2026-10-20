export type HYButtonIconPosition = 'start' | 'end';

export class HYButton extends HTMLElement {
  private readonly _button = document.createElement('button');
  private readonly _content = document.createElement('span');
  private readonly _contentSlot = document.createElement('slot');
  private readonly _icon = document.createElement('span');
  private readonly _iconSlot = document.createElement('slot');
  private readonly _iconFallback = document.createElement('span');
  private readonly _spinner = document.createElement('span');

  static get observedAttributes(): string[] {
    return ['label', 'disabled', 'aria-label', 'aria-pressed', 'title', 'icon-only', 'icon', 'icon-position', 'loading'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; min-width: 0; }
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--hy-button-icon-gap, 7px);
        width: 100%;
        min-height: 28px;
        padding: 0 10px;
        border: 1px solid var(--hy-border-color, #3d4654);
        border-radius:
          var(--hy-button-radius-top-left, var(--hy-button-radius, 4px))
          var(--hy-button-radius-top-right, var(--hy-button-radius, 4px))
          var(--hy-button-radius-bottom-right, var(--hy-button-radius, 4px))
          var(--hy-button-radius-bottom-left, var(--hy-button-radius, 4px));
        background: var(--hy-surface-elevated-color, #202733);
        color: var(--hy-text-color, #eef3ff);
        font: 12px system-ui, sans-serif;
        cursor: pointer;
      }
      button:hover:not(:disabled) {
        border-color: var(--hy-hover-border-color, #536477);
        background: var(--hy-hover-bg-color, #273241);
      }
      button:focus-visible {
        outline: 2px solid var(--hy-focus-border-color, #79a8ff);
        outline-offset: 1px;
      }
      button.icon-only {
        width: 28px;
        padding: 0;
        gap: 0;
      }
      .icon { display: inline-grid; flex: 0 0 auto; place-items: center; line-height: 1; }
      button.icon-end .icon { order: 2; }
      .icon[hidden], .spinner[hidden] { display: none; }
      .spinner {
        width: var(--hy-button-loading-size, 14px);
        height: var(--hy-button-loading-size, 14px);
        box-sizing: border-box;
        border: var(--hy-button-loading-stroke, 2px) solid color-mix(in srgb, currentColor 28%, transparent);
        border-top-color: currentColor;
        border-radius: 50%;
        animation: hy-button-spin var(--hy-button-loading-duration, 0.72s) linear infinite;
      }
      @keyframes hy-button-spin { to { transform: rotate(360deg); } }
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
      @media (prefers-reduced-motion: reduce) {
        .spinner { animation-duration: 1.5s; }
      }
    `;
    this._button.type = 'button';
    this._button.part.add('button');
    this._content.className = 'content';
    this._content.part.add('content');
    this._icon.className = 'icon';
    this._icon.part.add('icon');
    this._iconSlot.name = 'icon';
    this._iconFallback.className = 'icon-fallback';
    this._spinner.className = 'spinner';
    this._spinner.part.add('spinner');
    this._spinner.setAttribute('aria-hidden', 'true');
    this._iconSlot.append(this._iconFallback);
    this._icon.append(this._iconSlot, this._spinner);
    this._content.append(this._contentSlot);
    this._button.append(this._icon, this._content);
    this._iconSlot.addEventListener('slotchange', () => this._syncIcon());
    root.append(style, this._button);
  }

  connectedCallback(): void {
    this._sync();
  }

  attributeChangedCallback(): void {
    this._sync();
  }

  get loading(): boolean {
    return this.hasAttribute('loading');
  }

  set loading(value: boolean) {
    this.toggleAttribute('loading', Boolean(value));
  }

  get icon(): string {
    return this.getAttribute('icon') ?? '';
  }

  set icon(value: string) {
    if (value) this.setAttribute('icon', value);
    else this.removeAttribute('icon');
  }

  get iconPosition(): HYButtonIconPosition {
    return this.getAttribute('icon-position') === 'end' ? 'end' : 'start';
  }

  set iconPosition(value: HYButtonIconPosition) {
    this.setAttribute('icon-position', value === 'end' ? 'end' : 'start');
  }

  override click(): void {
    this._button.click();
  }

  private _sync(): void {
    const label = this.getAttribute('label');
    if (label !== null) {
      if (this._content.textContent !== label || this._content.firstChild === this._contentSlot) this._content.textContent = label;
      this._button.removeAttribute('aria-label');
    } else {
      if (this._content.firstChild !== this._contentSlot) this._content.replaceChildren(this._contentSlot);
      const accessibleLabel = this.getAttribute('aria-label') ?? this.getAttribute('title') ?? '';
      if (accessibleLabel) this._button.setAttribute('aria-label', accessibleLabel);
      else this._button.removeAttribute('aria-label');
    }
    const loading = this.loading;
    this._button.classList.toggle('icon-only', label === null && this.hasAttribute('icon-only'));
    this._button.classList.toggle('icon-end', this.iconPosition === 'end');
    this._button.disabled = this.hasAttribute('disabled') || loading;
    if (loading) this._button.setAttribute('aria-busy', 'true');
    else this._button.removeAttribute('aria-busy');
    const pressed = this.getAttribute('aria-pressed');
    if (pressed === 'true' || pressed === 'false' || pressed === 'mixed') this._button.setAttribute('aria-pressed', pressed);
    else this._button.removeAttribute('aria-pressed');
    this._syncIcon();
  }

  private _syncIcon(): void {
    const loading = this.loading;
    const assignedIcon = this._iconSlot.assignedNodes({ flatten: true }).some(node => node.nodeType !== Node.TEXT_NODE || Boolean(node.textContent?.trim()));
    this._iconFallback.textContent = this.icon;
    this._iconSlot.hidden = loading;
    this._spinner.hidden = !loading;
    this._icon.hidden = !loading && !this.icon && !assignedIcon;
  }
}

export function defineButtonComponents(): void {
  if (!customElements.get('hy-button')) {
    customElements.define('hy-button', HYButton);
  }
}
