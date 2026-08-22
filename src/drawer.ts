export type HYDrawerPlacement = 'top' | 'right' | 'bottom' | 'left';
export type HYDrawerCloseReason = 'action' | 'mask' | 'escape' | 'programmatic';

export interface HYDrawerCloseDetail {
  readonly reason: HYDrawerCloseReason | string;
}

const CONTENT_DESTROY_DELAY = 220;
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const DRAWER_STYLES = `
      :host {
        position: fixed;
        z-index: var(--hy-drawer-z-index, 1000);
        inset: 0;
        display: block;
        pointer-events: none;
        color: var(--hy-text-color, #e6edf7);
        font: 13px/1.5 system-ui, sans-serif;
        --_duration: var(--hy-drawer-duration, 200ms);
      }
      .root {
        position: absolute;
        inset: 0;
        visibility: hidden;
        transition: visibility 0s linear var(--_duration);
      }
      :host([open]) .root {
        visibility: visible;
        transition-delay: 0s;
      }
      .mask {
        position: absolute;
        inset: 0;
        opacity: 0;
        pointer-events: none;
        background: var(--hy-drawer-mask-color, rgba(3, 7, 18, 0.58));
        backdrop-filter: blur(var(--hy-drawer-mask-blur, 1px));
        transition: opacity var(--_duration) ease;
      }
      :host([open]) .mask { opacity: 1; pointer-events: auto; }
      :host([mask="false"]) .mask { display: none; }
      .panel {
        position: absolute;
        display: flex;
        flex-direction: column;
        width: min(var(--hy-drawer-width, 378px), calc(100vw - 24px));
        height: 100%;
        max-width: 100vw;
        max-height: 100vh;
        overflow: hidden;
        pointer-events: auto;
        outline: none;
        color: inherit;
        background: var(--hy-drawer-bg-color, var(--hy-surface-elevated-color, #171e2a));
        box-shadow: 0 0 54px var(--hy-drawer-shadow-color, rgba(0, 0, 0, 0.42));
        transition: transform var(--_duration) cubic-bezier(0.22, 1, 0.36, 1);
        box-sizing: border-box;
      }
      :host(:not([placement])) .panel, :host([placement="right"]) .panel {
        inset: 0 0 0 auto;
        border-left: 1px solid var(--hy-border-color, #303746);
        transform: translateX(100%);
      }
      :host([placement="left"]) .panel {
        inset: 0 auto 0 0;
        border-right: 1px solid var(--hy-border-color, #303746);
        transform: translateX(-100%);
      }
      :host([placement="top"]) .panel,
      :host([placement="bottom"]) .panel {
        width: 100%;
        height: min(var(--hy-drawer-height, 320px), calc(100vh - 24px));
      }
      :host([placement="top"]) .panel {
        inset: 0 0 auto;
        border-bottom: 1px solid var(--hy-border-color, #303746);
        transform: translateY(-100%);
      }
      :host([placement="bottom"]) .panel {
        inset: auto 0 0;
        border-top: 1px solid var(--hy-border-color, #303746);
        transform: translateY(100%);
      }
      :host([open]) .panel { transform: translate(0); }
      .header {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        min-height: 52px;
        padding: 0 12px 0 18px;
        border-bottom: 1px solid var(--hy-border-color, #303746);
      }
      h2 {
        flex: 1;
        min-width: 0;
        margin: 0;
        overflow: hidden;
        font-size: 14px;
        font-weight: 650;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .close {
        display: grid;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 0;
        border-radius: 5px;
        place-items: center;
        color: var(--hy-secondary-text-color, #8b99ad);
        background: transparent;
        cursor: pointer;
        font: 20px/1 system-ui, sans-serif;
      }
      .close:hover { color: inherit; background: var(--hy-hover-bg-color, #242d3b); }
      .close:focus-visible, .panel:focus-visible {
        outline: 2px solid var(--hy-focus-border-color, #79a8ff);
        outline-offset: -2px;
      }
      .body {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding: var(--hy-drawer-body-padding, 18px);
        color: var(--hy-secondary-text-color, #a8b4c5);
      }
      .footer {
        display: flex;
        flex: 0 0 auto;
        justify-content: flex-end;
        gap: 8px;
        min-height: 56px;
        padding: 10px 16px;
        border-top: 1px solid var(--hy-border-color, #303746);
        background: var(--hy-drawer-footer-bg-color, rgba(9, 13, 19, 0.22));
        box-sizing: border-box;
      }
      .footer[hidden] { display: none; }
      slot[name="footer"]::slotted(*) { margin: 0; }
      @media (prefers-reduced-motion: reduce) {
        :host { --_duration: 1ms; }
      }
    `;

