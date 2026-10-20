export type HYBadgeStatus = 'default' | 'success' | 'processing' | 'warning' | 'error';
export type HYBadgeSize = 'default' | 'small';
export type HYBadgeCount = number | string | null;

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.floor(number))) : fallback;
}

/** Count, dot, or semantic status badge that can decorate slotted content. */
export class HYBadge extends HTMLElement {
  private readonly _wrapper = document.createElement('span');
  private readonly _slot = document.createElement('slot');
  private readonly _badge = document.createElement('sup');
  private readonly _badgeContent = document.createElement('span');
  private readonly _status = document.createElement('span');
  private readonly _statusDot = document.createElement('span');
  private readonly _statusText = document.createElement('span');

  static get observedAttributes(): string[] {
    return ['literal', 'count', 'overflow-count', 'show-zero', 'dot', 'status', 'color', 'text', 'offset-x', 'offset-y', 'size', 'title', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; max-width: 100%; color: var(--hy-text-color, #eef3ff); font: 12px/1.4 system-ui, sans-serif; vertical-align: middle; }
      .wrapper { position: relative; display: inline-flex; max-width: 100%; align-items: center; }
      .badge { display: inline-flex; min-width: var(--hy-badge-height, 20px); height: var(--hy-badge-height, 20px); align-items: center; justify-content: center; box-sizing: border-box; margin: 0; padding: 0 var(--hy-badge-padding, 6px); border: var(--hy-badge-border-width, 2px) solid var(--hy-surface-color, #111722); border-radius: 999px; color: var(--hy-badge-text-color, #fff); background: var(--_badge-color, var(--hy-error-color, #ef5b72)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--_badge-color, var(--hy-error-color, #ef5b72)) 12%, transparent); font: 650 var(--hy-badge-font-size, 11px)/1 system-ui, sans-serif; white-space: nowrap; }
      .wrapper.has-content .badge { position: absolute; z-index: 1; inset-block-start: 0; inset-inline-end: 0; transform: translate(calc(50% + var(--_offset-x, 0px)), calc(-50% + var(--_offset-y, 0px))); transform-origin: 100% 0; }
      .badge.dot { min-width: var(--hy-badge-dot-size, 8px); width: var(--hy-badge-dot-size, 8px); height: var(--hy-badge-dot-size, 8px); padding: 0; border-width: var(--hy-badge-dot-border-width, 1px); }
      .badge[hidden], .status[hidden] { display: none; }
      .status { display: inline-flex; align-items: center; gap: var(--hy-badge-status-gap, 7px); color: var(--hy-secondary-text-color, #aebbd0); }
      .wrapper.has-content .status { margin-inline-start: 10px; }
      .status-dot { position: relative; width: var(--hy-badge-status-size, 8px); height: var(--hy-badge-status-size, 8px); flex: 0 0 auto; border-radius: 50%; background: var(--_badge-color, var(--hy-muted-color, #788697)); }
      .status.processing .status-dot::after { content: ''; position: absolute; inset: -3px; border: 1px solid var(--_badge-color, var(--hy-accent-color, #79a8ff)); border-radius: inherit; animation: hy-badge-pulse 1.5s ease-out infinite; }
      :host([size="small"]) .badge { --hy-badge-height: 16px; --hy-badge-padding: 4px; --hy-badge-font-size: 9px; }
      @keyframes hy-badge-pulse { 0% { opacity: .75; transform: scale(.55); } 100% { opacity: 0; transform: scale(1.35); } }
      @media (prefers-reduced-motion: reduce) { .status.processing .status-dot::after { animation: none; } }
    `;
    this._wrapper.className = 'wrapper'; this._wrapper.part.add('wrapper');
    this._badge.className = 'badge'; this._badge.part.add('badge'); this._badge.setAttribute('role', 'status'); this._badge.setAttribute('aria-live', 'polite');
    this._badgeContent.part.add('badge-content'); this._badge.append(this._badgeContent);
    this._status.className = 'status'; this._status.part.add('status'); this._status.setAttribute('role', 'status');
    this._statusDot.className = 'status-dot'; this._statusDot.part.add('status-dot');
    this._statusText.className = 'status-text'; this._statusText.part.add('status-text'); this._status.append(this._statusDot, this._statusText);
    this._wrapper.append(this._slot, this._badge, this._status); root.append(style, this._wrapper);
    this._slot.addEventListener('slotchange', () => this._render());
  }

  connectedCallback(): void { this._render(); }
  attributeChangedCallback(): void { this._render(); }

  /** Opt-in literal label; preserve zeros and bypass numeric overflow formatting. */
  get literal(): boolean { return this.hasAttribute('literal'); }
  set literal(value: boolean) { this.toggleAttribute('literal', Boolean(value)); }
  get count(): HYBadgeCount {
    const value = this.getAttribute('count');
    if (value == null) return null;
    if (this.literal) return value;
    if (/^-?\d+(?:\.\d+)?$/u.test(value.trim())) return Number(value);
    return value;
  }
  set count(value: HYBadgeCount) { if (value == null) this.removeAttribute('count'); else this.setAttribute('count', String(value)); }
  get overflowCount(): number { return boundedInteger(this.getAttribute('overflow-count'), 99, 0, 999999); }
  set overflowCount(value: number) { this.setAttribute('overflow-count', String(boundedInteger(value, 99, 0, 999999))); }
  get showZero(): boolean { return this.hasAttribute('show-zero'); }
  set showZero(value: boolean) { this.toggleAttribute('show-zero', Boolean(value)); }
  get dot(): boolean { return this.hasAttribute('dot'); }
  set dot(value: boolean) { this.toggleAttribute('dot', Boolean(value)); }
  get status(): HYBadgeStatus | null {
    const value = this.getAttribute('status');
    return value === 'default' || value === 'success' || value === 'processing' || value === 'warning' || value === 'error' ? value : null;
  }
  set status(value: HYBadgeStatus | null) { if (value == null) this.removeAttribute('status'); else this.setAttribute('status', value); }
  get color(): string { return this.getAttribute('color')?.trim() ?? ''; }
  set color(value: string) { const normalized = String(value).trim(); if (normalized) this.setAttribute('color', normalized); else this.removeAttribute('color'); }
  get text(): string { return this.getAttribute('text') ?? ''; }
  set text(value: string) { const normalized = String(value); if (normalized) this.setAttribute('text', normalized); else this.removeAttribute('text'); }
  get offset(): readonly [number, number] { return [this.offsetX, this.offsetY]; }
  set offset(value: readonly [number, number]) { this.offsetX = value?.[0] ?? 0; this.offsetY = value?.[1] ?? 0; }
  get offsetX(): number { return boundedInteger(this.getAttribute('offset-x'), 0, -1000, 1000); }
  set offsetX(value: number) { this.setAttribute('offset-x', String(boundedInteger(value, 0, -1000, 1000))); }
  get offsetY(): number { return boundedInteger(this.getAttribute('offset-y'), 0, -1000, 1000); }
  set offsetY(value: number) { this.setAttribute('offset-y', String(boundedInteger(value, 0, -1000, 1000))); }
  get size(): HYBadgeSize { return this.getAttribute('size') === 'small' ? 'small' : 'default'; }
  set size(value: HYBadgeSize) { if (value === 'small') this.setAttribute('size', 'small'); else this.removeAttribute('size'); }

  private _render(): void {
    if (!this.isConnected) return;
    const hasContent = this._slot.assignedNodes().some(node => node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()));
    this._wrapper.classList.toggle('has-content', hasContent);
    this.style.setProperty('--_offset-x', `${this.offsetX}px`); this.style.setProperty('--_offset-y', `${this.offsetY}px`);
    const status = this.status; const color = this.color || this._statusColor(status);
    if (color) this.style.setProperty('--_badge-color', color); else this.style.removeProperty('--_badge-color');
    const showStatus = status != null;
    this._status.hidden = !showStatus; this._status.className = `status${status ? ` ${status}` : ''}`; this._statusText.textContent = this.text;
    const statusLabel = this.getAttribute('aria-label') || this.text || status || '';
    if (statusLabel) this._status.setAttribute('aria-label', statusLabel); else this._status.removeAttribute('aria-label');
    const value = this.count; const numeric = typeof value === 'number'; const hiddenByZero = numeric && value === 0 && !this.showZero;
    const showBadge = !showStatus && (this.dot || (value != null && value !== '')) && !hiddenByZero;
    const display = this.dot ? '' : numeric && value > this.overflowCount ? `${this.overflowCount}+` : String(value ?? '');
    this._badge.hidden = !showBadge; this._badge.classList.toggle('dot', this.dot); this._badgeContent.textContent = display;
    const badgeLabel = this.getAttribute('aria-label') || (this.dot ? 'Notification' : display);
    if (badgeLabel) { this._badge.setAttribute('aria-label', badgeLabel); this._badge.title = this.getAttribute('title') || (this.dot ? '' : String(value ?? '')); }
    else { this._badge.removeAttribute('aria-label'); this._badge.removeAttribute('title'); }
  }

  private _statusColor(status: HYBadgeStatus | null): string {
    if (status === 'success') return 'var(--hy-success-color, #45c795)';
    if (status === 'processing') return 'var(--hy-accent-color, #79a8ff)';
    if (status === 'warning') return 'var(--hy-warning-color, #f2b84b)';
    if (status === 'error') return 'var(--hy-error-color, #ef5b72)';
    return status === 'default' ? 'var(--hy-muted-color, #788697)' : '';
  }
}

export function defineBadgeComponents(): void {
  if (!customElements.get('hy-badge')) customElements.define('hy-badge', HYBadge);
}
