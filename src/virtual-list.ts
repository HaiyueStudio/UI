export type HYVirtualListAlign = 'auto' | 'start' | 'center' | 'end';

export type HYVirtualListItemRenderer<T = unknown> = (
  item: T,
  index: number,
) => Node | string | number | null | undefined;

/** All end indexes are exclusive and can be passed directly to Array#slice. */
export interface HYVirtualListRange {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly visibleStartIndex: number;
  readonly visibleEndIndex: number;
}

export interface HYVirtualListRangeChangeDetail extends HYVirtualListRange {
  readonly renderedCount: number;
  readonly total: number;
}

export interface HYVirtualListItemClickDetail<T = unknown> {
  readonly item: T;
  readonly index: number;
}

const DEFAULT_ITEM_HEIGHT = 40;
const DEFAULT_HEIGHT = 320;
const DEFAULT_OVERSCAN = 3;

function finiteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function calculateVirtualListRange(
  itemCount: number,
  itemHeight: number,
  viewportHeight: number,
  scrollTop: number,
  overscan: number,
): HYVirtualListRange {
  const count = Math.max(0, Math.floor(finiteNumber(itemCount, 0)));
  const rowHeight = Math.max(1, finiteNumber(itemHeight, DEFAULT_ITEM_HEIGHT));
  const visibleHeight = Math.max(0, finiteNumber(viewportHeight, 0));
  const offset = Math.max(0, finiteNumber(scrollTop, 0));
  const buffer = Math.max(0, Math.floor(finiteNumber(overscan, DEFAULT_OVERSCAN)));
  const visibleStartIndex = Math.min(count, Math.floor(offset / rowHeight));
  const visibleEndIndex = Math.min(count, Math.ceil((offset + visibleHeight) / rowHeight));

  return {
    startIndex: Math.max(0, visibleStartIndex - buffer),
    endIndex: Math.min(count, visibleEndIndex + buffer),
    visibleStartIndex,
    visibleEndIndex,
  };
}

export class HYVirtualList<T = unknown> extends HTMLElement {
  private readonly _viewport = document.createElement('div');
  private readonly _spacer = document.createElement('div');
  private readonly _window = document.createElement('div');
  private readonly _empty = document.createElement('div');
  private _items: readonly T[] = [];
  private _renderItem: HYVirtualListItemRenderer<T> | null = null;
  private _itemHeight = DEFAULT_ITEM_HEIGHT;
  private _height = DEFAULT_HEIGHT;
  private _overscan = DEFAULT_OVERSCAN;
  private _range: HYVirtualListRange | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _connected = false;
  private readonly _onScroll = () => this._renderWindow();
  private readonly _onClick = (event: Event) => this._handleClick(event);