/** Sliding dialog surface with optional mask and hidden-content unmounting. */
export class HYDrawer extends HTMLElement {
  private readonly _panel = document.createElement('section');
  private readonly _title = document.createElement('h2');
  private readonly _closeButton = document.createElement('button');
  private readonly _footer = document.createElement('footer');
  private readonly _footerSlot = document.createElement('slot');
  private readonly _detachedContent = document.createDocumentFragment();
  private _documentListenerAbort: AbortController | null = null;
  private _destroyTimer: number | null = null;
  private _returnFocus: HTMLElement | null = null;
  private _closeReason: HYDrawerCloseDetail['reason'] = 'programmatic';
  private _wasOpen = false;

  static get observedAttributes(): string[] {
    return ['open', 'heading', 'placement', 'mask', 'destroy-on-hidden'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = DRAWER_STYLES;

    const container = document.createElement('div');
    container.className = 'root';
    const mask = document.createElement('div');
    mask.className = 'mask';
    mask.part.add('mask');
    mask.setAttribute('aria-hidden', 'true');

    this._panel.className = 'panel';
    this._panel.part.add('panel');
    this._panel.setAttribute('role', 'dialog');
    this._panel.setAttribute('aria-labelledby', 'drawer-title');
    this._panel.setAttribute('aria-hidden', 'true');
    this._panel.tabIndex = -1;

    const header = document.createElement('header');
    header.className = 'header';
    header.part.add('header');
    this._title.id = 'drawer-title';
    this._closeButton.className = 'close';
    this._closeButton.part.add('close-button');
    this._closeButton.type = 'button';
    this._closeButton.setAttribute('aria-label', 'Close drawer');
    this._closeButton.textContent = '×';
    header.append(this._title, this._closeButton);

    const body = document.createElement('div');
    body.className = 'body';
    body.part.add('body');
    body.append(document.createElement('slot'));
    this._footer.className = 'footer';
    this._footer.part.add('footer');
    this._footerSlot.name = 'footer';
    this._footer.append(this._footerSlot);
    this._panel.append(header, body, this._footer);
    container.append(mask, this._panel);
    root.append(style, container);

    mask.addEventListener('click', () => this.close('mask'));
    this._closeButton.addEventListener('click', () => this.close('action'));
    this._footerSlot.addEventListener('slotchange', () => this._syncFooter());
  }

  connectedCallback(): void {
    this._syncPlacement();
    this._syncHeading();
    this._syncFooter();
    this._syncOpen();
  }

  disconnectedCallback(): void {
    this._detachDocumentListener();
    this._cancelContentDestroy();
    this._returnFocus = null;
    this._wasOpen = false;
  }

  attributeChangedCallback(name: string): void {
    if (name === 'heading') this._syncHeading();
    if (name === 'placement') this._syncPlacement();
    if (name === 'mask') this._syncPanelSemantics();
    if (name === 'open' && this.isConnected) this._syncOpen();
    if (name === 'destroy-on-hidden' && this.isConnected && !this.open) {
      if (this.destroyOnHidden) this._scheduleContentDestroy(0);
      else this._restoreContent();
    }
  }

  get open(): boolean { return this.hasAttribute('open'); }
  set open(value: boolean) { this.toggleAttribute('open', Boolean(value)); }

  get heading(): string { return this.getAttribute('heading') ?? ''; }
  set heading(value: string) { this.setAttribute('heading', String(value)); }

  get placement(): HYDrawerPlacement {
    const value = this.getAttribute('placement');
    return value === 'top' || value === 'bottom' || value === 'left' ? value : 'right';
  }
  set placement(value: HYDrawerPlacement) {
    this.setAttribute('placement', value === 'top' || value === 'bottom' || value === 'left' ? value : 'right');
  }

  /** The mask defaults to true; use mask="false" or set the property to false to disable it. */
  get mask(): boolean { return this.getAttribute('mask') !== 'false'; }
  set mask(value: boolean) { this.setAttribute('mask', String(Boolean(value))); }

  get destroyOnHidden(): boolean { return this.hasAttribute('destroy-on-hidden'); }
  set destroyOnHidden(value: boolean) { this.toggleAttribute('destroy-on-hidden', Boolean(value)); }

  show(): void {
    if (this.open) return;
    this._closeReason = 'programmatic';
    this.open = true;
  }

  close(reason: HYDrawerCloseDetail['reason'] = 'programmatic'): void {
    if (!this.open) return;
    this._closeReason = reason;
    this.open = false;
  }

  private _syncHeading(): void {
    this._title.textContent = this.heading || 'Drawer';
  }

  private _syncPlacement(): void {
    const value = this.getAttribute('placement');
    if (value !== null && value !== 'top' && value !== 'right' && value !== 'bottom' && value !== 'left') {
      this.setAttribute('placement', 'right');
    }
  }

  private _syncFooter(): void {
    this._footer.hidden = this._footerSlot.assignedElements().length === 0;
  }

  private _syncPanelSemantics(): void {
    if (this.open && this.mask) this._panel.setAttribute('aria-modal', 'true');
    else this._panel.removeAttribute('aria-modal');
  }

  private _syncOpen(): void {
    if (this.open) {
      this._cancelContentDestroy();
      this._restoreContent();
      this._returnFocus ??= document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this._panel.setAttribute('aria-hidden', 'false');
      this._syncPanelSemantics();
      this._attachDocumentListener();
      this._wasOpen = true;
      queueMicrotask(() => {
        if (this.open && this.isConnected) this._closeButton.focus();
      });
      return;
    }

    this._panel.setAttribute('aria-hidden', 'true');
    this._syncPanelSemantics();
    this._detachDocumentListener();
    this._scheduleContentDestroy(this._wasOpen ? CONTENT_DESTROY_DELAY : 0);
    if (!this._wasOpen) return;

    this._wasOpen = false;
    const reason = this._closeReason;
    this._closeReason = 'programmatic';
    this.dispatchEvent(new CustomEvent<HYDrawerCloseDetail>('drawer-close', {
      detail: { reason },
      bubbles: true,
      composed: true,
    }));
    this._returnFocus?.focus();
    this._returnFocus = null;
  }

  private _attachDocumentListener(): void {
    if (this._documentListenerAbort) return;
    this._documentListenerAbort = new AbortController();
    document.addEventListener('keydown', this._onDocumentKeyDown, {
      capture: true,
      signal: this._documentListenerAbort.signal,
    });
  }

  private _detachDocumentListener(): void {
    this._documentListenerAbort?.abort();
    this._documentListenerAbort = null;
  }

  private _onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close('escape');
      return;
    }
    if (event.key !== 'Tab' || !this.mask) return;

