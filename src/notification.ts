export type HYNotificationType = 'success' | 'info' | 'warning' | 'error';
export type HYNotificationPlacement =
  | 'topLeft'
  | 'top'
  | 'topRight'
  | 'bottomLeft'
  | 'bottom'
  | 'bottomRight';
export type HYNotificationCloseReason = 'action' | 'timeout' | 'programmatic';

export interface HYNotificationOptions {
  readonly key?: string;
  readonly type?: HYNotificationType;
  readonly message: string;
  readonly description?: string;
  /** Auto-close delay in seconds. Use 0 to keep the notification open. */
  readonly duration?: number;
  readonly placement?: HYNotificationPlacement;
  readonly showProgress?: boolean;
}

export type HYNotificationMethodOptions = Omit<HYNotificationOptions, 'type'>;

export interface HYNotificationOpenDetail {
  readonly key: string;
  readonly type: HYNotificationType;
  readonly placement: HYNotificationPlacement;
}

export interface HYNotificationCloseDetail extends HYNotificationOpenDetail {
  readonly reason: HYNotificationCloseReason;
}

interface HYNotificationRecord extends HYNotificationOpenDetail {
  readonly element: HTMLElement;
  timer: number | null;
  exitTimer: number | null;
  closing: boolean;
}

const DEFAULT_DURATION = 4.5;
const DEFAULT_PLACEMENT: HYNotificationPlacement = 'topRight';
const EXIT_DURATION = 170;
const PLACEMENTS: readonly HYNotificationPlacement[] = [
  'topLeft',
  'top',
  'topRight',
  'bottomLeft',
  'bottom',
  'bottomRight',
];

function isPlacement(value: unknown): value is HYNotificationPlacement {
  return typeof value === 'string' && PLACEMENTS.includes(value as HYNotificationPlacement);
}

function isType(value: unknown): value is HYNotificationType {
  return value === 'success' || value === 'info' || value === 'warning' || value === 'error';
}

/** Imperative notification center with independently timed, stacked notices. */
export class HYNotification extends HTMLElement {
  private readonly _containers = new Map<HYNotificationPlacement, HTMLElement>();
  private readonly _notices = new Map<string, HYNotificationRecord>();
  private _sequence = 0;

