export type HYDraggableAxis = 'both' | 'x' | 'y';
export type HYDraggableBoundsMode = 'none' | 'parent' | 'viewport';
export type HYDraggableBounds = HYDraggableBoundsMode | HTMLElement;
export type HYDraggableMoveSource = 'pointer' | 'keyboard' | 'api';

export interface HYDraggablePosition { readonly x: number; readonly y: number; }
export interface HYDraggableMoveDetail extends HYDraggablePosition {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly source: HYDraggableMoveSource;
}
export interface HYDraggableStartDetail extends HYDraggablePosition {
  readonly pointerId: number;
}
export interface HYDraggableEndDetail extends HYDraggableMoveDetail {
  readonly cancelled: boolean;
}

const DEFAULT_CANCEL = 'input, textarea, select, button, a, [contenteditable="true"], [data-no-drag]';

function finiteNumber(value: unknown, fallback = 0): number {
  const number = Number(value); return Number.isFinite(number) ? number : fallback;
}
function safeMatches(element: Element, selector: string): boolean {
  try { return element.matches(selector); } catch { return false; }
}

/** Transform-based draggable container with optional handles, constraints, snapping, and keyboard movement. */
export class HYDraggable extends HTMLElement {
  private readonly _surface = document.createElement('div');
  private _x = 0;
  private _y = 0;
  private _reflecting = false;
  private _boundsTarget: HTMLElement | null = null;
  private _dragAbort: AbortController | null = null;
  private _pointerId: number | null = null;
  private _originX = 0;
  private _originY = 0;
  private _pointerX = 0;
  private _pointerY = 0;

  static get observedAttributes(): string[] {
    return ['x', 'y', 'axis', 'bounds', 'grid', 'handle', 'cancel', 'disabled', 'keyboard', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style'); const slot = document.createElement('slot');
    style.textContent = `
      :host { display: inline-block; max-width: 100%; min-width: 0; translate: var(--_hy-draggable-x, 0px) var(--_hy-draggable-y, 0px); will-change: translate; }
      .surface { min-width: 0; outline: none; cursor: var(--hy-draggable-cursor, grab); touch-action: var(--hy-draggable-touch-action, none); user-select: none; }
      :host([dragging]) { z-index: var(--hy-draggable-active-z-index, 10); }
      :host([dragging]) .surface { cursor: var(--hy-draggable-active-cursor, grabbing); }
      :host([disabled]) .surface { cursor: default; }
      .surface:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: var(--hy-draggable-focus-offset, 2px); border-radius: var(--hy-draggable-focus-radius, 6px); }
      ::slotted([data-drag-handle]) { cursor: var(--hy-draggable-cursor, grab); }
      @media (prefers-reduced-motion: reduce) { :host { scroll-behavior: auto; } }
    `;
    this._surface.className = 'surface'; this._surface.part.add('surface'); this._surface.setAttribute('role', 'group'); this._surface.append(slot); root.append(style, this._surface);
    this._surface.addEventListener('pointerdown', event => this._startPointerDrag(event));
    this._surface.addEventListener('keydown', event => this._handleKeydown(event));
  }

  connectedCallback(): void {
    this._x = finiteNumber(this.getAttribute('x'), this._x); this._y = finiteNumber(this.getAttribute('y'), this._y); this._syncPosition(); this._syncAccessibility();
  }
  disconnectedCallback(): void { this._cancelDrag(true); }
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if ((name === 'x' || name === 'y') && !this._reflecting) { this._x = finiteNumber(this.getAttribute('x'), this._x); this._y = finiteNumber(this.getAttribute('y'), this._y); this._syncPosition(); }
    else if (name === 'disabled' && this.disabled) this._cancelDrag(true);
    if (name === 'keyboard' || name === 'disabled' || name === 'aria-label') this._syncAccessibility();
  }

