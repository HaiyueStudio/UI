export type HYResizableHandle = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export type HYResizableBoundsMode = 'none' | 'parent' | 'viewport';
export type HYResizableBounds = HYResizableBoundsMode | HTMLElement;
export type HYResizableSource = 'pointer' | 'keyboard' | 'api';

export interface HYResizableRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HYResizableChangeDetail extends HYResizableRect {
  readonly handle: HYResizableHandle;
  readonly source: HYResizableSource;
}

export interface HYResizableEndDetail extends HYResizableChangeDetail {
  readonly cancelled: boolean;
}

const HANDLES: readonly Exclude<HYResizableHandle, 'move'>[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const DEFAULT_CANCEL = 'input, textarea, select, button, a, [contenteditable="true"], [data-no-move]';

function finiteNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value: unknown, fallback: number): number {
  return Math.max(0, finiteNumber(value, fallback));
}

function safeMatches(element: Element, selector: string): boolean {
  try { return element.matches(selector); } catch { return false; }
}

/** Eight-handle resize frame that can also move its slotted content. */
export class HYResizable extends HTMLElement {
  private readonly _frame = document.createElement('div');
  private readonly _content = document.createElement('div');
  private readonly _handles = new Map<Exclude<HYResizableHandle, 'move'>, HTMLElement>();
  private _x = 0;
  private _y = 0;
  private _width = 200;
  private _height = 120;
  private _initialRect: HYResizableRect | null = null;
  private _boundsTarget: HTMLElement | null = null;
  private _reflecting = false;
  private _pointerId: number | null = null;
  private _activeHandle: HYResizableHandle = 'move';
  private _origin: HYResizableRect = { x: 0, y: 0, width: 200, height: 120 };
  private _pointerX = 0;
  private _pointerY = 0;
  private _dragAbort: AbortController | null = null;

  static get observedAttributes(): string[] {
    return [
      'x', 'y', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
      'grid', 'aspect-ratio', 'bounds', 'disabled', 'movable', 'keyboard', 'cancel', 'aria-label',
    ];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    const slot = document.createElement('slot');
    style.textContent = `
      :host {
        position: absolute;
        display: block;
        left: 0;
        top: 0;
        width: var(--_hy-resizable-width, 200px);
        height: var(--_hy-resizable-height, 120px);
        min-width: 0;
        min-height: 0;
        box-sizing: border-box;
        translate: var(--_hy-resizable-x, 0px) var(--_hy-resizable-y, 0px);
      }
      .frame { position: relative; width: 100%; height: 100%; box-sizing: border-box; outline: none; }
      .frame::after {
        position: absolute;
        z-index: 2;
        inset: 0;
        border: var(--hy-resizable-border-width, 1px) var(--hy-resizable-border-style, solid) var(--hy-resizable-border-color, var(--hy-accent-color, #79a8ff));
        border-radius: var(--hy-resizable-radius, 5px);
        pointer-events: none;
        content: '';
      }
      .frame:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 3px; }
      .content { width: 100%; height: 100%; overflow: var(--hy-resizable-content-overflow, hidden); border-radius: var(--hy-resizable-radius, 5px); }
      :host(:not([disabled])) .content { cursor: var(--hy-resizable-move-cursor, move); }
      :host([movable="false"]) .content, :host([disabled]) .content { cursor: default; }
      .handle { position: absolute; z-index: 3; box-sizing: border-box; touch-action: none; outline: none; }
      .handle:focus-visible { filter: drop-shadow(0 0 3px var(--hy-focus-border-color, #79a8ff)); }
      .handle.n, .handle.s { left: var(--hy-resizable-corner-size, 10px); right: var(--hy-resizable-corner-size, 10px); height: var(--hy-resizable-edge-size, 8px); cursor: ns-resize; }
      .handle.e, .handle.w { top: var(--hy-resizable-corner-size, 10px); bottom: var(--hy-resizable-corner-size, 10px); width: var(--hy-resizable-edge-size, 8px); cursor: ew-resize; }
      .handle.n { top: calc(var(--hy-resizable-edge-size, 8px) / -2); }
      .handle.s { bottom: calc(var(--hy-resizable-edge-size, 8px) / -2); }
      .handle.e { right: calc(var(--hy-resizable-edge-size, 8px) / -2); }
      .handle.w { left: calc(var(--hy-resizable-edge-size, 8px) / -2); }
      .handle.ne, .handle.se, .handle.sw, .handle.nw {
        width: var(--hy-resizable-corner-hit-size, 18px);
        height: var(--hy-resizable-corner-hit-size, 18px);
      }
      .handle.ne, .handle.sw { cursor: nesw-resize; }
      .handle.se, .handle.nw { cursor: nwse-resize; }
      .handle.ne { top: -9px; right: -9px; }
      .handle.se { right: -9px; bottom: -9px; }
      .handle.sw { bottom: -9px; left: -9px; }
      .handle.nw { top: -9px; left: -9px; }
      .handle::after {
        position: absolute;
        width: var(--hy-resizable-corner-size, 10px);
        height: var(--hy-resizable-corner-size, 10px);
        box-sizing: border-box;
        border: 1px solid var(--hy-resizable-handle-border-color, #dbeeff);
        border-radius: var(--hy-resizable-handle-radius, 2px);
        background: var(--hy-resizable-handle-color, var(--hy-accent-color, #79a8ff));
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
        content: '';
      }
      .handle.n::after, .handle.s::after { left: 50%; top: 50%; translate: -50% -50%; }
      .handle.e::after, .handle.w::after { left: 50%; top: 50%; translate: -50% -50%; }
      .handle.ne::after, .handle.se::after, .handle.sw::after, .handle.nw::after { inset: 50% auto auto 50%; translate: -50% -50%; }
      :host([disabled]) .handle { display: none; }
      :host([resizing]) { z-index: var(--hy-resizable-active-z-index, 20); user-select: none; }
      ::slotted(*) { box-sizing: border-box; }
    `;
    this._frame.className = 'frame';
    this._frame.part.add('frame');
    this._content.className = 'content';
    this._content.part.add('content');
    this._content.append(slot);
    this._frame.append(this._content);
    for (const handle of HANDLES) {
      const element = document.createElement('span');
      element.className = `handle ${handle}`;
      element.dataset.resizeHandle = handle;
      element.part.add('handle', `handle-${handle}`);
      element.setAttribute('role', 'separator');
      element.setAttribute('aria-label', `${handle.toUpperCase()} resize handle`);
      this._handles.set(handle, element);
      this._frame.append(element);
    }
    root.append(style, this._frame);
    this._frame.addEventListener('pointerdown', event => this._startPointer(event));
    this._frame.addEventListener('keydown', event => this._handleKeydown(event));
  }

