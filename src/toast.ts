export type HYToastType = 'success' | 'info' | 'warning' | 'error' | 'loading';
export type HYToastPlacement = 'top' | 'center' | 'bottom';
export type HYToastCloseReason = 'action' | 'timeout' | 'programmatic' | 'overflow';

export interface HYToastOptions {
  readonly key?: string;
  readonly type?: HYToastType;
  readonly message: string;
  /** Auto-close delay in seconds. Use 0 for a persistent toast. */
  readonly duration?: number;
  readonly placement?: HYToastPlacement;
  readonly closable?: boolean;
}

export type HYToastMethodOptions = Omit<HYToastOptions, 'type'>;

export interface HYToastOpenDetail {
  readonly key: string;
  readonly type: HYToastType;
  readonly placement: HYToastPlacement;
}

export interface HYToastCloseDetail extends HYToastOpenDetail {
  readonly reason: HYToastCloseReason;
}

interface HYToastRecord extends HYToastOpenDetail {
  readonly element: HTMLElement;
  timer: number | null;
  exitTimer: number | null;
  closing: boolean;
}

const TYPES: readonly HYToastType[] = ['success', 'info', 'warning', 'error', 'loading'];
const PLACEMENTS: readonly HYToastPlacement[] = ['top', 'center', 'bottom'];
const DEFAULT_DURATION = 3;
const EXIT_DURATION = 150;

function isType(value: unknown): value is HYToastType {
  return typeof value === 'string' && TYPES.includes(value as HYToastType);
}

function isPlacement(value: unknown): value is HYToastPlacement {
  return typeof value === 'string' && PLACEMENTS.includes(value as HYToastPlacement);
}