  get x(): number { return this._x; }
  set x(value: number) { this._setPosition(finiteNumber(value, this._x), this._y); }
  get y(): number { return this._y; }
  set y(value: number) { this._setPosition(this._x, finiteNumber(value, this._y)); }
  get position(): HYDraggablePosition { return { x: this._x, y: this._y }; }
  set position(value: HYDraggablePosition) { this._setPosition(finiteNumber(value?.x, this._x), finiteNumber(value?.y, this._y)); }
  get axis(): HYDraggableAxis { const value = this.getAttribute('axis'); return value === 'x' || value === 'y' ? value : 'both'; }
  set axis(value: HYDraggableAxis) { this.setAttribute('axis', value === 'x' || value === 'y' ? value : 'both'); }
  get bounds(): HYDraggableBounds { return this._boundsTarget ?? this.boundsMode; }
  set bounds(value: HYDraggableBounds) {
    if (value instanceof HTMLElement) { this._boundsTarget = value; this.setAttribute('bounds', 'parent'); }
    else { this._boundsTarget = null; this.setAttribute('bounds', value === 'parent' || value === 'viewport' ? value : 'none'); }
    this.refresh();
  }
  get boundsMode(): HYDraggableBoundsMode { const value = this.getAttribute('bounds'); return value === 'parent' || value === 'viewport' ? value : 'none'; }
  get grid(): number { return Math.max(1, Math.min(1000, finiteNumber(this.getAttribute('grid'), 1))); }
  set grid(value: number) { this.setAttribute('grid', String(Math.max(1, Math.min(1000, finiteNumber(value, 1))))); }
  get handle(): string { return this.getAttribute('handle')?.trim() ?? ''; }
  set handle(value: string) { const normalized = String(value).trim(); if (normalized) this.setAttribute('handle', normalized); else this.removeAttribute('handle'); }
  get cancel(): string { return this.getAttribute('cancel')?.trim() || DEFAULT_CANCEL; }
  set cancel(value: string) { const normalized = String(value).trim(); if (normalized) this.setAttribute('cancel', normalized); else this.removeAttribute('cancel'); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }
  get keyboard(): boolean { return this.getAttribute('keyboard') !== 'false'; }
  set keyboard(value: boolean) { this.setAttribute('keyboard', String(Boolean(value))); }
  get dragging(): boolean { return this._pointerId != null; }

  moveTo(x: number, y: number): HYDraggablePosition { return this._moveTo(x, y, 'api'); }
  moveBy(deltaX: number, deltaY: number): HYDraggablePosition { return this._moveTo(this._x + finiteNumber(deltaX), this._y + finiteNumber(deltaY), 'api'); }
  reset(): HYDraggablePosition { return this._moveTo(0, 0, 'api'); }
  refresh(): HYDraggablePosition { const constrained = this._constrain(this._x, this._y); this._setPosition(constrained.x, constrained.y); return this.position; }

