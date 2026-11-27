import { HYPointerDrag, dragTargetAllowed } from './internal/pointer-drag.js';
import { activeDrag, beginDrag, cancelDragSource, composedContains, finishDrag, moveDrag, registerDropTarget } from './internal/drag-drop.js';
import type { HYDragPayload } from './internal/drag-drop.js';
import { finiteNumber } from './internal/numbers.js';
import { focusedElement } from './internal/focus.js';

export type HYSortableDirection = 'vertical' | 'horizontal' | 'grid';
export interface HYSortableChangeDetail {
  readonly item: HTMLElement;
  readonly from: HYSortable;
  readonly to: HYSortable;
  readonly oldIndex: number;
  readonly newIndex: number;
  readonly source: 'pointer' | 'keyboard' | 'api';
  readonly fromOrder: readonly string[];
  readonly toOrder: readonly string[];
}
export interface HYSortableEndDetail extends HYSortableChangeDetail { readonly accepted: boolean; readonly cancelled: boolean; }

interface ItemDrag { item: HTMLElement; from: HYSortable; }
interface OwnedAttribute { original: string | null; value: string; }
const keys = new WeakMap<HTMLElement, string>();
let keySequence = 0;
function itemKey(item: HTMLElement): string {
  if (item.dataset.id || item.id) return item.dataset.id || item.id;
  let key = keys.get(item);
  if (!key) { key = `hy-sortable-item-${++keySequence}`; keys.set(item, key); }
  return key;
}