  static get observedAttributes(): string[] {
    return ['placement', 'duration'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: fixed;
        z-index: var(--hy-notification-z-index, 1100);
        inset: 0;
        display: block;
        pointer-events: none;
        color: var(--hy-text-color, #e8effa);
        font: 13px/1.45 system-ui, sans-serif;
      }
      .container {
        position: fixed;
        width: min(var(--hy-notification-width, 384px), calc(100vw - 32px));
        min-height: 88px;
        pointer-events: none;
        perspective: 1000px;
        transform-style: preserve-3d;
      }
      .container[data-placement="topLeft"] { top: var(--hy-notification-offset, 24px); left: var(--hy-notification-offset, 24px); }
      .container[data-placement="top"] { top: var(--hy-notification-offset, 24px); left: 50%; transform: translateX(-50%); }
      .container[data-placement="topRight"] { top: var(--hy-notification-offset, 24px); right: var(--hy-notification-offset, 24px); }
      .container[data-placement="bottomLeft"] { bottom: var(--hy-notification-offset, 24px); left: var(--hy-notification-offset, 24px); }
      .container[data-placement="bottom"] { bottom: var(--hy-notification-offset, 24px); left: 50%; transform: translateX(-50%); }
      .container[data-placement="bottomRight"] { right: var(--hy-notification-offset, 24px); bottom: var(--hy-notification-offset, 24px); }
      .notice {
        --_tone: var(--hy-info-color, #58a6ff);
        --_soft: color-mix(in srgb, var(--_tone) 16%, transparent);
        position: absolute;
        z-index: calc(100 - var(--_depth));
        inset: 0 0 auto;
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr) 28px;
        gap: 11px;
        min-height: 82px;
        padding: 15px 13px 15px 15px;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--_tone) 30%, var(--hy-border-color, #303746));
        border-radius: var(--hy-notification-radius, 9px);
        pointer-events: auto;
        color: var(--hy-text-color, #e8effa);
        background: var(--hy-notification-bg-color, var(--hy-surface-elevated-color, #171e2a));
        box-shadow: 0 14px 38px var(--hy-notification-shadow-color, rgba(0, 0, 0, 0.34));
        transform: translate3d(0, calc(var(--_depth) * 10px), calc(var(--_depth) * -24px)) scale(calc(1 - var(--_depth) * 0.035));
        transform-origin: top center;
        transition: margin 180ms ease, opacity 160ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
        animation: hy-notification-enter 180ms cubic-bezier(0.22, 1, 0.36, 1);
        box-sizing: border-box;
      }
      .container[data-edge="bottom"] .notice {
        inset: auto 0 0;
        transform: translate3d(0, calc(var(--_depth) * -10px), calc(var(--_depth) * -24px)) scale(calc(1 - var(--_depth) * 0.035));
        transform-origin: bottom center;
      }
      .container:hover .notice,
      .container:focus-within .notice {
        transform: translate3d(0, calc(var(--_order) * 94px), 0) scale(1);
      }
      .container[data-edge="bottom"]:hover .notice,
      .container[data-edge="bottom"]:focus-within .notice {
        transform: translate3d(0, calc(var(--_order) * -94px), 0) scale(1);
      }
      .notice[data-type="success"] { --_tone: var(--hy-success-color, #55c98a); }
      .notice[data-type="info"] { --_tone: var(--hy-info-color, var(--hy-accent-color, #58a6ff)); }
      .notice[data-type="warning"] { --_tone: var(--hy-warning-color, #e7b75a); }
      .notice[data-type="error"] { --_tone: var(--hy-error-color, #ef6b78); }
      .notice.closing {
        opacity: 0;
        pointer-events: none;
        transform: translate3d(18px, calc(var(--_depth) * 10px), -40px) scale(0.94);
      }
      .container[data-edge="bottom"] .notice.closing {
        transform: translate3d(18px, calc(var(--_depth) * -10px), -40px) scale(0.94);
      }
      .icon {
        display: grid;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        place-items: center;
        color: var(--_tone);
        background: var(--_soft);
      }
      .icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2; }
      .content { min-width: 0; padding-top: 1px; }
      .message { margin: 0; color: inherit; font-size: 13px; font-weight: 680; overflow-wrap: anywhere; }
      .description { margin: 4px 0 0; color: var(--hy-secondary-text-color, #9aa8ba); font-size: 11px; overflow-wrap: anywhere; }
      .close {
        display: grid;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 0;
        border-radius: 5px;
        place-items: center;
        color: var(--hy-secondary-text-color, #8492a6);
        background: transparent;
        cursor: pointer;
        font: 18px/1 system-ui, sans-serif;
      }
      .close:hover { color: inherit; background: var(--hy-hover-bg-color, #242d3b); }
      .close:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 1px; }
      .progress {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: var(--hy-notification-progress-height, 3px);
        transform: scaleX(1);
        transform-origin: left;
        background: var(--_tone);
        animation: hy-notification-progress linear forwards;
      }
      @keyframes hy-notification-progress { to { transform: scaleX(0); } }
      @keyframes hy-notification-enter {
        from { opacity: 0; filter: blur(3px); }
        to { opacity: 1; filter: blur(0); }
      }
      @media (max-width: 520px) {
        .container { right: 16px !important; left: 16px !important; width: auto; transform: none !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        .notice { animation-duration: 1ms; transition-duration: 1ms; }
      }
    `;
    root.append(style);
    for (const placement of PLACEMENTS) {
      const container = document.createElement('div');
      container.className = 'container';
      container.dataset.placement = placement;
      container.dataset.edge = placement.startsWith('bottom') ? 'bottom' : 'top';
      root.append(container);
      this._containers.set(placement, container);
    }
  }

  connectedCallback(): void {
    this._syncPlacementAttribute();
  }

  disconnectedCallback(): void {
    for (const notice of this._notices.values()) this._removeNotice(notice, false);
    this._notices.clear();
    for (const container of this._containers.values()) container.replaceChildren();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'placement') this._syncPlacementAttribute();
    if (name === 'duration' && this.hasAttribute('duration') && !Number.isFinite(Number(this.getAttribute('duration')))) {
      this.setAttribute('duration', String(DEFAULT_DURATION));
    }
  }

  get placement(): HYNotificationPlacement {
    const value = this.getAttribute('placement');
    return isPlacement(value) ? value : DEFAULT_PLACEMENT;
  }
  set placement(value: HYNotificationPlacement) {
    this.setAttribute('placement', isPlacement(value) ? value : DEFAULT_PLACEMENT);
  }

  get duration(): number {
    const value = Number(this.getAttribute('duration'));
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DURATION;
  }
  set duration(value: number) {
    const normalized = Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : DEFAULT_DURATION;
    this.setAttribute('duration', String(normalized));
  }

  get showProgress(): boolean { return this.hasAttribute('show-progress'); }
  set showProgress(value: boolean) { this.toggleAttribute('show-progress', Boolean(value)); }

  get size(): number { return this._notices.size; }

  open(options: HYNotificationOptions): string {
    const key = options.key ? String(options.key) : `hy-notification-${++this._sequence}`;
    const existing = this._notices.get(key);
    if (existing) this._removeNotice(existing, false);

    const type = isType(options.type) ? options.type : 'info';
    const placement = isPlacement(options.placement) ? options.placement : this.placement;
    const duration = Number.isFinite(Number(options.duration)) && Number(options.duration) >= 0
      ? Number(options.duration)
      : this.duration;
    const showProgress = options.showProgress ?? this.showProgress;
    const element = this._createNotice(key, type, options.message, options.description, duration, showProgress);
    const notice: HYNotificationRecord = {
      key,
      type,
      placement,
      element,
      timer: null,
      exitTimer: null,
      closing: false,
    };
    this._notices.set(key, notice);
    this._containers.get(placement)?.prepend(element);
    this._updateStack(placement);
    if (duration > 0) {
      notice.timer = window.setTimeout(() => this._closeNotice(notice, 'timeout'), duration * 1000);
    }
    this.dispatchEvent(new CustomEvent<HYNotificationOpenDetail>('notification-open', {
      detail: { key, type, placement },
      bubbles: true,
      composed: true,
    }));
    return key;
  }

  success(options: string | HYNotificationMethodOptions): string { return this._openTyped('success', options); }
  info(options: string | HYNotificationMethodOptions): string { return this._openTyped('info', options); }
  warning(options: string | HYNotificationMethodOptions): string { return this._openTyped('warning', options); }
  error(options: string | HYNotificationMethodOptions): string { return this._openTyped('error', options); }

  close(key: string): void {
    const notice = this._notices.get(String(key));
    if (notice) this._closeNotice(notice, 'programmatic');
  }

  destroy(): void {
    for (const notice of [...this._notices.values()]) this._removeNotice(notice, true, 'programmatic');
  }

  private _openTyped(type: HYNotificationType, options: string | HYNotificationMethodOptions): string {
    return this.open(typeof options === 'string' ? { type, message: options } : { ...options, type });
  }

  private _createNotice(
    key: string,
    type: HYNotificationType,
    message: string,
    description: string | undefined,
    duration: number,
    showProgress: boolean,
  ): HTMLElement {
    const notice = document.createElement('article');
    notice.className = 'notice';
    notice.dataset.key = key;
    notice.dataset.type = type;
    notice.part.add('notice');
    notice.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.part.add('icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.append(this._createIcon(type));
    const content = document.createElement('div');
    content.className = 'content';
    const title = document.createElement('p');
    title.className = 'message';
    title.textContent = String(message ?? '');
    content.append(title);
    if (description) {
      const text = document.createElement('p');
      text.className = 'description';
      text.textContent = String(description);
      content.append(text);
    }
    const close = document.createElement('button');
    close.className = 'close';
    close.type = 'button';
    close.setAttribute('aria-label', `Close ${type} notification`);
    close.textContent = '×';
    close.addEventListener('click', () => {
      const record = this._notices.get(key);
      if (record) this._closeNotice(record, 'action');
    });
    notice.append(icon, content, close);
    if (showProgress && duration > 0) {
      const progress = document.createElement('span');
      progress.className = 'progress';
      progress.part.add('progress');
      progress.setAttribute('aria-hidden', 'true');
      progress.style.animationDuration = `${duration}s`;
      notice.append(progress);
    }
    return notice;
  }

  private _createIcon(type: HYNotificationType): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', {
      success: 'M5 12.5 9.2 17 19 7',
      info: 'M12 10v7M12 7h.01',
      warning: 'M12 6v8M12 18h.01',
      error: 'm7.5 7.5 9 9m0-9-9 9',
    }[type]);
    svg.append(path);
    return svg;
  }

  private _closeNotice(notice: HYNotificationRecord, reason: HYNotificationCloseReason): void {
    if (notice.closing || this._notices.get(notice.key) !== notice) return;
    notice.closing = true;
    if (notice.timer !== null) window.clearTimeout(notice.timer);
    notice.timer = null;
    notice.element.classList.add('closing');
    notice.exitTimer = window.setTimeout(() => this._removeNotice(notice, true, reason), EXIT_DURATION);
  }

  private _removeNotice(
    notice: HYNotificationRecord,
    emit: boolean,
    reason: HYNotificationCloseReason = 'programmatic',
  ): void {
    if (notice.timer !== null) window.clearTimeout(notice.timer);
    if (notice.exitTimer !== null) window.clearTimeout(notice.exitTimer);
    notice.timer = null;
    notice.exitTimer = null;
    notice.element.remove();
    if (this._notices.get(notice.key) === notice) this._notices.delete(notice.key);
    this._updateStack(notice.placement);
    if (!emit) return;
    this.dispatchEvent(new CustomEvent<HYNotificationCloseDetail>('notification-close', {
      detail: { key: notice.key, type: notice.type, placement: notice.placement, reason },
      bubbles: true,
      composed: true,
    }));
  }

  private _updateStack(placement: HYNotificationPlacement): void {
    const container = this._containers.get(placement);
    if (!container) return;
    const notices = [...container.querySelectorAll<HTMLElement>('.notice')];
    notices.forEach((notice, index) => {
      notice.style.setProperty('--_order', String(index));
      notice.style.setProperty('--_depth', String(Math.min(index, 6)));
    });
  }

  private _syncPlacementAttribute(): void {
    const value = this.getAttribute('placement');
    if (value !== null && !isPlacement(value)) this.setAttribute('placement', DEFAULT_PLACEMENT);
  }
}

export function defineNotificationComponents(): void {
  if (!customElements.get('hy-notification')) customElements.define('hy-notification', HYNotification);
}