  connectedCallback(): void {
    this._readRectAttributes();
    this._initialRect ??= this.rect;
    this._sync();
    this._syncAccessibility();
  }

  disconnectedCallback(): void { this._cancelDrag(true); }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (!this._reflecting && ['x', 'y', 'width', 'height'].includes(name)) {
      this._readRectAttributes();
      this._sync();
    }
    if (name === 'disabled' && this.disabled) this._cancelDrag(true);
    if (name === 'disabled' || name === 'keyboard' || name === 'aria-label') this._syncAccessibility();
  }

  get x(): number { return this._x; }
  set x(value: number) { this.setRect({ ...this.rect, x: finiteNumber(value, this._x) }); }
  get y(): number { return this._y; }
  set y(value: number) { this.setRect({ ...this.rect, y: finiteNumber(value, this._y) }); }
  get width(): number { return this._width; }
  set width(value: number) { this.setRect({ ...this.rect, width: positiveNumber(value, this._width) }); }
  get height(): number { return this._height; }
  set height(value: number) { this.setRect({ ...this.rect, height: positiveNumber(value, this._height) }); }
  get rect(): HYResizableRect { return { x: this._x, y: this._y, width: this._width, height: this._height }; }

  get minWidth(): number { return positiveNumber(this.getAttribute('min-width'), 32); }
  set minWidth(value: number) { this.setAttribute('min-width', String(positiveNumber(value, 32))); }
  get minHeight(): number { return positiveNumber(this.getAttribute('min-height'), 32); }
  set minHeight(value: number) { this.setAttribute('min-height', String(positiveNumber(value, 32))); }
  get maxWidth(): number { return positiveNumber(this.getAttribute('max-width'), Number.POSITIVE_INFINITY); }
  set maxWidth(value: number) { this._setFiniteLimit('max-width', value); }
  get maxHeight(): number { return positiveNumber(this.getAttribute('max-height'), Number.POSITIVE_INFINITY); }
  set maxHeight(value: number) { this._setFiniteLimit('max-height', value); }
  get grid(): number { return Math.max(1, positiveNumber(this.getAttribute('grid'), 1)); }
  set grid(value: number) { this.setAttribute('grid', String(Math.max(1, positiveNumber(value, 1)))); }
  get aspectRatio(): number | null { const value = positiveNumber(this.getAttribute('aspect-ratio'), 0); return value > 0 ? value : null; }
  set aspectRatio(value: number | null) { if (value && value > 0) this.setAttribute('aspect-ratio', String(value)); else this.removeAttribute('aspect-ratio'); }
  get bounds(): HYResizableBounds { return this._boundsTarget ?? this.boundsMode; }
  set bounds(value: HYResizableBounds) {
    if (value instanceof HTMLElement) { this._boundsTarget = value; this.setAttribute('bounds', 'parent'); }
    else { this._boundsTarget = null; this.setAttribute('bounds', value === 'parent' || value === 'viewport' ? value : 'none'); }
    this.refresh();
  }
  get boundsMode(): HYResizableBoundsMode { const value = this.getAttribute('bounds'); return value === 'parent' || value === 'viewport' ? value : 'none'; }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }
  get movable(): boolean { return this.getAttribute('movable') !== 'false'; }
  set movable(value: boolean) { this.setAttribute('movable', String(Boolean(value))); }
  get keyboard(): boolean { return this.getAttribute('keyboard') !== 'false'; }
  set keyboard(value: boolean) { this.setAttribute('keyboard', String(Boolean(value))); }
  get cancel(): string { return this.getAttribute('cancel')?.trim() || DEFAULT_CANCEL; }
  set cancel(value: string) { const normalized = String(value).trim(); if (normalized) this.setAttribute('cancel', normalized); else this.removeAttribute('cancel'); }
  get resizing(): boolean { return this._pointerId !== null; }

  setRect(rect: HYResizableRect): HYResizableRect { return this._applyRect(rect, 'move', 'api'); }
  moveTo(x: number, y: number): HYResizableRect { return this._applyRect({ ...this.rect, x, y }, 'move', 'api'); }
  moveBy(deltaX: number, deltaY: number): HYResizableRect { return this.moveTo(this._x + finiteNumber(deltaX, 0), this._y + finiteNumber(deltaY, 0)); }
  resizeTo(width: number, height: number): HYResizableRect { return this._applyRect({ ...this.rect, width, height }, 'se', 'api'); }
  reset(): HYResizableRect { return this._applyRect(this._initialRect ?? { x: 0, y: 0, width: 200, height: 120 }, 'move', 'api'); }
  refresh(): HYResizableRect { return this._applyRect(this.rect, 'move', 'api'); }

  private _startPointer(event: PointerEvent): void {
    if (this.disabled || event.button !== 0 || this._pointerId !== null) return;
    const handle = this._resolveHandle(event);
    if (handle === 'move' && (!this.movable || this._isCancelledTarget(event))) return;
    const start = new CustomEvent<HYResizableChangeDetail>('resize-start', {
      detail: { ...this.rect, handle, source: 'pointer' }, bubbles: true, composed: true, cancelable: true,
    });
    if (!this.dispatchEvent(start)) return;
    event.preventDefault();
    this._frame.focus({ preventScroll: true });
    this._frame.setPointerCapture(event.pointerId);
    this._pointerId = event.pointerId;
    this._activeHandle = handle;
    this._origin = this.rect;
    this._pointerX = event.clientX;
    this._pointerY = event.clientY;
    this.toggleAttribute('resizing', true);
    const abort = new AbortController();
    this._dragAbort = abort;
    this._frame.addEventListener('pointermove', move => this._handlePointerMove(move), { signal: abort.signal });
    this._frame.addEventListener('pointerup', up => this._finishPointer(up.pointerId, false), { signal: abort.signal });
    this._frame.addEventListener('pointercancel', cancel => this._finishPointer(cancel.pointerId, true), { signal: abort.signal });
    this._frame.addEventListener('lostpointercapture', () => this._cancelDrag(true), { signal: abort.signal });
  }

  private _handlePointerMove(event: PointerEvent): void {
    if (event.pointerId !== this._pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - this._pointerX;
    const deltaY = event.clientY - this._pointerY;
    this._applyRect(this._rectFromDelta(this._origin, this._activeHandle, deltaX, deltaY), this._activeHandle, 'pointer');
  }

  private _finishPointer(pointerId: number, cancelled: boolean): void {
    if (pointerId !== this._pointerId) return;
    const handle = this._activeHandle;
    this._dragAbort?.abort();
    this._dragAbort = null;
    this._pointerId = null;
    this.toggleAttribute('resizing', false);
    if (this._frame.hasPointerCapture(pointerId)) this._frame.releasePointerCapture(pointerId);
    this.dispatchEvent(new CustomEvent<HYResizableEndDetail>('resize-end', {
      detail: { ...this.rect, handle, source: 'pointer', cancelled }, bubbles: true, composed: true,
    }));
  }

  private _cancelDrag(cancelled: boolean): void {
    if (this._pointerId !== null) this._finishPointer(this._pointerId, cancelled);
  }

  private _handleKeydown(event: KeyboardEvent): void {
    if (this.disabled || !this.keyboard) return;
    const handle = event.composedPath().find((node): node is HTMLElement => node instanceof HTMLElement && Boolean(node.dataset.resizeHandle))?.dataset.resizeHandle as HYResizableHandle | undefined ?? 'move';
    const step = this.grid * (event.shiftKey ? 10 : 1);
    let deltaX = 0;
    let deltaY = 0;
    if (event.key === 'ArrowLeft') deltaX = -step;
    else if (event.key === 'ArrowRight') deltaX = step;
    else if (event.key === 'ArrowUp') deltaY = -step;
    else if (event.key === 'ArrowDown') deltaY = step;
    else if (event.key === 'Home' && handle === 'move') { event.preventDefault(); this.reset(); return; }
    else return;
    if (handle !== 'move') {
      if (!handle.includes('e') && !handle.includes('w')) deltaX = 0;
      if (!handle.includes('n') && !handle.includes('s')) deltaY = 0;
    }
    if (deltaX === 0 && deltaY === 0) return;
    event.preventDefault();
    this._applyRect(this._rectFromDelta(this.rect, handle, deltaX, deltaY), handle, 'keyboard');
  }

  private _rectFromDelta(origin: HYResizableRect, handle: HYResizableHandle, deltaX: number, deltaY: number): HYResizableRect {
    if (handle === 'move') return { ...origin, x: origin.x + deltaX, y: origin.y + deltaY };
    let left = origin.x;
    let top = origin.y;
    let right = origin.x + origin.width;
    let bottom = origin.y + origin.height;
    if (handle.includes('w')) left += deltaX;
    if (handle.includes('e')) right += deltaX;
    if (handle.includes('n')) top += deltaY;
    if (handle.includes('s')) bottom += deltaY;
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  private _applyRect(candidate: HYResizableRect, handle: HYResizableHandle, source: HYResizableSource): HYResizableRect {
    const old = this.rect;
    const next = this._normalizeRect(candidate, handle);
    if (next.x === old.x && next.y === old.y && next.width === old.width && next.height === old.height) return old;
    this._x = next.x;
    this._y = next.y;
    this._width = next.width;
    this._height = next.height;
    this._sync();
    this._reflectRect();
    this.dispatchEvent(new CustomEvent<HYResizableChangeDetail>('resize', {
      detail: { ...next, handle, source }, bubbles: true, composed: true,
    }));
    return this.rect;
  }

  private _normalizeRect(candidate: HYResizableRect, handle: HYResizableHandle): HYResizableRect {
    const snap = (value: number) => Math.round(finiteNumber(value, 0) / this.grid) * this.grid;
    const originRight = candidate.x + candidate.width;
    const originBottom = candidate.y + candidate.height;
    let x = handle === 'move' ? snap(candidate.x) : finiteNumber(candidate.x, this._x);
    let y = handle === 'move' ? snap(candidate.y) : finiteNumber(candidate.y, this._y);
    let width = Math.max(this.minWidth, Math.min(this.maxWidth, snap(candidate.width)));
    let height = Math.max(this.minHeight, Math.min(this.maxHeight, snap(candidate.height)));
    if (handle.includes('w')) x = originRight - width;
    if (handle.includes('n')) y = originBottom - height;
    const ratio = this.aspectRatio;
    if (ratio && handle !== 'move') {
      if (handle === 'n' || handle === 's') width = Math.max(this.minWidth, Math.min(this.maxWidth, snap(height * ratio)));
      else height = Math.max(this.minHeight, Math.min(this.maxHeight, snap(width / ratio)));
      if (handle.includes('w')) x = originRight - width;
      if (handle.includes('n')) y = originBottom - height;
    }
    const bounds = this._relativeBounds();
    if (bounds) {
      width = Math.min(width, bounds.right - bounds.left);
      height = Math.min(height, bounds.bottom - bounds.top);
      x = Math.min(bounds.right - width, Math.max(bounds.left, x));
      y = Math.min(bounds.bottom - height, Math.max(bounds.top, y));
    }
    return { x, y, width, height };
  }

  private _relativeBounds(): { left: number; top: number; right: number; bottom: number } | null {
    if (!this.isConnected) return null;
    const target = this._boundsTarget ?? (this.boundsMode === 'parent' ? this.parentElement : null);
    const targetRect = target?.getBoundingClientRect();
    const viewport = this.boundsMode === 'viewport' && !this._boundsTarget;
    const bounds = target && targetRect
      ? { left: targetRect.left + target.clientLeft, top: targetRect.top + target.clientTop, right: targetRect.left + target.clientLeft + target.clientWidth, bottom: targetRect.top + target.clientTop + target.clientHeight }
      : viewport ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight } : null;
    if (!bounds) return null;
    const rect = this.getBoundingClientRect();
    const baseLeft = rect.left - this._x;
    const baseTop = rect.top - this._y;
    return { left: bounds.left - baseLeft, top: bounds.top - baseTop, right: bounds.right - baseLeft, bottom: bounds.bottom - baseTop };
  }

  private _resolveHandle(event: PointerEvent): HYResizableHandle {
    const element = event.composedPath().find((node): node is HTMLElement => node instanceof HTMLElement && Boolean(node.dataset.resizeHandle));
    return element?.dataset.resizeHandle as HYResizableHandle | undefined ?? 'move';
  }

  private _isCancelledTarget(event: PointerEvent): boolean {
    return event.composedPath().some(node => node instanceof Element && node !== this._frame && node !== this && safeMatches(node, this.cancel));
  }

  private _readRectAttributes(): void {
    this._x = finiteNumber(this.getAttribute('x'), this._x);
    this._y = finiteNumber(this.getAttribute('y'), this._y);
    this._width = positiveNumber(this.getAttribute('width'), this._width);
    this._height = positiveNumber(this.getAttribute('height'), this._height);
  }

  private _sync(): void {
    this.style.setProperty('--_hy-resizable-x', `${this._x}px`);
    this.style.setProperty('--_hy-resizable-y', `${this._y}px`);
    this.style.setProperty('--_hy-resizable-width', `${this._width}px`);
    this.style.setProperty('--_hy-resizable-height', `${this._height}px`);
    for (const [handle, element] of this._handles) {
      const horizontal = handle.includes('e') || handle.includes('w');
      element.setAttribute('aria-orientation', horizontal ? 'vertical' : 'horizontal');
      element.setAttribute('aria-valuenow', String(horizontal ? Math.round(this._width) : Math.round(this._height)));
    }
  }

  private _reflectRect(): void {
    this._reflecting = true;
    for (const [name, value] of Object.entries(this.rect)) {
      const normalized = String(Math.round(value * 1000) / 1000);
      if (this.getAttribute(name) !== normalized) this.setAttribute(name, normalized);
    }
    this._reflecting = false;
  }

  private _syncAccessibility(): void {
    this._frame.tabIndex = this.keyboard && !this.disabled ? 0 : -1;
    this._frame.setAttribute('role', 'group');
    this._frame.setAttribute('aria-label', this.getAttribute('aria-label') || 'Resizable container');
    this._frame.setAttribute('aria-disabled', String(this.disabled));
    for (const element of this._handles.values()) element.tabIndex = this.keyboard && !this.disabled ? 0 : -1;
  }

  private _setFiniteLimit(name: string, value: number): void {
    const normalized = Number(value);
    if (Number.isFinite(normalized) && normalized >= 0) this.setAttribute(name, String(normalized));
    else this.removeAttribute(name);
  }
}

export function defineResizableComponents(): void {
  if (!customElements.get('hy-resizable')) customElements.define('hy-resizable', HYResizable);
}