/** Reorders the original slotted elements with pointer, touch, keyboard or API input. */
export class HYSortable extends HTMLElement {
  private readonly _surface = document.createElement('div');
  private readonly _slot = document.createElement('slot');
  private readonly _indicator = document.createElement('div');
  private readonly _status = document.createElement('div');
  private readonly _instructions = document.createElement('div');
  private readonly _pointer = new HYPointerDrag();
  private readonly _owned = new Map<HTMLElement, Map<string, OwnedAttribute>>();
  private readonly _observer = new MutationObserver(() => this.refresh());
  private _unregister: (() => void) | null = null;
  private _candidate: number | null = null;
  private _drag: { item: HTMLElement; oldIndex: number; input: 'pointer' | 'keyboard' } | null = null;
  private _lastChange: HYSortableChangeDetail | null = null;
  static get observedAttributes(): string[] { return ['direction', 'group', 'disabled', 'handle', 'keyboard', 'columns', 'aria-label']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #eef0ff); font: var(--hy-font-size-sm, 12px)/var(--hy-line-height-relaxed, 1.5) var(--hy-font-family, system-ui, sans-serif); }
      :host([hidden]), [hidden] { display: none !important; }
      .items { position: relative; display: flex; flex-direction: column; gap: var(--hy-sortable-gap, var(--hy-space-4, 8px)); min-height: var(--hy-sortable-min-height, 48px); }
      slot { display: contents; }
      :host([direction="horizontal"]) .items { flex-direction: row; }
      :host([direction="grid"]) .items { display: grid; grid-template-columns: repeat(var(--_hy-sortable-columns, 3), minmax(0, 1fr)); }
      ::slotted(*) { min-width: 0; touch-action: var(--hy-sortable-touch-action, none); }
      .items:focus-visible, ::slotted(:focus-visible) { outline: 2px solid var(--hy-focus-border-color, #8177f2); outline-offset: 2px; }
      ::slotted([data-hy-sort-active]) { opacity: var(--hy-sortable-drag-opacity, .45); }
      .indicator { position: absolute; z-index: 2; height: 3px; background: var(--hy-drop-indicator-color, var(--hy-accent-color, #8177f2)); border-radius: var(--hy-radius-xs, 2px); pointer-events: none; }
      .indicator.cross { width: 3px; height: auto; }
      .sr { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    `;
    this._surface.className = 'items'; this._surface.part.add('items'); this._surface.setAttribute('role', 'list');
    this._indicator.className = 'indicator'; this._indicator.part.add('indicator'); this._indicator.hidden = true; this._indicator.setAttribute('aria-hidden', 'true');
    this._instructions.className = 'sr';
    this._instructions.textContent = 'Press Space to pick up. Use arrow keys, Home or End to choose a position, Tab to another list, Enter to drop, and Escape to cancel.';
    this._status.className = 'sr'; this._status.part.add('status'); this._status.setAttribute('role', 'status'); this._status.setAttribute('aria-live', 'polite');
    this._surface.append(this._slot, this._indicator); root.append(style, this._surface, this._instructions, this._status);
    this._slot.addEventListener('slotchange', () => this.refresh());
    this.addEventListener('pointerdown', this._onPointerDown);
    this.addEventListener('keydown', this._onKeydown);
    this.addEventListener('dragstart', event => event.preventDefault());
  }

  connectedCallback(): void {
    this._unregister?.();
    this._unregister = registerDropTarget({
      element: this,
      accepts: payload => this._accepts(payload),
      over: (payload, point) => {
        const { item, from } = payload.data as ItemDrag;
        if (point) this._candidate = this._indexAt(item, point.x, point.y);
        else this._candidate ??= from === this ? this.items.indexOf(item) : this.items.length;
        this._showIndicator(item);
      },
      leave: () => { this._candidate = null; this._indicator.hidden = true; },
      drop: payload => {
        const { item, from } = payload.data as ItemDrag;
        return this._commit(item, from, this._candidate ?? this.items.length, payload.input);
      },
    });
    this._observer.observe(this, { childList: true }); this.refresh();
  }
  disconnectedCallback(): void {
    this._pointer.cancel(); cancelDragSource(this); this._unregister?.(); this._unregister = null;
    this._observer.disconnect(); for (const item of [...this._owned.keys()]) this._restore(item);
    this._indicator.hidden = true; this._candidate = null;
  }
  attributeChangedCallback(): void {
    this._pointer.cancel(); cancelDragSource(this);
    this._candidate = null; this._indicator.hidden = true; this.refresh();
  }
  get items(): HTMLElement[] { return [...this.children].filter((item): item is HTMLElement => item instanceof HTMLElement && !item.slot && !item.hidden); }
  get order(): readonly string[] { return this.items.map(itemKey); }
  get direction(): HYSortableDirection { const value = this.getAttribute('direction'); return value === 'horizontal' || value === 'grid' ? value : 'vertical'; }
  set direction(value: HYSortableDirection) { this.setAttribute('direction', value); }
  get group(): string { return this.getAttribute('group') ?? ''; }
  set group(value: string) { this.setAttribute('group', value); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', value); }
  get keyboard(): boolean { return this.getAttribute('keyboard') !== 'false'; }
  set keyboard(value: boolean) { this.setAttribute('keyboard', String(value)); }
  get handle(): string { return this.getAttribute('handle') ?? ''; }
  set handle(value: string) { this.setAttribute('handle', value); }
  get columns(): number { return Math.max(1, Math.min(12, Math.floor(finiteNumber(this.getAttribute('columns'), 3)))); }
  set columns(value: number) { this.setAttribute('columns', String(value)); }

  move(fromIndex: number, toIndex: number): boolean {
    this._pointer.cancel(); cancelDragSource(this);
    const item = this.items[fromIndex];
    return Boolean(item && Number.isInteger(fromIndex) && Number.isInteger(toIndex) && this._commit(item, this, toIndex, 'api'));
  }

  refresh(): void {
    const items = this.items;
    if (this._drag && !items.includes(this._drag.item)) { this._pointer.cancel(); cancelDragSource(this); }
    for (const item of [...this._owned.keys()]) if (!items.includes(item)) this._restore(item);
    this._surface.style.setProperty('--_hy-sortable-columns', String(this.columns));
    this._surface.setAttribute('aria-label', this.getAttribute('aria-label') || 'Sortable list');
    this._surface.tabIndex = this.disabled || !this.keyboard ? -1 : 0;
    if (!this.isConnected) return;
    for (const item of items) {
      const saved = this._owned.get(item)?.get('tabindex');
      const original = saved ? saved.original : item.getAttribute('tabindex');
      this._own(item, 'tabindex', this.disabled || !this.keyboard || item.hasAttribute('data-sort-disabled') ? '-1' : original ?? '0');
      if (!item.hasAttribute('role')) this._own(item, 'role', 'listitem');
      // Slotted items cannot resolve ID references into this shadow root.
      if (!item.hasAttribute('aria-description')) this._own(item, 'aria-description', this._instructions.textContent!);
    }
  }

  private _own(item: HTMLElement, name: string, value: string): void {
    let attributes = this._owned.get(item);
    if (!attributes) { attributes = new Map(); this._owned.set(item, attributes); }
    const saved = attributes.get(name);
    attributes.set(name, { original: saved ? saved.original : item.getAttribute(name), value });
    if (item.getAttribute(name) !== value) item.setAttribute(name, value);
  }
  private _restore(item: HTMLElement, name?: string): void {
    const attributes = this._owned.get(item);
    if (!attributes) return;
    for (const [key, saved] of [...attributes]) {
      if (name && name !== key) continue;
      if (item.getAttribute(key) === saved.value) {
        if (saved.original === null) item.removeAttribute(key); else item.setAttribute(key, saved.original);
      }
      attributes.delete(key);
    }
    if (!attributes.size) this._owned.delete(item);
  }
  private _eventItem(event: Event): HTMLElement | undefined { return this.items.find(item => event.composedPath().includes(item)); }

  private _onPointerDown = (event: PointerEvent): void => {
    const item = this._eventItem(event);
    if (!item || this.disabled || item.hasAttribute('data-sort-disabled') || !dragTargetAllowed(event, this, this.handle)) return;
    if (this._pointer.start(event, this._surface, {
      start: () => this._begin(item, 'pointer'),
      move: move => moveDrag(this.ownerDocument, move.clientX, move.clientY),
      end: (up, cancelled) => {
        if (!cancelled) moveDrag(this.ownerDocument, up.clientX, up.clientY);
        finishDrag(this.ownerDocument, cancelled);
      },
    }, 6)) event.stopPropagation();
  };

  private _onKeydown = (event: KeyboardEvent): void => {
    if (this.disabled || !this.keyboard || event.defaultPrevented) return;
    const payload = activeDrag(this.ownerDocument);
    const item = this._eventItem(event);
    if (!dragTargetAllowed(event, this) && !(this.handle && dragTargetAllowed(event, this, this.handle))) return;
    if (!payload) {
      if (item && (event.key === ' ' || event.key === 'Enter') && !item.hasAttribute('data-sort-disabled')) { event.preventDefault(); this._begin(item, 'keyboard'); }
      return;
    }
    if (!this._accepts(payload) || payload.input !== 'keyboard') return;
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); finishDrag(this.ownerDocument); return; }
    const dragged = (payload.data as ItemDrag).item;
    const length = this.items.filter(value => value !== dragged).length;
    let next = this._candidate ?? (payload.source === this ? this.items.indexOf(dragged) : length);
    const rtl = getComputedStyle(this).direction === 'rtl';
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = length;
    else if (this.direction !== 'horizontal' && event.key === 'ArrowDown') next += this.direction === 'grid' ? this.columns : 1;
    else if (this.direction !== 'horizontal' && event.key === 'ArrowUp') next -= this.direction === 'grid' ? this.columns : 1;
    else if (this.direction !== 'vertical' && event.key === 'ArrowRight') next += rtl ? -1 : 1;
    else if (this.direction !== 'vertical' && event.key === 'ArrowLeft') next += rtl ? 1 : -1;
    else return;
    event.preventDefault(); this._candidate = Math.max(0, Math.min(length, next)); this._showIndicator(dragged);
    this._status.textContent = `Drop at position ${this._candidate + 1}.`;
  };

  private _begin(item: HTMLElement, input: 'pointer' | 'keyboard'): boolean {
    if (this.disabled || !this.isConnected || item.parentElement !== this || activeDrag(this.ownerDocument)) return false;
    const oldIndex = this.items.indexOf(item);
    const detail: HYSortableChangeDetail = { item, from: this, to: this, oldIndex, newIndex: oldIndex, source: input, fromOrder: this.order, toOrder: this.order };
    if (!this.dispatchEvent(new CustomEvent<HYSortableChangeDetail>('sort-start', { detail, bubbles: true, composed: true, cancelable: true })) || this.disabled || item.parentElement !== this) return false;
    this._drag = { item, oldIndex, input }; this._lastChange = null;
    const started = beginDrag({ type: 'hy-sortable', data: { item, from: this }, source: this, effect: 'move', input }, end => {
      this._drag = null; this._pointer.cancel(); this._restore(item, 'data-hy-sort-active');
      this._status.textContent = end.accepted ? 'Item moved.' : end.cancelled ? 'Sorting cancelled.' : 'Order unchanged.';
      const finalDetail = this._lastChange ?? detail; this._lastChange = null;
      this.dispatchEvent(new CustomEvent<HYSortableEndDetail>('sort-end', { detail: { ...finalDetail, accepted: end.accepted, cancelled: end.cancelled }, bubbles: true, composed: true }));
      if (item.isConnected) item.focus({ preventScroll: true });
    });
    if (!started) { this._drag = null; return false; }
    this._own(item, 'data-hy-sort-active', ''); item.focus({ preventScroll: true });
    this._status.textContent = `Picked up ${itemKey(item)} at position ${oldIndex + 1}.`;
    return true;
  }

  private _accepts(payload: HYDragPayload): boolean {
    if (this.disabled || payload.type !== 'hy-sortable' || !(payload.source instanceof HYSortable)) return false;
    const { item, from } = payload.data as ItemDrag;
    return !from.disabled && item.parentElement === from && !composedContains(item, this) && (from === this || Boolean(this.group && this.group === from.group));
  }

  private _indexAt(item: HTMLElement, x: number, y: number): number {
    const items = this.items.filter(value => value !== item);
    const rtl = getComputedStyle(this).direction === 'rtl';
    const index = items.findIndex(value => {
      const rect = value.getBoundingClientRect();
      if (this.direction === 'vertical') return y < rect.top + rect.height / 2;
      const before = rtl ? x > rect.left + rect.width / 2 : x < rect.left + rect.width / 2;
      return this.direction === 'horizontal' ? before : y < rect.top || (y <= rect.bottom && before);
    });
    return index < 0 ? items.length : index;
  }
  private _showIndicator(item: HTMLElement): void {
    const items = this.items.filter(value => value !== item);
    const index = this._candidate ?? 0;
    const target = items[index] ?? items.at(-1);
    const bounds = this._surface.getBoundingClientRect(); const rect = target?.getBoundingClientRect();
    const cross = this.direction !== 'vertical';
    this._indicator.classList.toggle('cross', cross); this._indicator.hidden = false;
    this._indicator.style.inset = 'auto';
    if (cross) {
      const rtl = getComputedStyle(this).direction === 'rtl';
      const edge = rect ? (index < items.length ? (rtl ? rect.right : rect.left) : (rtl ? rect.left : rect.right)) : bounds.left;
      this._indicator.style.left = `${edge - bounds.left}px`; this._indicator.style.top = `${rect ? rect.top - bounds.top : 0}px`;
      this._indicator.style.height = `${rect?.height ?? 40}px`; this._indicator.style.width = '3px';
    } else {
      this._indicator.style.left = '0'; this._indicator.style.width = '100%'; this._indicator.style.height = '3px';
      this._indicator.style.top = `${rect ? (index < items.length ? rect.top : rect.bottom) - bounds.top : 0}px`;
    }
  }

  private _commit(item: HTMLElement, from: HYSortable, requested: number, source: HYSortableChangeDetail['source']): boolean {
    if (this.disabled || from.disabled || !this.isConnected || !from.isConnected || item.parentElement !== from || composedContains(item, this) || !Number.isInteger(requested)) return false;
    const originItems = from.items;
    const oldIndex = originItems.indexOf(item);
    if (oldIndex < 0) return false;
    const remaining = this.items.filter(value => value !== item);
    const newIndex = Math.max(0, Math.min(remaining.length, requested));
    if (from === this && oldIndex === newIndex) return false;
    const fromItems = from.items.filter(value => value !== item);
    const toItems = [...remaining]; toItems.splice(newIndex, 0, item);
    const detail: HYSortableChangeDetail = { item, from, to: this, oldIndex, newIndex, source, fromOrder: (from === this ? toItems : fromItems).map(itemKey), toOrder: toItems.map(itemKey) };
    if (!this.dispatchEvent(new CustomEvent<HYSortableChangeDetail>('sort-before-change', { detail, bubbles: true, composed: true, cancelable: true })) ||
      this.disabled || from.disabled || !this.isConnected || !from.isConnected || item.parentElement !== from || composedContains(item, this)) return false;
    // Applications may render new content from the cancelable event. Never use stale anchors or orders.
    const currentFrom = from.items; const currentTo = this.items.filter(value => value !== item);
    if (currentFrom.length !== originItems.length || currentFrom.some((value, index) => value !== originItems[index]) ||
      currentTo.length !== remaining.length || currentTo.some((value, index) => value !== remaining[index])) return false;
    from._restore(item);
    const anchor = remaining[newIndex] ?? null;
    const focused = focusedElement(this.ownerDocument);
    const parent = this as HTMLElement & { moveBefore?: (node: Node, child: Node | null) => void };
    if (parent.moveBefore) parent.moveBefore(item, anchor);
    else this.insertBefore(item, anchor);
    from.refresh(); if (from !== this) this.refresh();
    if (focused && composedContains(item, focused) && focused.isConnected) focused.focus({ preventScroll: true });
    if (from._drag) from._lastChange = detail;
    this.dispatchEvent(new CustomEvent<HYSortableChangeDetail>('sort-change', { detail, bubbles: true, composed: true }));
    return true;
  }
}

export function defineSortableComponents(): void {
  if (!customElements.get('hy-sortable')) customElements.define('hy-sortable', HYSortable);
}
