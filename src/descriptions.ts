import { hasSlotContent } from './internal/presentation.js';

export type HYDescriptionsLayout = 'horizontal' | 'vertical';
export type HYDescriptionsSize = 'small' | 'default';
export interface HYDescriptionItem {
  key?: string;
  label: string;
  value?: string | number | boolean | null;
  span?: number | 'filled';
}
interface DescriptionRow { element: HTMLDivElement; label: HTMLSlotElement; value: HTMLSlotElement; }

/** Semantic definition list with responsive columns, spans and rich value slots. */
export class HYDescriptions extends HTMLElement {
  private readonly _header = document.createElement('header');
  private readonly _heading = document.createElement('slot');
  private readonly _extra = document.createElement('slot');
  private readonly _list = document.createElement('dl');
  private readonly _rows = new Map<string, DescriptionRow>();
  private _items: HYDescriptionItem[] = [];
  private _observer: ResizeObserver | null = null;
  private _width = 0;
  static get observedAttributes(): string[] { return ['heading', 'items', 'column', 'layout', 'bordered', 'size', 'responsive', 'empty-text', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #eef0ff); font: var(--hy-font-size-sm, 12px)/var(--hy-line-height-relaxed, 1.5) var(--hy-font-family, system-ui, sans-serif); }
      header { display: flex; align-items: center; justify-content: space-between; gap: var(--hy-space-6, 12px); margin-bottom: var(--hy-space-8, 16px); }
      h3 { flex: 1; min-width: 0; margin: 0; font-size: var(--hy-font-size-md, 14px); font-weight: var(--hy-font-weight-semibold, 600); overflow-wrap: anywhere; }
      dl { display: grid; grid-template-columns: repeat(var(--_columns, 3), minmax(0, 1fr)); gap: var(--hy-descriptions-row-gap, var(--hy-space-6, 12px)) var(--hy-descriptions-column-gap, var(--hy-space-10, 20px)); margin: 0; min-width: 0; }
      .item { display: grid; grid-template-columns: var(--hy-descriptions-label-width, minmax(0, 1fr)) minmax(0, 2fr); min-width: 0; gap: var(--hy-space-4, 8px); }
      dt, dd { min-width: 0; margin: 0; overflow-wrap: anywhere; } dt { color: var(--hy-secondary-text-color, #a9add4); }
      :host([layout="vertical"]) .item { grid-template-columns: minmax(0, 1fr); }
      :host([bordered]) dl { gap: 1px; overflow: hidden; border: 1px solid var(--hy-border-color, #343765); border-radius: var(--hy-descriptions-radius, var(--hy-radius-md, 6px)); background: var(--hy-border-color, #343765); }
      :host([bordered]) .item { gap: 0; background: var(--hy-surface-elevated-color, #181a40); }
      :host([bordered]) dt, :host([bordered]) dd { padding: var(--hy-descriptions-cell-padding, var(--hy-space-6, 12px) var(--hy-space-8, 16px)); }
      :host([bordered]) dt { background: var(--hy-surface-color, #10132f); }
      :host([bordered]:not([layout="vertical"])) dd { border-inline-start: 1px solid var(--hy-border-color, #343765); }
      :host([size="small"][bordered]) dt, :host([size="small"][bordered]) dd { padding: var(--hy-space-3, 6px) var(--hy-space-6, 12px); }
      [hidden] { display: none !important; }
    `;
    this._header.part.add('header'); const heading = document.createElement('h3'); heading.id = 'descriptions-heading'; heading.part.add('heading');
    this._heading.name = 'heading'; heading.append(this._heading); this._extra.name = 'extra'; this._extra.part.add('extra'); this._header.append(heading, this._extra);
    this._list.part.add('list'); root.append(style, this._header, this._list);
    for (const slot of [this._heading, this._extra]) slot.addEventListener('slotchange', this._render);
  }
  connectedCallback(): void {
    this._observer?.disconnect();
    this._width = this.getBoundingClientRect().width;
    this._observer = new ResizeObserver(entries => { this._width = entries[0]?.contentRect.width ?? 0; this._layout(); });
    this._observer.observe(this); this._render();
  }
  disconnectedCallback(): void { this._observer?.disconnect(); this._observer = null; }
  attributeChangedCallback(name: string): void {
    if (name === 'items') {
      try { this._items = this._normalize(JSON.parse(this.getAttribute('items') ?? '[]')); }
      catch { this._items = []; }
    }
    this._render();
  }
  get items(): HYDescriptionItem[] { return this._items.map(item => ({ ...item })); }
  set items(value: readonly HYDescriptionItem[]) { this._items = this._normalize(value); this._render(); }
  get heading(): string { return this.getAttribute('heading') ?? ''; }
  set heading(value: string) { this.setAttribute('heading', value); }
  get column(): number {
    const value = Number(this.getAttribute('column') ?? 3);
    return Number.isFinite(value) ? Math.max(1, Math.min(6, Math.floor(value))) : 3;
  }
  set column(value: number) { this.setAttribute('column', String(value)); }
  get layout(): HYDescriptionsLayout { return this.getAttribute('layout') === 'vertical' ? 'vertical' : 'horizontal'; }
  set layout(value: HYDescriptionsLayout) { this.setAttribute('layout', value); }
  get bordered(): boolean { return this.hasAttribute('bordered'); }
  set bordered(value: boolean) { this.toggleAttribute('bordered', Boolean(value)); }
  get size(): HYDescriptionsSize { return this.getAttribute('size') === 'small' ? 'small' : 'default'; }
  set size(value: HYDescriptionsSize) { this.setAttribute('size', value); }
  get responsive(): boolean { return this.getAttribute('responsive') !== 'false'; }
  set responsive(value: boolean) { this.setAttribute('responsive', String(value)); }
  get emptyText(): string { return this.getAttribute('empty-text') ?? '—'; }
  set emptyText(value: string) { this.setAttribute('empty-text', value); }
  private _normalize(value: unknown): HYDescriptionItem[] {
    if (!Array.isArray(value)) return [];
    const keys = new Set<string>();
    return value.map((raw: HYDescriptionItem, index) => {
      const key = String(raw?.key ?? index);
      if (keys.has(key)) throw new TypeError(`Duplicate description key: ${key}`);
      keys.add(key);
      const itemValue = raw?.value;
      return { key, label: String(raw?.label ?? ''), value: typeof itemValue === 'string' || typeof itemValue === 'number' || typeof itemValue === 'boolean' ? itemValue : null,
        span: raw?.span === 'filled' ? 'filled' : Math.max(1, Math.min(6, Math.floor(Number(raw?.span)) || 1)) };
    });
  }
  private _layout(): void {
    const columns = this.responsive && this._width < 480 ? 1 : this.responsive && this._width < 720 ? Math.min(2, this.column) : this.column;
    this._list.style.setProperty('--_columns', String(columns));
    let occupied = 0;
    for (const item of this._items) {
      let span = item.span === 'filled' ? columns - occupied : Math.min(columns, Number(item.span) || 1);
      if (occupied + span > columns) occupied = 0;
      span = Math.max(1, span);
      this._rows.get(item.key!)?.element.style.setProperty('grid-column', `${occupied + 1} / span ${span}`);
      occupied = (occupied + span) % columns;
    }
  }
  private _render = (): void => {
    if (this._heading.textContent !== this.heading) this._heading.textContent = this.heading;
    const heading = Boolean(this.heading) || hasSlotContent(this._heading);
    this._header.firstElementChild!.toggleAttribute('hidden', !heading); this._extra.hidden = !hasSlotContent(this._extra); this._header.hidden = !heading && this._extra.hidden;
    const label = this.getAttribute('aria-label');
    if (label || !heading) { this._list.setAttribute('aria-label', label || 'Details'); this._list.removeAttribute('aria-labelledby'); }
    else { this._list.removeAttribute('aria-label'); this._list.setAttribute('aria-labelledby', 'descriptions-heading'); }
    const keys = new Set(this._items.map(item => item.key!));
    for (const [key, row] of this._rows) if (!keys.has(key)) { row.element.remove(); this._rows.delete(key); }
    this._items.forEach((item, index) => {
      const key = item.key!;
      let row = this._rows.get(key);
      if (!row) {
        const element = document.createElement('div'); element.className = 'item'; element.part.add('item'); element.dataset.key = key;
        const term = document.createElement('dt'); term.part.add('label'); const label = document.createElement('slot'); label.name = `label-${key}`; term.append(label);
        const definition = document.createElement('dd'); definition.part.add('value'); const value = document.createElement('slot'); value.name = `value-${key}`; definition.append(value);
        element.append(term, definition); row = { element, label, value }; this._rows.set(key, row);
      }
      if (row.label.textContent !== item.label) row.label.textContent = item.label;
      const value = item.value == null || item.value === '' ? this.emptyText : String(item.value);
      if (row.value.textContent !== value) row.value.textContent = value;
      if (this._list.children[index] !== row.element) this._list.insertBefore(row.element, this._list.children[index] ?? null);
    });
    this._layout();
  };
}
export function defineDescriptionsComponents(): void { if (!customElements.get('hy-descriptions')) customElements.define('hy-descriptions', HYDescriptions); }