    const focusable = [this._closeButton, ...this.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
      .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    if (focusable.length === 0) {
      event.preventDefault();
      this._panel.focus();
      return;
    }
    const active = this.shadowRoot?.activeElement ?? document.activeElement;
    const index = focusable.indexOf(active as HTMLElement);
    if (event.shiftKey && index <= 0) {
      event.preventDefault();
      focusable[focusable.length - 1]?.focus();
    } else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) {
      event.preventDefault();
      focusable[0]?.focus();
    }
  };

  private _scheduleContentDestroy(delay: number): void {
    this._cancelContentDestroy();
    if (!this.destroyOnHidden || this.open) return;
    this._destroyTimer = window.setTimeout(() => {
      this._destroyTimer = null;
      if (!this.open && this.destroyOnHidden) this._detachedContent.append(...Array.from(this.childNodes));
    }, delay);
  }

  private _cancelContentDestroy(): void {
    if (this._destroyTimer === null) return;
    window.clearTimeout(this._destroyTimer);
    this._destroyTimer = null;
  }

  private _restoreContent(): void {
    if (!this._detachedContent.hasChildNodes()) return;
    this.insertBefore(this._detachedContent, this.firstChild);
    this._syncFooter();
  }
}

export function defineDrawerComponents(): void {
  if (!customElements.get('hy-drawer')) customElements.define('hy-drawer', HYDrawer);
}