  static get observedAttributes(): string[] {
    return ['item-height', 'height', 'overscan', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        min-width: 0;
        color: var(--hy-text-color, #eef3ff);
        font: 13px/1.4 system-ui, sans-serif;
      }
      .viewport {
        position: relative;
        height: var(--hy-virtual-list-height, 320px);
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        border: 1px solid var(--hy-border-color, #3d4654);
        border-radius: var(--hy-virtual-list-border-radius, 6px);
        outline: none;
        background: var(--hy-surface-color, #171d27);
        scrollbar-color: var(--hy-border-strong-color, #596779) var(--hy-input-bg-color, #111722);
        scrollbar-width: thin;
      }
      .viewport:focus-visible {
        border-color: var(--hy-focus-border-color, #79a8ff);
        box-shadow: 0 0 0 2px var(--hy-focus-ring-color, rgba(121, 168, 255, 0.22));
      }
      .viewport::-webkit-scrollbar { width: var(--hy-virtual-list-scrollbar-size, 10px); }
      .viewport::-webkit-scrollbar-track { background: var(--hy-input-bg-color, #111722); }
      .viewport::-webkit-scrollbar-thumb {
        min-height: 28px;
        border: 2px solid var(--hy-input-bg-color, #111722);
        border-radius: 999px;
        background: var(--hy-border-strong-color, #596779);
      }
      .viewport::-webkit-scrollbar-thumb:hover { background: var(--hy-accent-color, #79a8ff); }
      .spacer { position: relative; width: 100%; }
      .window { position: absolute; inset: 0 0 auto; will-change: transform; }
      ::slotted(.hy-virtual-list-item) {
        display: flex;
        align-items: center;
        width: 100%;
        overflow: hidden;
        border-bottom: 1px solid var(--hy-border-subtle-color, var(--hy-border-color, #3d4654));
        background: var(--hy-surface-color, #171d27);
        box-sizing: border-box;
      }
      ::slotted(.hy-virtual-list-item:hover) { background: var(--hy-hover-bg-color, #273241); }
      .empty {
        display: grid;
        height: 100%;
        place-items: center;
        padding: 24px;
        color: var(--hy-secondary-text-color, #9aa8ba);
        box-sizing: border-box;
      }
      .empty[hidden], .spacer[hidden] { display: none; }
    `;

    this._viewport.className = 'viewport';
    this._viewport.tabIndex = 0;
    this._viewport.setAttribute('role', 'list');
    this._spacer.className = 'spacer';
    this._window.className = 'window';
    const itemSlot = document.createElement('slot');
    itemSlot.name = 'items';
    this._window.append(itemSlot);
    this._spacer.append(this._window);
    this._empty.className = 'empty';
    this._empty.hidden = true;
    const emptySlot = document.createElement('slot');
    emptySlot.name = 'empty';
    emptySlot.textContent = 'No data';
    this._empty.append(emptySlot);
    this._viewport.append(this._spacer, this._empty);
    root.append(style, this._viewport);
  }

  connectedCallback(): void {
    if (this._connected) return;
    this._connected = true;
    this._syncAttributes();
    this._viewport.addEventListener('scroll', this._onScroll, { passive: true });
    this._window.addEventListener('click', this._onClick);
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this._renderWindow());
      this._resizeObserver.observe(this._viewport);
    }
    this._renderWindow(true);
  }

  disconnectedCallback(): void {
    if (!this._connected) return;
    this._connected = false;
    this._viewport.removeEventListener('scroll', this._onScroll);
    this._window.removeEventListener('click', this._onClick);
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._replaceRows([]);
  }

  attributeChangedCallback(): void {
    this._syncAttributes();
  }

  get items(): readonly T[] { return this._items; }
  set items(value: readonly T[]) {
    this._items = Array.isArray(value) ? value : [];
    this._clampScrollTop();
    this.refresh();
  }

  get renderItem(): HYVirtualListItemRenderer<T> | null { return this._renderItem; }
  set renderItem(value: HYVirtualListItemRenderer<T> | null) {
    this._renderItem = typeof value === 'function' ? value : null;
    this.refresh();
  }

  get itemHeight(): number { return this._itemHeight; }
  set itemHeight(value: number) {
    const next = Math.max(1, finiteNumber(Number(value), DEFAULT_ITEM_HEIGHT));
    if (next === this._itemHeight && this.getAttribute('item-height') === String(next)) return;
    this._itemHeight = next;
    this._reflectNumber('item-height', next);
    this.refresh();
  }

  get height(): number { return this._height; }
  set height(value: number) {
    const next = Math.max(1, finiteNumber(Number(value), DEFAULT_HEIGHT));
    if (next === this._height && this.getAttribute('height') === String(next)) return;
    this._height = next;
    this._reflectNumber('height', next);
    this._applyHeight();
    this.refresh();
  }

  get overscan(): number { return this._overscan; }
  set overscan(value: number) {
    const next = Math.max(0, Math.floor(finiteNumber(Number(value), DEFAULT_OVERSCAN)));
    if (next === this._overscan && this.getAttribute('overscan') === String(next)) return;
    this._overscan = next;
    this._reflectNumber('overscan', next);
    this.refresh();
  }

  refresh(): void {
    this._range = null;
    this._renderWindow(true);
  }

  scrollToIndex(index: number, align: HYVirtualListAlign = 'auto'): void {
    if (this._items.length === 0) return;
    const targetIndex = Math.min(this._items.length - 1, Math.max(0, Math.floor(finiteNumber(index, 0))));
    const viewportHeight = this._viewport.clientHeight || this._height;
    const itemStart = targetIndex * this._itemHeight;
    const itemEnd = itemStart + this._itemHeight;
    const currentStart = this._viewport.scrollTop;
    const currentEnd = currentStart + viewportHeight;
    let nextScrollTop = currentStart;

    if (align === 'start') nextScrollTop = itemStart;
    else if (align === 'center') nextScrollTop = itemStart - (viewportHeight - this._itemHeight) / 2;
    else if (align === 'end') nextScrollTop = itemEnd - viewportHeight;
    else if (itemStart < currentStart) nextScrollTop = itemStart;
    else if (itemEnd > currentEnd) nextScrollTop = itemEnd - viewportHeight;

    const maxScrollTop = Math.max(0, this._items.length * this._itemHeight - viewportHeight);
    this._viewport.scrollTop = Math.min(maxScrollTop, Math.max(0, nextScrollTop));
    this._renderWindow();
  }

  private _syncAttributes(): void {
    this._itemHeight = this._readPositiveAttribute('item-height', DEFAULT_ITEM_HEIGHT);
    this._height = this._readPositiveAttribute('height', DEFAULT_HEIGHT);
    this._overscan = this._readNonNegativeAttribute('overscan', DEFAULT_OVERSCAN);
    const label = this.getAttribute('aria-label');
    if (label) this._viewport.setAttribute('aria-label', label);
    else this._viewport.removeAttribute('aria-label');
    this._applyHeight();
    this.refresh();
  }

  private _applyHeight(): void {
    if (this.hasAttribute('height')) this._viewport.style.height = `${this._height}px`;
    else this._viewport.style.removeProperty('height');
  }

  private _readPositiveAttribute(name: string, fallback: number): number {
    if (!this.hasAttribute(name)) return fallback;
    const value = Number(this.getAttribute(name));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private _readNonNegativeAttribute(name: string, fallback: number): number {
    if (!this.hasAttribute(name)) return fallback;
    const value = Number(this.getAttribute(name));
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  }

  private _reflectNumber(name: string, value: number): void {
    const text = String(value);
    if (this.getAttribute(name) !== text) this.setAttribute(name, text);
  }

  private _clampScrollTop(): void {
    const viewportHeight = this._viewport.clientHeight || this._height;
    const maxScrollTop = Math.max(0, this._items.length * this._itemHeight - viewportHeight);
    if (this._viewport.scrollTop > maxScrollTop) this._viewport.scrollTop = maxScrollTop;
  }

  private _renderWindow(force = false): void {
    const count = this._items.length;
    this._spacer.hidden = count === 0;
    this._empty.hidden = count !== 0;
    this._spacer.style.height = `${count * this._itemHeight}px`;

    if (count === 0) {
      this._replaceRows([]);
      this._range = null;
      return;
    }

    const range = calculateVirtualListRange(
      count,
      this._itemHeight,
      this._viewport.clientHeight || this._height,
      this._viewport.scrollTop,
      this._overscan,
    );
    if (!force && this._range
      && range.startIndex === this._range.startIndex
      && range.endIndex === this._range.endIndex) return;

    this._range = range;
    this._window.style.transform = `translateY(${range.startIndex * this._itemHeight}px)`;
    const rows: HTMLElement[] = [];
    for (let index = range.startIndex; index < range.endIndex; index += 1) {
      const item = this._items[index] as T;
      const row = document.createElement('div');
      row.className = 'hy-virtual-list-item';
      row.slot = 'items';
      row.dataset.hyVirtualListGenerated = '';
      row.dataset.index = String(index);
      row.style.height = `${this._itemHeight}px`;
      row.setAttribute('role', 'listitem');
      row.setAttribute('aria-posinset', String(index + 1));
      row.setAttribute('aria-setsize', String(count));
      const content = this._renderItem
        ? this._renderItem(item, index)
        : String(item ?? '');
      if (content instanceof Node) row.append(content);
      else row.textContent = String(content);
      rows.push(row);
    }
    this._replaceRows(rows);
    this.dispatchEvent(new CustomEvent<HYVirtualListRangeChangeDetail>('visible-range-change', {
      bubbles: true,
      composed: true,
      detail: {
        ...range,
        renderedCount: range.endIndex - range.startIndex,
        total: count,
      },
    }));
  }

  private _handleClick(event: Event): void {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.hy-virtual-list-item') : null;
    const index = Number(target?.dataset.index);
    if (!target || !Number.isInteger(index) || index < 0 || index >= this._items.length) return;
    const item = this._items[index] as T;
    this.dispatchEvent(new CustomEvent<HYVirtualListItemClickDetail<T>>('item-click', {
      bubbles: true,
      composed: true,
      detail: { item, index },
    }));
  }

  private _replaceRows(rows: readonly HTMLElement[]): void {
    for (const row of this.querySelectorAll<HTMLElement>(':scope > [data-hy-virtual-list-generated]')) row.remove();
    this.append(...rows);
  }
}

export function defineVirtualListComponents(): void {
  if (!customElements.get('hy-virtual-list')) customElements.define('hy-virtual-list', HYVirtualList);
}