  private _startPointerDrag(event: PointerEvent): void {
    if (this.disabled || event.button !== 0 || this._pointerId != null || !this._allowsTarget(event)) return;
    const start = new CustomEvent<HYDraggableStartDetail>('drag-start', { bubbles: true, composed: true, cancelable: true, detail: { x: this._x, y: this._y, pointerId: event.pointerId } });
    if (!this.dispatchEvent(start)) return; event.preventDefault(); this._surface.focus({ preventScroll: true }); this._surface.setPointerCapture(event.pointerId);
    this._pointerId = event.pointerId; this._originX = this._x; this._originY = this._y; this._pointerX = event.clientX; this._pointerY = event.clientY; this.toggleAttribute('dragging', true);
    const abort = new AbortController(); this._dragAbort = abort;
    this._surface.addEventListener('pointermove', move => this._handlePointerMove(move), { signal: abort.signal });
    this._surface.addEventListener('pointerup', up => this._finishPointerDrag(up, false), { signal: abort.signal });
    this._surface.addEventListener('pointercancel', cancel => this._finishPointerDrag(cancel, true), { signal: abort.signal });
    this._surface.addEventListener('lostpointercapture', () => this._cancelDrag(true), { signal: abort.signal });
  }
  private _handlePointerMove(event: PointerEvent): void {
    if (event.pointerId !== this._pointerId) return; event.preventDefault(); const x = this.axis === 'y' ? this._originX : this._originX + event.clientX - this._pointerX; const y = this.axis === 'x' ? this._originY : this._originY + event.clientY - this._pointerY; this._moveTo(x, y, 'pointer');
  }
  private _finishPointerDrag(event: PointerEvent, cancelled: boolean): void {
    this._completePointerDrag(event.pointerId, cancelled);
  }
  private _completePointerDrag(pointerId: number, cancelled: boolean): void {
    if (pointerId !== this._pointerId) return; const originX = this._originX; const originY = this._originY; this._dragAbort?.abort(); this._dragAbort = null; this._pointerId = null; this.toggleAttribute('dragging', false);
    if (this._surface.hasPointerCapture(pointerId)) this._surface.releasePointerCapture(pointerId);
    this.dispatchEvent(new CustomEvent<HYDraggableEndDetail>('drag-end', { bubbles: true, composed: true, detail: { x: this._x, y: this._y, deltaX: this._x - originX, deltaY: this._y - originY, source: 'pointer', cancelled } }));
  }
  private _cancelDrag(cancelled: boolean): void {
    if (this._pointerId == null) return; this._completePointerDrag(this._pointerId, cancelled);
  }
  private _handleKeydown(event: KeyboardEvent): void {
    if (this.disabled || !this.keyboard) return; const multiplier = event.shiftKey ? 10 : 1; const step = this.grid * multiplier; let x = this._x; let y = this._y;
    if (event.key === 'ArrowLeft' && this.axis !== 'y') x -= step; else if (event.key === 'ArrowRight' && this.axis !== 'y') x += step; else if (event.key === 'ArrowUp' && this.axis !== 'x') y -= step; else if (event.key === 'ArrowDown' && this.axis !== 'x') y += step; else if (event.key === 'Home') { x = 0; y = 0; } else return;
    event.preventDefault(); this._moveTo(x, y, 'keyboard');
  }
  private _allowsTarget(event: PointerEvent): boolean {
    const elements = event.composedPath().filter((node): node is Element => node instanceof Element && node !== this._surface && node !== this);
    if (elements.some(element => safeMatches(element, this.cancel))) return false;
    if (!this.handle) return true;
    return elements.some(element => safeMatches(element, this.handle));
  }
  private _moveTo(x: number, y: number, source: HYDraggableMoveSource): HYDraggablePosition {
    const oldX = this._x; const oldY = this._y; const restrictAxis = source !== 'api'; const snappedX = restrictAxis && this.axis === 'y' ? oldX : Math.round(finiteNumber(x, oldX) / this.grid) * this.grid; const snappedY = restrictAxis && this.axis === 'x' ? oldY : Math.round(finiteNumber(y, oldY) / this.grid) * this.grid; const next = this._constrain(snappedX, snappedY);
    if (next.x === oldX && next.y === oldY) return this.position; this._setPosition(next.x, next.y); this.dispatchEvent(new CustomEvent<HYDraggableMoveDetail>('drag-move', { bubbles: true, composed: true, detail: { x: next.x, y: next.y, deltaX: next.x - oldX, deltaY: next.y - oldY, source } })); return this.position;
  }
  private _constrain(x: number, y: number): HYDraggablePosition {
    const target = this._boundsTarget ?? (this.boundsMode === 'parent' ? this.parentElement : null); const targetRect = target?.getBoundingClientRect();
    const bounds = target && targetRect ? { left: targetRect.left + target.clientLeft, top: targetRect.top + target.clientTop, right: targetRect.left + target.clientLeft + target.clientWidth, bottom: targetRect.top + target.clientTop + target.clientHeight } : this.boundsMode === 'viewport' ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight } : null;
    if (!bounds || !this.isConnected) return { x, y }; const rect = this.getBoundingClientRect(); const baseLeft = rect.left - this._x; const baseTop = rect.top - this._y; const width = rect.width; const height = rect.height;
    const minX = bounds.left - baseLeft; const maxX = bounds.right - baseLeft - width; const minY = bounds.top - baseTop; const maxY = bounds.bottom - baseTop - height;
    return { x: minX <= maxX ? Math.min(maxX, Math.max(minX, x)) : minX, y: minY <= maxY ? Math.min(maxY, Math.max(minY, y)) : minY };
  }
  private _setPosition(x: number, y: number): void {
    this._x = x; this._y = y; this._syncPosition(); this._reflectPosition();
  }
  private _syncPosition(): void { this.style.setProperty('--_hy-draggable-x', `${this._x}px`); this.style.setProperty('--_hy-draggable-y', `${this._y}px`); }
  private _reflectPosition(): void {
    const x = String(Math.round(this._x * 1000) / 1000); const y = String(Math.round(this._y * 1000) / 1000); this._reflecting = true; if (this.getAttribute('x') !== x) this.setAttribute('x', x); if (this.getAttribute('y') !== y) this.setAttribute('y', y); this._reflecting = false;
  }
  private _syncAccessibility(): void {
    this._surface.tabIndex = this.keyboard && !this.disabled ? 0 : -1; this._surface.setAttribute('aria-disabled', String(this.disabled)); this._surface.setAttribute('aria-label', this.getAttribute('aria-label') || 'Draggable container');
  }
}

export function defineDraggableComponents(): void {
  if (!customElements.get('hy-draggable')) customElements.define('hy-draggable', HYDraggable);
}
