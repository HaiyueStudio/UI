import { HYPointerDrag } from './internal/pointer-drag.js';
import { cloneDragPreview } from './internal/drag-preview.js';
import type { HYDragPreview } from './internal/drag-preview.js';
import { boundedMilliseconds, finiteNumber } from './internal/numbers.js';
import { focusableElements } from './internal/focus.js';

export type HYBadgeStatus = 'default' | 'success' | 'processing' | 'warning' | 'error';
export type HYBadgeSize = 'default' | 'small';
export type HYBadgeCount = number | string | null;
export interface HYBadgeRemoveDetail { readonly count: HYBadgeCount; readonly dot: boolean; readonly distance: number; readonly source: 'pointer' | 'keyboard'; }

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
  private readonly _pointer = new HYPointerDrag();
  private _drag: { preview: HYDragPreview; x: number; y: number } | null = null;
  private _stopRemoveEffect: (() => void) | null = null;
  private _suppressClick = false;

  static get observedAttributes(): string[] {
    return ['literal', 'count', 'overflow-count', 'show-zero', 'dot', 'status', 'color', 'text', 'offset-x', 'offset-y', 'size', 'title', 'aria-label', 'drag-removable', 'remove-distance', 'removed', 'hidden'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; max-width: 100%; color: var(--hy-text-color, #eef3ff); font: var(--hy-font-size-sm, 12px)/var(--hy-line-height-snug, 1.4) var(--hy-font-family, system-ui, sans-serif); vertical-align: middle; }
      :host([hidden]) { display: none !important; }
      .wrapper { position: relative; display: inline-flex; max-width: 100%; align-items: center; }
      .badge { display: inline-flex; min-width: var(--hy-badge-height, 20px); height: var(--hy-badge-height, 20px); align-items: center; justify-content: center; box-sizing: border-box; margin: 0; padding: 0 var(--hy-badge-padding, var(--hy-space-3, 6px)); border: var(--hy-badge-border-width, 2px) solid var(--hy-surface-color, #111722); border-radius: var(--hy-radius-full, 999px); color: var(--hy-badge-text-color, var(--hy-on-status-color, #fff)); background: var(--_badge-color, var(--hy-error-color, #ef5b72)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--_badge-color, var(--hy-error-color, #ef5b72)) 12%, transparent); font: calc(var(--hy-font-weight-semibold, 600) + 50) var(--hy-badge-font-size, calc(var(--hy-font-size-xs, 10px) + 1px))/var(--hy-line-height-tight, 1) var(--hy-font-family, system-ui, sans-serif); white-space: nowrap; }
      .wrapper.has-content .badge { position: absolute; z-index: 1; inset-block-start: 0; inset-inline-end: 0; transform: translate(calc(50% + var(--_offset-x, 0px)), calc(-50% + var(--_offset-y, 0px))); transform-origin: 100% 0; }
      .badge.dot { min-width: var(--hy-badge-dot-size, 8px); width: var(--hy-badge-dot-size, 8px); height: var(--hy-badge-dot-size, 8px); padding: 0; border-width: var(--hy-badge-dot-border-width, 1px); }
      .badge[hidden], .status[hidden] { display: none; }
      .badge.removable { cursor: grab; touch-action: none; user-select: none; }
      .badge.dragging { opacity: 0; }
      .badge:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 2px; }
      .status { display: inline-flex; align-items: center; gap: var(--hy-badge-status-gap, calc(var(--hy-space-3, 6px) + 1px)); color: var(--hy-secondary-text-color, #aebbd0); }
      .wrapper.has-content .status { margin-inline-start: var(--hy-space-5, 10px); }
      .status-dot { position: relative; width: var(--hy-badge-status-size, 8px); height: var(--hy-badge-status-size, 8px); flex: 0 0 auto; border-radius: 50%; background: var(--_badge-color, var(--hy-muted-color, #788697)); }
      .status.processing .status-dot::after { content: ''; position: absolute; inset: -3px; border: 1px solid var(--_badge-color, var(--hy-accent-color, #79a8ff)); border-radius: inherit; animation: hy-badge-pulse 1.5s ease-out infinite; }
      :host([size="small"]) .badge { --hy-badge-height: 16px; --hy-badge-padding: var(--hy-space-2, 4px); --hy-badge-font-size: calc(var(--hy-font-size-xs, 10px) - 1px); }
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
    this._badge.addEventListener('pointerdown', this._onPointerDown);
    this._badge.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.isComposing || !['Delete', 'Backspace'].includes(event.key) || !this.dragRemovable || this._badge.hidden) return;
      event.preventDefault(); event.stopPropagation(); this._pointer.cancel(); this._dismiss(0, 'keyboard');
    });
    this.addEventListener('pointerdown', () => { this._suppressClick = false; }, { capture: true });
    this.addEventListener('click', event => { if (this._suppressClick) { this._suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); } }, { capture: true });
  }

  connectedCallback(): void { this._render(); }
  disconnectedCallback(): void { this._pointer.cancel(); this._stopRemoveEffect?.(); this._suppressClick = false; }
  attributeChangedCallback(): void { this._pointer.cancel(); this._render(); }

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
  get dragRemovable(): boolean { return this.hasAttribute('drag-removable'); }
  set dragRemovable(value: boolean) { this.toggleAttribute('drag-removable', Boolean(value)); }
  get removeDistance(): number { return Math.max(1, Math.min(10000, finiteNumber(this.getAttribute('remove-distance'), 80))); }
  set removeDistance(value: number) { this.setAttribute('remove-distance', String(value)); }
  get removed(): boolean { return this.hasAttribute('removed'); }
  set removed(value: boolean) { this.toggleAttribute('removed', Boolean(value)); }

  private _onPointerDown = (event: PointerEvent): void => {
    if (event.defaultPrevented || !this.dragRemovable || this._badge.hidden || this.hidden) return;
    if (this._pointer.start(event, this._badge, {
      start: origin => {
        const preview = this._liquidPreview(origin.clientX, origin.clientY);
        preview.element.dataset.hyBadgeDrag = ''; this._drag = { preview, x: origin.clientX, y: origin.clientY };
        this._badge.classList.add('dragging'); this._suppressClick = true; return true;
      },
      move: move => this._drag?.preview.move(move.clientX, move.clientY),
      end: (up, cancelled) => {
        const drag = this._drag; this._drag = null; this._badge.classList.remove('dragging');
        if (!drag) return;
        if (cancelled) { drag.preview.destroy(); return; }
        drag.preview.move(up.clientX, up.clientY);
        const distance = Math.hypot(up.clientX - drag.x, up.clientY - drag.y);
        if (distance < this.removeDistance || !this._dismiss(distance, 'pointer', drag.preview)) drag.preview.destroy();
      },
    }, 4)) event.stopPropagation();
  };
  private _dismiss(distance: number, source: HYBadgeRemoveDetail['source'], preview?: HYDragPreview): boolean {
    if (!this.dragRemovable || this.removed || this.status || this._badge.hidden || !this.isConnected) return false;
    const detail: HYBadgeRemoveDetail = { count: this.count, dot: this.dot, distance, source };
    if (!this.dispatchEvent(new CustomEvent<HYBadgeRemoveDetail>('badge-remove', { detail, bubbles: true, composed: true, cancelable: true })) ||
      !this.isConnected || !this.dragRemovable || this.status || this.count !== detail.count || this.dot !== detail.dot) return false;
    const focused = this.shadowRoot?.activeElement === this._badge;
    this.removed = true;
    if (preview) this._removePreview(preview);
    if (focused) focusableElements(this)[0]?.focus({ preventScroll: true });
    return true;
  }

  /** A distance-driven metaball bridge keeps the label crisp above the liquid silhouette. */
  private _liquidPreview(x: number, y: number): HYDragPreview {
    const preview = cloneDragPreview(this._badge, { x, y }, 1);
    const rect = this._badge.getBoundingClientRect(), style = getComputedStyle(this._badge);
    const svg = this.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const anchor = this.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const bridge = this.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
    const body = this.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
    svg.dataset.hyBadgeLiquid = ''; anchor.dataset.hyBadgeAnchor = ''; bridge.dataset.hyBadgeBridge = ''; body.dataset.hyBadgeBody = '';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('width', String(rect.width)); svg.setAttribute('height', String(rect.height));
    svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none;';
    svg.setAttribute('fill', style.backgroundColor);
    const borderX = Number.parseFloat(style.borderLeftWidth) || 0, borderY = Number.parseFloat(style.borderTopWidth) || 0;
    const width = Math.max(0, rect.width - borderX * 2), height = Math.max(0, rect.height - borderY * 2);
    const radius = Math.min(width, height) / 2, halfSegment = Math.max(0, (width - height) / 2);
    const cx = rect.width / 2, cy = rect.height / 2;
    for (const [name, value] of Object.entries({ x: borderX, y: borderY, width, height, rx: radius })) body.setAttribute(name, String(value));
    svg.append(bridge, anchor, body);
    const label = preview.element.firstElementChild as HTMLElement;
    for (const [name, value] of Object.entries({ background: 'transparent', 'border-color': 'transparent', 'box-shadow': 'none' })) label.style.setProperty(name, value, 'important');
    preview.element.prepend(svg);
    return {
      element: preview.element,
      move: (nextX, nextY) => {
        preview.move(nextX, nextY);
        const dx = nextX - x, dy = nextY - y, progress = Math.min(1, Math.hypot(dx, dy) / this.removeDistance);
        const blend = progress * progress * (3 - 2 * progress), r = radius * (1 - blend);
        const ax = cx - dx, ay = cy - dy;
        anchor.setAttribute('cx', String(ax)); anchor.setAttribute('cy', String(ay)); anchor.setAttribute('r', String(r));
        const connected = progress < 1 && r > .01 && radius > 0;
        anchor.style.display = bridge.style.display = connected ? '' : 'none';
        if (!connected) return;
        // Connect to the nearest point on a capsule's center segment, including wide count labels.
        const bx = cx + Math.max(-halfSegment, Math.min(halfSegment, ax - cx)), by = cy;
        const distance = Math.hypot(bx - ax, by - ay);
        if (distance < .01) { bridge.setAttribute('d', ''); return; }
        const ux = (bx - ax) / distance, uy = (by - ay) / distance, nx = -uy, ny = ux;
        const middle = distance * r / (r + radius);
        const overlap = Math.max(0, 1 - distance / (r + radius));
        const neck = r * (1 - .75 * blend) + radius * .2 * overlap;
        const first = middle * .45, second = (distance - middle) * .45;
        const point = (along: number, normal: number): string => `${(ax + ux * along + nx * normal).toFixed(3)},${(ay + uy * along + ny * normal).toFixed(3)}`;
        bridge.setAttribute('d', `M${point(0, r)} C${point(first, r)} ${point(middle - first, neck)} ${point(middle, neck)} C${point(middle + second, neck)} ${point(distance - second, radius)} ${point(distance, radius)} L${point(distance, -radius)} C${point(distance - second, -radius)} ${point(middle + second, -neck)} ${point(middle, -neck)} C${point(middle - first, -neck)} ${point(first, -r)} ${point(0, -r)} Z`);
      },
      destroy: () => preview.destroy(),
    };
  }

  /** The accepted removal is immediate; only its inert top-layer visual fades out. */
  private _removePreview(preview: HYDragPreview): void {
    this._stopRemoveEffect?.();
    const motion = this.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');
    const style = getComputedStyle(this);
    const duration = boundedMilliseconds(style.getPropertyValue('--hy-badge-remove-duration').trim(), 420);
    const element = preview.element;
    if (!duration || motion.matches) { preview.destroy(); return; }
    const timing = style.getPropertyValue('--hy-badge-remove-easing').trim();
    const easing = timing && CSS.supports('animation-timing-function', timing) ? timing : 'ease-out';
    const animations: Animation[] = [];
    let disposed = false;
    const stop = (): void => {
      if (disposed) return;
      disposed = true;
      motion.removeEventListener('change', onMotion);
      for (const animation of animations) animation.cancel();
      preview.destroy();
      if (this._stopRemoveEffect === stop) this._stopRemoveEffect = null;
    };
    const onMotion = (): void => { if (motion.matches) stop(); };
    this._stopRemoveEffect = stop; motion.addEventListener('change', onMotion);
    element.removeAttribute('data-hy-badge-drag'); element.dataset.hyBadgeRemove = '';
    try {
      element.querySelector('[data-hy-badge-anchor]')?.remove(); element.querySelector('[data-hy-badge-bridge]')?.remove();
      const visual = this.ownerDocument.createElement('span');
      visual.style.cssText = 'position:absolute;inset:0;transform-origin:center;';
      visual.append(...element.childNodes); element.append(visual);
      animations.push(visual.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.35)' }], { duration, easing, fill: 'both' }));
      void Promise.allSettled(animations.map(animation => animation.finished)).then(stop);
    } catch { stop(); }
  }

  private _render(): void {
    this._pointer.cancel();
    this._stopRemoveEffect?.();
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
    this._badge.hidden = !showBadge || this.removed; this._badge.classList.toggle('dot', this.dot); this._badgeContent.textContent = display;
    const removable = this.dragRemovable && showBadge && !this.removed;
    this._badge.classList.toggle('removable', removable); this._badge.tabIndex = removable ? 0 : -1;
    if (removable) { this._badge.setAttribute('aria-description', `Drag ${this.removeDistance} pixels away and release, or press Delete to dismiss.`); this._badge.setAttribute('aria-keyshortcuts', 'Delete Backspace'); }
    else { this._badge.removeAttribute('aria-description'); this._badge.removeAttribute('aria-keyshortcuts'); }
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
