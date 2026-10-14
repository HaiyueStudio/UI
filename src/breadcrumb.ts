export interface HYBreadcrumbItem {
  readonly key?: string;
  /** Ant Design-compatible display text. */
  readonly title?: string;
  /** Alias for title, retained for consistency with the other Haiyue UI data components. */
  readonly label?: string;
  readonly href?: string;
  readonly target?: string;
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
}

export interface HYBreadcrumbClickDetail {
  readonly item: HYBreadcrumbItem;
  readonly index: number;
}

export type HYBreadcrumbItemRenderer = (
  item: HYBreadcrumbItem,
  index: number,
  current: boolean,
) => Node | string | number | null | undefined;

function itemTitle(item: HYBreadcrumbItem): string {
  return String(item.title ?? item.label ?? '');
}

/** Accessible breadcrumb navigation with links, actions, and a configurable separator. */
export class HYBreadcrumb extends HTMLElement {
  private readonly _nav = document.createElement('nav');
  private readonly _list = document.createElement('ol');
  private _items: readonly HYBreadcrumbItem[] = [];
  private _renderItem: HYBreadcrumbItemRenderer | null = null;

  static get observedAttributes(): string[] {
    return ['items', 'separator', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        min-width: 0;
        color: var(--hy-secondary-text-color, #aebbd0);
        font: 12px/1.4 system-ui, sans-serif;
      }
      nav { min-width: 0; }
      ol {
        display: flex;
        align-items: center;
        min-width: 0;
        margin: 0;
        padding: 0;
        overflow-x: auto;
        overflow-y: hidden;
        list-style: none;
        scrollbar-width: none;
      }
      ol::-webkit-scrollbar { display: none; }
      li {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        min-width: 0;
      }
      a, button, .current, .disabled {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        max-width: var(--hy-breadcrumb-item-max-width, 240px);
        box-sizing: border-box;
        padding: var(--hy-breadcrumb-item-padding, 3px 5px);
        overflow: hidden;
        border: 0;
        border-radius: var(--hy-breadcrumb-radius, 4px);
        color: inherit;
        background: transparent;
        font: inherit;
        text-decoration: none;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      a, button { cursor: pointer; }
      a:hover, button:hover {
        color: var(--hy-text-color, #eef3ff);
        background: var(--hy-hover-bg-color, #273241);
      }
      a:focus-visible, button:focus-visible {
        outline: 2px solid var(--hy-focus-border-color, #79a8ff);
        outline-offset: 1px;
      }
      .current {
        color: var(--hy-text-color, #eef3ff);
        font-weight: 600;
      }
      .disabled { color: var(--hy-disabled-text-color, #657185); cursor: not-allowed; }
      .separator {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 14px;
        padding: 0 var(--hy-breadcrumb-separator-gap, 3px);
        color: var(--hy-muted-color, #657185);
        user-select: none;
      }
    `;
    this._nav.part.add('nav');
    this._list.part.add('list');
    this._nav.append(this._list);
    root.append(style, this._nav);
  }

  connectedCallback(): void {
    if (this.hasAttribute('items')) this._readItemsAttribute();
    this._render();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === 'items') this._readItemsAttribute();
    this._render();
  }

  get items(): readonly HYBreadcrumbItem[] { return this._items; }
  set items(value: readonly HYBreadcrumbItem[]) {
    this._items = Array.isArray(value) ? value.map(item => ({ ...item, title: itemTitle(item) })) : [];
    this._render();
  }

  get separator(): string { return this.getAttribute('separator') ?? '/'; }
  set separator(value: string) { this.setAttribute('separator', String(value)); }

  get renderItem(): HYBreadcrumbItemRenderer | null { return this._renderItem; }
  set renderItem(value: HYBreadcrumbItemRenderer | null) {
    this._renderItem = typeof value === 'function' ? value : null;
    this._render();
  }

  private _readItemsAttribute(): void {
    const raw = this.getAttribute('items');
    if (!raw) {
      this._items = [];
      return;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      this._items = Array.isArray(parsed) ? parsed.map((item: unknown) => {
        const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          ...(record.key == null ? {} : { key: String(record.key) }),
          title: String(record.title ?? record.label ?? ''),
          ...(record.label == null ? {} : { label: String(record.label) }),
          ...(record.href == null ? {} : { href: String(record.href) }),
          ...(record.target == null ? {} : { target: String(record.target) }),
          disabled: Boolean(record.disabled),
          ...(record.ariaLabel == null ? {} : { ariaLabel: String(record.ariaLabel) }),
        };
      }) : [];
    } catch (error) {
      console.warn('Invalid hy-breadcrumb items attribute.', error);
    }
  }

  private _render(): void {
    this._nav.setAttribute('aria-label', this.getAttribute('aria-label') ?? 'Breadcrumb');
    const lastIndex = this._items.length - 1;
    const rows = this._items.map((item, index) => {
      const row = document.createElement('li');
      row.part.add('item');
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'separator';
        separator.part.add('separator');
        separator.setAttribute('aria-hidden', 'true');
        separator.textContent = this.separator;
        row.append(separator);
      }
      const current = index === lastIndex;
      const content = this._renderItem?.(item, index, current) ?? itemTitle(item);
      let element: HTMLAnchorElement | HTMLButtonElement | HTMLSpanElement;
      if (current) {
        element = document.createElement('span');
        element.className = 'current';
        element.part.add('current');
        element.setAttribute('aria-current', 'page');
      } else if (item.disabled) {
        element = document.createElement('span');
        element.className = 'disabled';
        element.part.add('disabled');
        element.setAttribute('aria-disabled', 'true');
      } else if (item.href) {
        const anchor = document.createElement('a');
        anchor.href = item.href;
        if (item.target) anchor.target = item.target;
        anchor.part.add('link');
        anchor.addEventListener('click', event => {
          if (!this._dispatchItemClick(item, index)) event.preventDefault();
        });
        element = anchor;
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.part.add('button');
        button.addEventListener('click', () => this._dispatchItemClick(item, index));
        element = button;
      }
      if (item.ariaLabel) element.setAttribute('aria-label', item.ariaLabel);
      if (content instanceof Node) element.append(content);
      else element.textContent = content == null ? '' : String(content);
      row.append(element);
      return row;
    });
    this._list.replaceChildren(...rows);
  }

  private _dispatchItemClick(item: HYBreadcrumbItem, index: number): boolean {
    return this.dispatchEvent(new CustomEvent<HYBreadcrumbClickDetail>('breadcrumb-click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: { item, index },
    }));
  }
}

export function defineBreadcrumbComponents(): void {
  if (!customElements.get('hy-breadcrumb')) customElements.define('hy-breadcrumb', HYBreadcrumb);
}
