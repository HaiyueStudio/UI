import { boundedMilliseconds } from './internal/numbers.js';

export type HYButtonIconPosition = 'start' | 'end';
export type HYButtonVariant = 'solid' | 'outlined';

export class HYButton extends HTMLElement {
  private readonly _button = document.createElement('button');
  private readonly _content = document.createElement('span');
  private readonly _contentSlot = document.createElement('slot');
  private readonly _icon = document.createElement('span');
  private readonly _iconSlot = document.createElement('slot');
  private readonly _iconFallback = document.createElement('span');
  private readonly _spinner = document.createElement('span');

  static get observedAttributes(): string[] {
    return ['label', 'disabled', 'aria-label', 'aria-pressed', 'title', 'icon-only', 'icon', 'icon-position', 'loading', 'variant', 'animated', 'animation-duration'];
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
        gap: var(--hy-button-icon-gap, calc(var(--hy-space-3, 6px) + 1px));
        width: 100%;
        min-height: var(--hy-control-height-sm, 28px);
        padding: 0 var(--hy-space-5, 10px);
        border: 1px solid var(--hy-button-border-color, var(--hy-border-color, #3d4654));
        border-radius:
          var(--hy-button-radius-top-left, var(--hy-button-radius, var(--hy-radius-sm, 4px)))
          var(--hy-button-radius-top-right, var(--hy-button-radius, var(--hy-radius-sm, 4px)))
          var(--hy-button-radius-bottom-right, var(--hy-button-radius, var(--hy-radius-sm, 4px)))
          var(--hy-button-radius-bottom-left, var(--hy-button-radius, var(--hy-radius-sm, 4px)));
        background: var(--hy-button-bg-color, var(--hy-surface-elevated-color, #202733));
        color: var(--hy-button-text-color, var(--hy-text-color, #eef3ff));
        font: var(--hy-font-size-sm, 12px) var(--hy-font-family, system-ui, sans-serif);
        cursor: pointer;
        transition-property: var(--_hy-button-duration-properties, var(--_hy-button-motion-properties, none));
        transition-duration: var(--_hy-button-motion-duration, var(--hy-button-animation-duration, 160ms));
        transition-timing-function: var(--hy-button-animation-easing, ease);
      }
      button:hover:not(:disabled) {
        border-color: var(--hy-button-hover-border-color, var(--hy-hover-border-color, #536477));
        background: var(--hy-button-hover-bg-color, var(--hy-hover-bg-color, #273241));
        color: var(--hy-button-hover-text-color, var(--hy-button-text-color, var(--hy-text-color, #eef3ff)));
      }
      button:active:not(:disabled) {
        border-color: var(--hy-button-active-border-color, var(--hy-focus-border-color, #79a8ff));
        background: var(--hy-button-active-bg-color, var(--hy-selected-bg-color, #255a91));
        color: var(--hy-button-active-text-color, var(--hy-selected-text-color, #fff));
      }
      button.solid {
        border-color: var(--hy-button-solid-border-color, transparent);
        background: var(--hy-button-solid-bg-color, var(--hy-accent-strong-color, #554cc6));
        color: var(--hy-button-solid-text-color, var(--hy-selected-text-color, #fff));
      }
      button.solid:hover:not(:disabled) {
        border-color: var(--hy-button-solid-hover-border-color, transparent);
        background: var(--hy-button-solid-hover-bg-color, color-mix(in srgb, var(--hy-button-solid-bg-color, var(--hy-accent-strong-color, #554cc6)) 88%, var(--hy-selected-text-color, #fff)));
        color: var(--hy-button-solid-hover-text-color, var(--hy-button-solid-text-color, var(--hy-selected-text-color, #fff)));
      }
      button.solid:active:not(:disabled) {
        border-color: var(--hy-button-solid-active-border-color, transparent);
        background: var(--hy-button-solid-active-bg-color, color-mix(in srgb, var(--hy-button-solid-bg-color, var(--hy-accent-strong-color, #554cc6)) 75%, var(--hy-text-color, #eef3ff)));
        color: var(--hy-button-solid-active-text-color, var(--hy-button-solid-text-color, var(--hy-selected-text-color, #fff)));
      }
      button:focus-visible {
        outline: 2px solid var(--hy-focus-border-color, #79a8ff);
        outline-offset: 1px;
      }
      button.icon-only {
        width: var(--hy-control-height-sm, 28px);
        padding: 0;
        gap: 0;
      }
      .icon { display: inline-grid; flex: 0 0 auto; place-items: center; line-height: var(--hy-line-height-tight, 1); }
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
        transition-property: none;
      }
      @media (prefers-reduced-motion: reduce) {
        button { transition-property: none !important; }
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
    this.addEventListener('slotchange', () => this._syncIcon());
    root.append(style, this._button);
  }

  connectedCallback(): void {
    this._sync();
  }

  attributeChangedCallback(name = ''): void {
    if (['animated', 'animation-duration', 'variant', 'disabled', 'loading'].includes(name)) {
      for (const animation of this._button.getAnimations()) if ('transitionProperty' in animation) animation.cancel();
    }
    this._sync();
  }

  get variant(): HYButtonVariant { return this.getAttribute('variant') === 'solid' ? 'solid' : 'outlined'; }
  set variant(value: HYButtonVariant) { this.setAttribute('variant', value); }
  get animated(): boolean {
    if (this.hasAttribute('animated')) return this.getAttribute('animated') !== 'false';
    return getComputedStyle(this).getPropertyValue('--_hy-button-motion-enabled').trim() === '1';
  }
  set animated(value: boolean) { this.setAttribute('animated', String(Boolean(value))); }
  get animationDuration(): number {
    if (this.hasAttribute('animation-duration')) return boundedMilliseconds(this.getAttribute('animation-duration'), 160);
    const style = getComputedStyle(this);
    return boundedMilliseconds(style.getPropertyValue('--_hy-button-motion-duration').trim() || style.getPropertyValue('--hy-button-animation-duration').trim(), 160);
  }
  set animationDuration(value: number) { this.setAttribute('animation-duration', String(value)); }

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
    this._button.classList.toggle('solid', this.variant === 'solid');
    if (this.hasAttribute('animation-duration')) this._button.style.setProperty('--_hy-button-motion-duration', `${this.animationDuration}ms`);
    else this._button.style.removeProperty('--_hy-button-motion-duration');
    if (this.hasAttribute('animated')) {
      this._button.style.setProperty('--_hy-button-motion-properties', this.animated ? 'background-color, border-color, color' : 'none');
    } else this._button.style.removeProperty('--_hy-button-motion-properties');
    // Keep the enabled flag independent from zero duration so each child can override either setting.
    if (this.hasAttribute('animation-duration')) {
      this._button.style.setProperty('--_hy-button-duration-properties', this.animationDuration === 0 ? 'none' : 'var(--_hy-button-motion-properties, none)');
    } else this._button.style.removeProperty('--_hy-button-duration-properties');
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
    const assignedIcon = this._iconSlot.assignedNodes().length > 0 && this._iconSlot.assignedNodes({ flatten: true }).some(node => node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
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