function finiteNonNegative(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

/** Lightweight imperative feedback center for short, transient messages. */
export class HYToast extends HTMLElement {
  private readonly _containers = new Map<HYToastPlacement, HTMLElement>();
  private readonly _toasts = new Map<string, HYToastRecord>();
  private _sequence = 0;

  static get observedAttributes(): string[] { return ['placement', 'duration', 'max-count']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { position: fixed; z-index: var(--hy-toast-z-index, 1200); inset: 0; display: block; pointer-events: none; }
      .container { position: fixed; left: 50%; display: flex; width: min(var(--hy-toast-width, 420px), calc(100vw - 32px)); flex-direction: column; align-items: center; gap: var(--hy-toast-gap, 9px); pointer-events: none; transform: translateX(-50%); }
      .container[data-placement="top"] { top: var(--hy-toast-offset, 24px); }
      .container[data-placement="center"] { top: 50%; transform: translate(-50%, -50%); }
      .container[data-placement="bottom"] { bottom: var(--hy-toast-offset, 24px); flex-direction: column-reverse; }
      .toast {
        --_tone: var(--hy-info-color, var(--hy-accent-color, #79a8ff));
        display: grid;
        grid-template-columns: 20px minmax(0, 1fr) auto;
        gap: 9px;
        min-width: min(240px, calc(100vw - 32px));
        max-width: 100%;
        box-sizing: border-box;
        align-items: center;
        padding: 10px 12px;
        border: 1px solid color-mix(in srgb, var(--_tone) 28%, var(--hy-border-color, #303746));
        border-radius: var(--hy-toast-radius, 8px);
        color: var(--hy-text-color, #e8effa);
        background: var(--hy-toast-bg-color, var(--hy-surface-elevated-color, #171e2a));
        box-shadow: 0 10px 30px var(--hy-toast-shadow-color, rgba(0, 0, 0, .3));
        pointer-events: auto;
        font: 12px/1.45 system-ui, sans-serif;
        animation: hy-toast-enter 160ms cubic-bezier(.22, 1, .36, 1);
        transition: opacity 140ms ease, transform 140ms ease;
      }
      .toast[data-type="success"] { --_tone: var(--hy-success-color, #55c98a); }
      .toast[data-type="warning"] { --_tone: var(--hy-warning-color, #e7b75a); }
      .toast[data-type="error"] { --_tone: var(--hy-error-color, #ef6b78); }
      .toast[data-type="loading"] { --_tone: var(--hy-accent-color, #79a8ff); }
      .toast.closing { opacity: 0; transform: translateY(-6px) scale(.97); }
      .container[data-placement="bottom"] .toast.closing { transform: translateY(6px) scale(.97); }
      .icon { display: grid; width: 20px; height: 20px; place-items: center; color: var(--_tone); font-weight: 800; }
      .toast[data-type="loading"] .icon { width: 15px; height: 15px; margin: 2px; border: 2px solid color-mix(in srgb, var(--_tone) 25%, transparent); border-top-color: var(--_tone); border-radius: 50%; animation: hy-toast-spin .75s linear infinite; font-size: 0; }
      .message { min-width: 0; overflow-wrap: anywhere; }
      .close { display: grid; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 4px; place-items: center; color: var(--hy-secondary-text-color, #9aa8ba); background: transparent; cursor: pointer; font: 16px/1 system-ui, sans-serif; }
      .close:hover { color: inherit; background: var(--hy-hover-bg-color, #242d3b); }
      .close:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 1px; }
      @keyframes hy-toast-enter { from { opacity: 0; transform: translateY(-7px) scale(.97); } }
      @keyframes hy-toast-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .toast { animation-duration: 1ms; transition-duration: 1ms; } .toast[data-type="loading"] .icon { animation-duration: 1.5s; } }
    `;
    root.append(style);
    for (const placement of PLACEMENTS) {
      const container = document.createElement('div');
      container.className = 'container';
      container.dataset.placement = placement;
      root.append(container);
      this._containers.set(placement, container);
    }
  }

  connectedCallback(): void { this._syncAttributes(); }

  disconnectedCallback(): void {
    for (const toast of this._toasts.values()) this._removeToast(toast, false);
    this._toasts.clear();
    for (const container of this._containers.values()) container.replaceChildren();
  }

  attributeChangedCallback(): void { this._syncAttributes(); }

  get placement(): HYToastPlacement { return isPlacement(this.getAttribute('placement')) ? this.getAttribute('placement') as HYToastPlacement : 'top'; }
  set placement(value: HYToastPlacement) { this.setAttribute('placement', isPlacement(value) ? value : 'top'); }

  get duration(): number { return finiteNonNegative(this.getAttribute('duration'), DEFAULT_DURATION); }
  set duration(value: number) { this.setAttribute('duration', String(finiteNonNegative(value, DEFAULT_DURATION))); }

  get maxCount(): number {
    const value = Math.floor(Number(this.getAttribute('max-count')));
    return Number.isFinite(value) ? Math.min(20, Math.max(1, value)) : 5;
  }
  set maxCount(value: number) {
    const normalized = Number.isFinite(Number(value)) ? Math.min(20, Math.max(1, Math.floor(Number(value)))) : 5;
    this.setAttribute('max-count', String(normalized));
  }

  get closable(): boolean { return this.hasAttribute('closable'); }
  set closable(value: boolean) { this.toggleAttribute('closable', Boolean(value)); }

  get size(): number { return this._toasts.size; }

  open(options: string | HYToastOptions): string {
    const normalized = typeof options === 'string' ? { message: options } : options;
    const type = isType(normalized.type) ? normalized.type : 'info';
    const placement = isPlacement(normalized.placement) ? normalized.placement : this.placement;
    const fallbackDuration = type === 'loading' ? 0 : this.duration;
    const duration = finiteNonNegative(normalized.duration, fallbackDuration);
    const key = normalized.key ? String(normalized.key) : `hy-toast-${++this._sequence}`;
    const existing = this._toasts.get(key);
    if (existing) this._removeToast(existing, false);
    const element = this._createToast(key, type, String(normalized.message ?? ''), normalized.closable ?? this.closable);
    const toast: HYToastRecord = { key, type, placement, element, timer: null, exitTimer: null, closing: false };
    this._toasts.set(key, toast);
    this._containers.get(placement)?.append(element);
    while (this._toasts.size > this.maxCount) {
      const oldest = this._toasts.values().next().value as HYToastRecord | undefined;
      if (!oldest) break;
      this._removeToast(oldest, true, 'overflow');
    }
    if (duration > 0) toast.timer = window.setTimeout(() => this._closeToast(toast, 'timeout'), duration * 1000);
    this.dispatchEvent(new CustomEvent<HYToastOpenDetail>('toast-open', {
      detail: { key, type, placement },
      bubbles: true,
      composed: true,
    }));
    return key;
  }

  success(options: string | HYToastMethodOptions): string { return this._openTyped('success', options); }
  info(options: string | HYToastMethodOptions): string { return this._openTyped('info', options); }
  warning(options: string | HYToastMethodOptions): string { return this._openTyped('warning', options); }
  error(options: string | HYToastMethodOptions): string { return this._openTyped('error', options); }
  loading(options: string | HYToastMethodOptions): string { return this._openTyped('loading', options); }

  close(key: string): void {
    const toast = this._toasts.get(String(key));
    if (toast) this._closeToast(toast, 'programmatic');
  }

  clear(): void {
    for (const toast of [...this._toasts.values()]) this._closeToast(toast, 'programmatic');
  }

  private _openTyped(type: HYToastType, options: string | HYToastMethodOptions): string {
    return this.open(typeof options === 'string' ? { type, message: options } : { ...options, type });
  }

  private _createToast(key: string, type: HYToastType, message: string, closable: boolean): HTMLElement {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.dataset.key = key;
    toast.dataset.type = type;
    toast.part.add('toast');
    toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' || type === 'warning' ? 'assertive' : 'polite');
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.part.add('icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ({ success: '✓', info: 'i', warning: '!', error: '×', loading: '' } as const)[type];
    const text = document.createElement('span');
    text.className = 'message';
    text.part.add('message');
    text.textContent = message;
    toast.append(icon, text);
    if (closable) {
      const close = document.createElement('button');
      close.className = 'close';
      close.part.add('close-button');
      close.type = 'button';
      close.textContent = '×';
      close.setAttribute('aria-label', `Close ${type} toast`);
      close.addEventListener('click', () => {
        const record = this._toasts.get(key);
        if (record) this._closeToast(record, 'action');
      });
      toast.append(close);
    }
    return toast;
  }

  private _closeToast(toast: HYToastRecord, reason: HYToastCloseReason): void {
    if (toast.closing || this._toasts.get(toast.key) !== toast) return;
    toast.closing = true;
    if (toast.timer !== null) window.clearTimeout(toast.timer);
    toast.timer = null;
    toast.element.classList.add('closing');
    toast.exitTimer = window.setTimeout(() => this._removeToast(toast, true, reason), EXIT_DURATION);
  }

  private _removeToast(toast: HYToastRecord, emit: boolean, reason: HYToastCloseReason = 'programmatic'): void {
    if (toast.timer !== null) window.clearTimeout(toast.timer);
    if (toast.exitTimer !== null) window.clearTimeout(toast.exitTimer);
    toast.timer = null;
    toast.exitTimer = null;
    toast.element.remove();
    if (this._toasts.get(toast.key) === toast) this._toasts.delete(toast.key);
    if (!emit) return;
    this.dispatchEvent(new CustomEvent<HYToastCloseDetail>('toast-close', {
      detail: { key: toast.key, type: toast.type, placement: toast.placement, reason },
      bubbles: true,
      composed: true,
    }));
  }

  private _syncAttributes(): void {
    const placement = this.getAttribute('placement');
    if (placement !== null && !isPlacement(placement)) this.setAttribute('placement', 'top');
    const duration = this.getAttribute('duration');
    if (duration !== null && finiteNonNegative(duration, -1) < 0) this.setAttribute('duration', String(DEFAULT_DURATION));
    const maxCount = this.getAttribute('max-count');
    if (maxCount !== null && String(this.maxCount) !== maxCount) this.setAttribute('max-count', String(this.maxCount));
  }
}

export function defineToastComponents(): void {
  if (!customElements.get('hy-toast')) customElements.define('hy-toast', HYToast);
}
