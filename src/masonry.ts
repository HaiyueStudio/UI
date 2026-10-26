export interface HYMasonryLayoutChangeDetail {
  columns: number;
  itemCount: number;
  height: number;
}

const itemProperties = ['--_hy-masonry-width', '--_hy-masonry-x', '--_hy-masonry-y'] as const;

function numberOption(value: unknown, fallback: number, min: number, max: number): number {
  if (value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

/** Places default-slot HTML elements into the shortest column without changing DOM/focus order. */
export class HYMasonry extends HTMLElement {
  private readonly _layout = document.createElement('div');
  private readonly _slot = document.createElement('slot');
  private readonly _resizeObserver = new ResizeObserver(() => this.refresh());
  private readonly _mutationObserver = new MutationObserver(() => this.refresh());
  private readonly _items = new Map<HTMLElement, { value: string; priority: string }[]>();
  private _frame = 0;
  private _connected = false;
  private _lastLayout = '';

  static get observedAttributes(): string[] { return ['columns', 'min-column-width', 'gap']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; }
      :host([hidden]) { display: none; }
      .layout { position: relative; min-width: 0; }
      slot { display: contents; }
      ::slotted(*) {
        position: absolute;
        box-sizing: border-box;
        min-width: 0;
        max-width: none;
        width: var(--_hy-masonry-width);
        inset-inline-start: var(--_hy-masonry-x);
        top: var(--_hy-masonry-y);
        margin: 0;
      }
      ::slotted([hidden]) { display: none !important; }
    `;
    this._layout.className = 'layout';
    this._layout.part.add('layout');
    this._layout.append(this._slot);
    root.append(style, this._layout);
  }

  connectedCallback(): void {
    if (this._connected) return;
    this._connected = true;
    this._slot.addEventListener('slotchange', this.refresh);
    this._resizeObserver.observe(this._layout);
    this._mutationObserver.observe(this, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['hidden', 'class', 'style', 'slot'],
    });
    this.refresh();
  }

  disconnectedCallback(): void {
    this._connected = false;
    this._slot.removeEventListener('slotchange', this.refresh);
    this._resizeObserver.disconnect();
    this._mutationObserver.disconnect();
    if (this._frame) cancelAnimationFrame(this._frame);
    this._frame = 0;
    for (const item of this._items.keys()) this._releaseItem(item);
    this._layout.style.removeProperty('height');
    this._lastLayout = '';
  }

  attributeChangedCallback(): void { this.refresh(); }

  /** Zero (the default) selects as many columns as fit minColumnWidth. */
  get columns(): number { return Math.floor(numberOption(this.getAttribute('columns'), 0, 0, 128)); }
  set columns(value: number) { this.setAttribute('columns', String(Math.floor(numberOption(value, 0, 0, 128)))); }
  /** Preferred minimum column width in CSS pixels; narrow containers still fit one column. */
  get minColumnWidth(): number { return numberOption(this.getAttribute('min-column-width'), 240, 1, 100_000); }
  set minColumnWidth(value: number) { this.setAttribute('min-column-width', String(numberOption(value, 240, 1, 100_000))); }
  /** Horizontal and vertical spacing in CSS pixels. */
  get gap(): number { return numberOption(this.getAttribute('gap'), 16, 0, 10_000); }
  set gap(value: number) { this.setAttribute('gap', String(numberOption(value, 16, 0, 10_000))); }

  /** Coalesces layout requests into the next animation frame. Safe while disconnected. */
  refresh = (): void => {
    if (!this._connected || this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      this._updateLayout();
    });
  };

  private _releaseItem(item: HTMLElement): void {
    const saved = this._items.get(item);
    if (!saved) return;
    itemProperties.forEach((property, index) => {
      const { value, priority } = saved[index]!;
      if (value) item.style.setProperty(property, value, priority);
      else item.style.removeProperty(property);
    });
    this._resizeObserver.unobserve(item);
    this._items.delete(item);
  }

  private _setItemProperty(item: HTMLElement, property: string, value: number): void {
    const text = `${value}px`;
    if (item.style.getPropertyValue(property) !== text) item.style.setProperty(property, text);
  }

  private _updateLayout(): void {
    const items = this._slot.assignedElements({ flatten: true }).filter((item): item is HTMLElement => item instanceof HTMLElement);
    const current = new Set(items);
    for (const item of this._items.keys()) if (!current.has(item)) this._releaseItem(item);
    for (const item of items) {
      if (this._items.has(item)) continue;
      this._items.set(item, itemProperties.map(property => ({
        value: item.style.getPropertyValue(property), priority: item.style.getPropertyPriority(property),
      })));
      this._resizeObserver.observe(item, { box: 'border-box' });
    }

    const width = this._layout.clientWidth;
    if (width <= 0) return; // A hidden container is measured again when ResizeObserver sees it.
    const gap = this.gap;
    const requested = this.columns || Math.max(1, Math.floor((width + gap) / (this.minColumnWidth + gap)));
    const columns = Math.min(128, requested, Math.max(1, Math.floor((width + gap) / (1 + gap))));
    const itemWidth = (width - gap * (columns - 1)) / columns;
    const visible = items.filter(item => !item.hidden && getComputedStyle(item).display !== 'none');
    for (const item of visible) this._setItemProperty(item, itemProperties[0], itemWidth);
    // Read used CSS sizes before writing positions. Unlike DOMRect, these are
    // unaffected by transforms, and unlike offsetHeight they retain fractions.
    const itemHeights = visible.map(item => {
      const style = getComputedStyle(item);
      const contentHeight = Number.parseFloat(style.height);
      if (!Number.isFinite(contentHeight)) return item.offsetHeight;
      return contentHeight + (style.boxSizing === 'border-box' ? 0 :
        Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) +
        Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth));
    });
    const heights = Array<number>(columns).fill(0);
    const positions: number[] = [];
    visible.forEach((item, index) => {
      const column = heights.indexOf(Math.min(...heights));
      const x = column * (itemWidth + gap);
      const y = heights[column]!;
      this._setItemProperty(item, itemProperties[1], x);
      this._setItemProperty(item, itemProperties[2], y);
      const height = itemHeights[index]!;
      heights[column] = y + height + gap;
      positions.push(x, y, height);
    });
    const height = visible.length ? Math.max(...heights) - gap : 0;
    if (this._layout.style.height !== `${height}px`) this._layout.style.height = `${height}px`;
    const signature = JSON.stringify([columns, itemWidth, height, positions]);
    if (signature === this._lastLayout) return;
    this._lastLayout = signature;
    this.dispatchEvent(new CustomEvent<HYMasonryLayoutChangeDetail>('layout-change', {
      detail: { columns, itemCount: visible.length, height }, bubbles: true, composed: true,
    }));
  }
}

export function defineMasonryComponents(): void {
  if (!customElements.get('hy-masonry')) customElements.define('hy-masonry', HYMasonry);
}
