export type HYTimelineMode = 'left' | 'right' | 'alternate';
export type HYTimelineStatus = 'default' | 'success' | 'info' | 'warning' | 'error';
export type HYTimelineItemPosition = 'left' | 'right';

export interface HYTimelineItem {
  readonly key?: string | number;
  readonly label?: string;
  readonly title: string;
  readonly description?: string;
  readonly status?: HYTimelineStatus;
  readonly color?: string;
  readonly dot?: string;
  readonly position?: HYTimelineItemPosition;
}

export type HYTimelineItemRenderer = (item: HYTimelineItem, index: number) => Node | string;
export type HYTimelineDotRenderer = (item: HYTimelineItem, index: number) => Node | string;

function normalizeItems(value: unknown): HYTimelineItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (record.title == null) return [];
    const status: HYTimelineStatus = ['success', 'info', 'warning', 'error'].includes(String(record.status)) ? String(record.status) as HYTimelineStatus : 'default';
    const position = record.position === 'left' || record.position === 'right' ? record.position : undefined;
    return [{
      title: String(record.title),
      ...(record.key != null && (typeof record.key === 'string' || typeof record.key === 'number') ? { key: record.key } : {}),
      ...(record.label != null ? { label: String(record.label) } : {}),
      ...(record.description != null ? { description: String(record.description) } : {}),
      ...(record.color != null ? { color: String(record.color) } : {}),
      ...(record.dot != null ? { dot: String(record.dot) } : {}),
      ...(position ? { position } : {}),
      status,
    }];
  });
}

/** Semantic, responsive timeline for ordered events and process history. */
export class HYTimeline extends HTMLElement {
  private readonly _list = document.createElement('ol');
  private _items: readonly HYTimelineItem[] = [];
  private _itemsAssigned = false;
  private _renderItem: HYTimelineItemRenderer | null = null;
  private _renderDot: HYTimelineDotRenderer | null = null;

  static get observedAttributes(): string[] { return ['items', 'mode', 'reverse', 'pending', 'pending-dot', 'aria-label']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #eef3ff); font: 12px/1.5 system-ui, sans-serif; }
      .timeline { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
      .item { display: grid; grid-template-columns: minmax(0, 1fr) var(--hy-timeline-axis-width, 30px) minmax(0, 1fr); min-height: var(--hy-timeline-item-min-height, 72px); margin: 0; padding: 0; }
      .label { grid-column: 1; padding: 1px 14px 22px 0; color: var(--hy-muted-color, #788697); text-align: right; }
      .axis { position: relative; grid-column: 2; grid-row: 1; display: flex; justify-content: center; }
      .axis::after { position: absolute; top: 16px; bottom: 0; width: var(--hy-timeline-line-width, 1px); background: var(--hy-timeline-line-color, var(--hy-border-color, #3d4654)); content: ''; }
      .item:last-child .axis::after { display: none; }
      .dot { position: relative; z-index: 1; display: grid; width: var(--hy-timeline-dot-size, 10px); height: var(--hy-timeline-dot-size, 10px); box-sizing: border-box; place-items: center; margin-top: 4px; border: 2px solid var(--_dot-color, var(--hy-muted-color, #788697)); border-radius: 50%; color: var(--_dot-color, var(--hy-muted-color, #788697)); background: var(--hy-surface-color, #111722); font-size: 9px; line-height: 1; }
      .dot.custom { width: var(--hy-timeline-custom-dot-size, 22px); height: var(--hy-timeline-custom-dot-size, 22px); margin-top: -2px; border-width: 1px; background: var(--hy-surface-elevated-color, #171d27); }
      .status-success { --_dot-color: var(--hy-success-color, #4ade80); }
      .status-info { --_dot-color: var(--hy-info-color, var(--hy-accent-color, #79a8ff)); }
      .status-warning { --_dot-color: var(--hy-warning-color, #fbbf24); }
      .status-error { --_dot-color: var(--hy-error-color, #fb7185); }
      .card { grid-column: 3; min-width: 0; padding: 0 0 22px 14px; }
      .title { color: var(--hy-text-color, #eef3ff); font-weight: 650; }
      .description { margin-top: 4px; color: var(--hy-secondary-text-color, #aebbd0); }
      .content-left .card { grid-column: 1; padding: 0 14px 22px 0; text-align: right; }
      .content-left .label { grid-column: 3; padding: 1px 0 22px 14px; text-align: left; }
      .pending .dot { border-style: dashed; animation: hy-timeline-spin 1.2s linear infinite; }
      .pending .dot.custom { animation: none; }
      @keyframes hy-timeline-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .pending .dot { animation: none; } }
      @media (max-width: 560px) {
        .item, .item.content-left { grid-template-columns: var(--hy-timeline-axis-width, 30px) minmax(0, 1fr); }
        .axis, .item.content-left .axis { grid-column: 1; }
        .card, .item.content-left .card { grid-column: 2; padding: 0 0 22px 12px; text-align: left; }
        .label, .item.content-left .label { grid-column: 2; grid-row: 1; justify-self: end; padding: 1px 0 0 12px; text-align: right; }
        .label + .axis + .card { padding-top: 22px; }
      }
    `;
    this._list.className = 'timeline'; this._list.part.add('list'); root.append(style, this._list);
  }

  connectedCallback(): void {
    if (!this._itemsAssigned && this.hasAttribute('items')) this._readItemsAttribute();
    this._render();
  }
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === 'items' && !this._itemsAssigned) this._readItemsAttribute();
    this._render();
  }

  get items(): readonly HYTimelineItem[] { return this._items; }
  set items(value: readonly HYTimelineItem[]) { this._itemsAssigned = true; this._items = normalizeItems(value); this._render(); }
  get mode(): HYTimelineMode { const value = this.getAttribute('mode'); return value === 'right' || value === 'alternate' ? value : 'left'; }
  set mode(value: HYTimelineMode) { this.setAttribute('mode', value === 'right' || value === 'alternate' ? value : 'left'); }
  get reverse(): boolean { return this.hasAttribute('reverse'); }
  set reverse(value: boolean) { this.toggleAttribute('reverse', Boolean(value)); }
  get pending(): string { return this.getAttribute('pending') ?? ''; }
  set pending(value: string) { const normalized = String(value); if (normalized) this.setAttribute('pending', normalized); else this.removeAttribute('pending'); }
  get pendingDot(): string { return this.getAttribute('pending-dot') ?? ''; }
  set pendingDot(value: string) { const normalized = String(value); if (normalized) this.setAttribute('pending-dot', normalized); else this.removeAttribute('pending-dot'); }
  get renderItem(): HYTimelineItemRenderer | null { return this._renderItem; }
  set renderItem(value: HYTimelineItemRenderer | null) { this._renderItem = typeof value === 'function' ? value : null; this._render(); }
  get renderDot(): HYTimelineDotRenderer | null { return this._renderDot; }
  set renderDot(value: HYTimelineDotRenderer | null) { this._renderDot = typeof value === 'function' ? value : null; this._render(); }

  private _readItemsAttribute(): void {
    try { this._items = normalizeItems(JSON.parse(this.getAttribute('items') ?? '[]')); } catch { this._items = []; }
  }

  private _render(): void {
    if (!this.isConnected) return;
    const name = this.getAttribute('aria-label'); if (name) this._list.setAttribute('aria-label', name); else this._list.removeAttribute('aria-label');
    const source = this.reverse ? [...this._items].reverse() : [...this._items];
    const nodes = source.map((item, index) => this._createItem(item, index, false));
    if (this.pending) { const pending = this._createPending(); if (this.reverse) nodes.unshift(pending); else nodes.push(pending); }
    this._list.replaceChildren(...nodes);
  }

  private _createItem(item: HYTimelineItem, index: number, pending: boolean): HTMLLIElement {
    const element = document.createElement('li'); element.className = `item status-${item.status ?? 'default'}`; element.part.add('item');
    const position = item.position ?? this._positionFor(index); element.classList.toggle('content-left', position === 'left'); if (pending) { element.classList.add('pending'); element.part.add('pending'); }
    if (item.color) element.style.setProperty('--_dot-color', item.color);
    const label = document.createElement('div'); label.className = 'label'; label.part.add('label'); label.textContent = item.label ?? '';
    const axis = document.createElement('div'); axis.className = 'axis'; axis.part.add('axis'); const dot = document.createElement('span'); dot.className = 'dot'; dot.part.add('dot');
    const customDot = pending ? this.pendingDot : this._renderDot?.(item, index) ?? item.dot; if (customDot) { dot.classList.add('custom'); dot.append(this._toNode(customDot)); }
    axis.append(dot);
    const card = document.createElement('div'); card.className = 'card'; card.part.add('content');
    if (pending) { const title = document.createElement('div'); title.className = 'title'; title.part.add('title'); title.textContent = this.pending; card.append(title); }
    else if (this._renderItem) card.append(this._toNode(this._renderItem(item, index)));
    else { const title = document.createElement('div'); title.className = 'title'; title.part.add('title'); title.textContent = item.title; card.append(title); if (item.description) { const description = document.createElement('div'); description.className = 'description'; description.part.add('description'); description.textContent = item.description; card.append(description); } }
    element.append(label, axis, card); return element;
  }

  private _createPending(): HTMLLIElement { return this._createItem({ title: this.pending, status: 'info' }, this._items.length, true); }
  private _positionFor(index: number): HYTimelineItemPosition {
    if (this.mode === 'right') return 'left';
    if (this.mode === 'alternate') return index % 2 === 0 ? 'right' : 'left';
    return 'right';
  }
  private _toNode(value: Node | string): Node { return value instanceof Node ? value : document.createTextNode(String(value)); }
}

export function defineTimelineComponents(): void {
  if (!customElements.get('hy-timeline')) customElements.define('hy-timeline', HYTimeline);
}
