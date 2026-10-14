export type HYTableAlign = 'left' | 'center' | 'right';
export type HYTableSortDirection = 'asc' | 'desc';
export type HYTableChangeReason = 'paginate' | 'sort' | 'filter';

export interface HYTableFilterOption {
  readonly label: string;
  readonly value: string;
}

export interface HYTableColumn<T extends object = Record<string, unknown>> {
  readonly key: string;
  readonly title: string;
  readonly dataIndex?: string;
  readonly width?: string | number;
  readonly align?: HYTableAlign;
  readonly sortable?: boolean;
  readonly sorter?: (left: T, right: T) => number;
  readonly filterable?: boolean;
  /** Show this column's funnel control. Filtering APIs remain available when hidden. */
  readonly showFilter?: boolean;
  readonly filterOptions?: readonly HYTableFilterOption[];
  readonly filterPlaceholder?: string;
  readonly filter?: (filterValue: string, record: T) => boolean;
  readonly render?: (value: unknown, record: T, index: number) => Node | string | number | null | undefined;
}

export interface HYTableSortState {
  readonly key: string;
  readonly direction: HYTableSortDirection;
}

export type HYTableFilterState = Readonly<Record<string, string>>;

export interface HYTableChangeDetail<T extends object = Record<string, unknown>> {
  readonly reason: HYTableChangeReason;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly total: number;
  readonly filteredTotal: number;
  readonly sort: HYTableSortState | null;
  readonly filters: HYTableFilterState;
  readonly visibleData: readonly T[];
}

export interface HYTableRowClickDetail<T extends object = Record<string, unknown>> {
  readonly record: T;
  readonly index: number;
}

interface IndexedRecord<T extends object> {
  readonly record: T;
  readonly index: number;
}

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function finiteInteger(value: unknown, fallback: number, minimum = 1): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.floor(number)) : fallback;
}

function positiveIntegerOptions(value: readonly unknown[]): number[] {
  return [...new Set(value
    .map(item => Number(item))
    .filter(item => Number.isFinite(item) && item > 0)
    .map(item => Math.floor(item)))]
    .sort((left, right) => left - right);
}

function readValue(record: object, path: string): unknown {
  let value: unknown = record;
  for (const segment of path.split('.')) {
    if (!value || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function defaultCompare(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  return collator.compare(String(left), String(right));
}

function partToken(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'column';
}

function isSortable<T extends object>(column: HYTableColumn<T>): boolean {
  return Boolean(column.sortable || column.sorter);
}

function isFilterable<T extends object>(column: HYTableColumn<T>): boolean {
  return Boolean(column.filterable || column.filterOptions || column.filter);
}

/** Local-data table with column filters, stable sorting, and client-side pagination. */
export class HYTable<T extends object = Record<string, unknown>> extends HTMLElement {
  private readonly _scroller = document.createElement('div');
  private readonly _table = document.createElement('table');
  private readonly _head = document.createElement('thead');
  private readonly _body = document.createElement('tbody');
  private readonly _pagination = document.createElement('nav');
  private _columns: readonly HYTableColumn<T>[] = [];
  private _dataSource: readonly T[] = [];
  private _filters: Record<string, string> = {};
  private _sort: HYTableSortState | null = null;
  private _page = 1;
  private _pageSize = DEFAULT_PAGE_SIZE;
  private _pageSizeOptions: readonly number[] = DEFAULT_PAGE_SIZE_OPTIONS;
  private _reflecting = false;

  static get observedAttributes(): string[] {
    return ['page', 'page-size', 'page-size-options', 'pagination', 'show-filters', 'aria-label'];
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
      .scroller {
        overflow: auto;
        border: 1px solid var(--hy-border-color, #3d4654);
        border-radius: var(--hy-table-radius, 7px);
        background: var(--hy-surface-color, #171d27);
        scrollbar-color: var(--hy-border-strong-color, #596779) var(--hy-input-bg-color, #111722);
        scrollbar-width: thin;
      }
      table { width: 100%; border-collapse: collapse; table-layout: var(--hy-table-layout, auto); }
      th, td {
        box-sizing: border-box;
        min-width: 0;
        padding: var(--hy-table-cell-padding, 11px 13px);
        border-bottom: 1px solid var(--hy-border-subtle-color, var(--hy-border-color, #3d4654));
        overflow-wrap: anywhere;
      }
      th {
        position: relative;
        color: var(--hy-secondary-text-color, #aebbd0);
        background: var(--hy-table-header-background, var(--hy-input-bg-color, #111722));
        font-size: 11px;
        font-weight: 650;
        text-align: left;
      }
      tbody tr { background: var(--hy-table-row-background, var(--hy-surface-color, #171d27)); }
      tbody tr:hover { background: var(--hy-table-row-hover-background, var(--hy-hover-bg-color, #273241)); }
      tbody tr:last-child td { border-bottom: 0; }
      thead { position: relative; z-index: 2; }
      tbody { position: relative; z-index: 1; }
      .header-content { display: flex; align-items: center; gap: 7px; min-width: 0; }
      .header-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sort-button {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        max-width: 100%;
        padding: 0;
        border: 0;
        color: inherit;
        background: transparent;
        cursor: pointer;
        font: inherit;
        text-align: inherit;
      }
      .sort-button:hover, .sort-button:focus-visible { color: var(--hy-accent-color, #79a8ff); }
      .sort-indicator { color: var(--hy-muted-text-color, #667587); font-size: 9px; }
      th[aria-sort="ascending"] .sort-indicator,
      th[aria-sort="descending"] .sort-indicator { color: var(--hy-accent-color, #79a8ff); }
      .filter-menu { position: relative; flex: 0 0 auto; }
      .filter-trigger {
        display: grid;
        width: 24px;
        height: 24px;
        box-sizing: border-box;
        place-items: center;
        padding: 0;
        border: 1px solid transparent;
        border-radius: var(--hy-table-filter-radius, 5px);
        color: var(--hy-muted-text-color, #667587);
        background: transparent;
        cursor: pointer;
        list-style: none;
      }
      .filter-trigger::-webkit-details-marker { display: none; }
      .filter-trigger svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
      .filter-trigger:hover, .filter-trigger:focus-visible, .filter-menu[open] .filter-trigger {
        border-color: var(--hy-border-color, #3d4654);
        color: var(--hy-accent-color, #79a8ff);
        background: var(--hy-hover-bg-color, #273241);
        outline: none;
      }
      .filter-trigger[data-active="true"] { color: var(--hy-accent-color, #79a8ff); }
      .filter-panel {
        position: absolute;
        top: calc(100% + 7px);
        left: 0;
        z-index: 5;
        display: flex;
        width: max-content;
        min-width: 184px;
        max-width: min(280px, 70vw);
        gap: 7px;
        box-sizing: border-box;
        padding: 9px;
        border: 1px solid var(--hy-border-color, #3d4654);
        border-radius: var(--hy-table-filter-panel-radius, 7px);
        background: var(--hy-surface-elevated-color, var(--hy-surface-color, #171d27));
        box-shadow: 0 10px 28px var(--hy-menu-shadow-color, rgba(0, 0, 0, 0.28));
      }
      .filter-menu:not([open]) .filter-panel { display: none; }
      th:last-child .filter-panel { right: 0; left: auto; }
      .filter {
        flex: 1 1 auto;
        width: 150px;
        min-width: 74px;
        height: 30px;
        box-sizing: border-box;
        padding: 0 9px;
        border: 1px solid var(--hy-border-color, #3d4654);
        border-radius: var(--hy-table-filter-radius, 5px);
        outline: none;
        color: var(--hy-text-color, #eef3ff);
        background: var(--hy-input-bg-color, #111722);
        font: 11px system-ui, sans-serif;
      }
      .filter:focus { border-color: var(--hy-focus-border-color, #79a8ff); box-shadow: 0 0 0 2px var(--hy-focus-ring-color, rgba(121, 168, 255, 0.22)); }
      .filter-clear {
        flex: 0 0 auto;
        height: 30px;
        padding: 0 9px;
        border: 1px solid var(--hy-border-color, #3d4654);
        border-radius: var(--hy-table-filter-radius, 5px);
        color: var(--hy-secondary-text-color, #aebbd0);
        background: var(--hy-surface-color, #171d27);
        cursor: pointer;
        font: 11px system-ui, sans-serif;
      }
      .filter-clear:hover:not(:disabled) { border-color: var(--hy-accent-color, #79a8ff); color: var(--hy-accent-color, #79a8ff); }
      .filter-clear:disabled { cursor: default; opacity: 0.45; }
      .empty { height: 112px; color: var(--hy-muted-text-color, #788697); text-align: center; }
      .pagination {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        padding: 11px 0 0;
      }
      .pagination[hidden] { display: none; }
      .pagination button, .pagination select {
        height: 30px;
        box-sizing: border-box;
        border: 1px solid var(--hy-border-color, #3d4654);
        border-radius: 5px;
        color: var(--hy-secondary-text-color, #aebbd0);
        background: var(--hy-surface-color, #171d27);
        font: 11px system-ui, sans-serif;
      }
      .pagination button { min-width: 30px; padding: 0 8px; cursor: pointer; }
      .pagination button:hover:not(:disabled), .pagination button[aria-current="page"] { border-color: var(--hy-accent-color, #79a8ff); color: var(--hy-accent-color, #79a8ff); }
      .pagination button:disabled { cursor: not-allowed; opacity: 0.45; }
      .pagination select { margin-left: 6px; padding: 0 7px; }
      .summary { margin-right: auto; color: var(--hy-muted-text-color, #788697); font-size: 10px; }
    `;
    this._scroller.className = 'scroller';
    this._scroller.part.add('scroller');
    this._table.part.add('table');
    this._head.part.add('header');
    this._body.part.add('body');
    this._pagination.className = 'pagination';
    this._pagination.part.add('pagination');
    this._pagination.setAttribute('aria-label', 'Table pagination');
    this._table.append(this._head, this._body);
    this._scroller.append(this._table);
    root.append(style, this._scroller, this._pagination);
  }

  connectedCallback(): void {
    this._syncAttributes();
    this._render();
  }

  attributeChangedCallback(): void {
    if (this._reflecting) return;
    this._syncAttributes();
    this._render();
  }

  get columns(): readonly HYTableColumn<T>[] { return this._columns; }
  set columns(value: readonly HYTableColumn<T>[]) {
    this._columns = Array.isArray(value) ? [...value] : [];
    const keys = new Set(this._columns.map(column => column.key));
    this._filters = Object.fromEntries(Object.entries(this._filters).filter(([key]) => keys.has(key)));
    if (this._sort && !keys.has(this._sort.key)) this._sort = null;
    this._clampPage();
    this._render();
  }

  get dataSource(): readonly T[] { return this._dataSource; }
  set dataSource(value: readonly T[]) {
    this._dataSource = Array.isArray(value) ? [...value] : [];
    this._clampPage();
    this._renderBodyAndPagination();
  }

  get page(): number { return this._page; }
  set page(value: number) { this.goToPage(value); }

  get pageSize(): number { return this._pageSize; }
  set pageSize(value: number) {
    const next = finiteInteger(value, DEFAULT_PAGE_SIZE);
    if (next === this._pageSize) return;
    this._pageSize = next;
    this._page = 1;
    this._reflectNumber('page-size', next);
    this._reflectNumber('page', 1);
    this._renderBodyAndPagination();
    this._dispatchChange('paginate');
  }

  get pageSizeOptions(): readonly number[] { return this._pageSizeOptions; }
  set pageSizeOptions(value: readonly number[]) {
    const options = positiveIntegerOptions(Array.isArray(value) ? value : []);
    this._pageSizeOptions = options.length ? options : DEFAULT_PAGE_SIZE_OPTIONS;
    this.setAttribute('page-size-options', this._pageSizeOptions.join(','));
    this._renderPagination();
  }

  get pagination(): boolean { return this.getAttribute('pagination') !== 'false'; }
  set pagination(value: boolean) { this.setAttribute('pagination', String(Boolean(value))); }

  get showFilters(): boolean { return this.getAttribute('show-filters') !== 'false'; }
  set showFilters(value: boolean) { this.setAttribute('show-filters', String(Boolean(value))); }

  get sort(): HYTableSortState | null { return this._sort ? { ...this._sort } : null; }
  set sort(value: HYTableSortState | null) {
    if (!value) this._sort = null;
    else {
      const column = this._columns.find(item => item.key === value.key);
      this._sort = column && isSortable(column) && (value.direction === 'asc' || value.direction === 'desc')
        ? { key: value.key, direction: value.direction }
        : null;
    }
    this._page = 1;
    this._reflectNumber('page', 1);
    this._render();
    this._dispatchChange('sort');
  }

  get filters(): HYTableFilterState { return { ...this._filters }; }
  set filters(value: HYTableFilterState) {
    const allowed = new Set(this._columns.map(column => column.key));
    this._filters = Object.fromEntries(
      Object.entries(value ?? {}).filter(([key, filter]) => allowed.has(key) && String(filter).length > 0).map(([key, filter]) => [key, String(filter)]),
    );
    this._page = 1;
    this._reflectNumber('page', 1);
    this._render();
    this._dispatchChange('filter');
  }

  get filteredData(): readonly T[] { return this._processedRecords().map(item => item.record); }
  get visibleData(): readonly T[] { return this._visibleRecords().map(item => item.record); }

  goToPage(value: number): void {
    const next = Math.min(this.pageCount, finiteInteger(value, 1));
    if (next === this._page) return;
    this._page = next;
    this._reflectNumber('page', next);
    this._renderBodyAndPagination();
    this._dispatchChange('paginate');
  }

  get pageCount(): number {
    if (!this.pagination) return 1;
    return Math.max(1, Math.ceil(this._processedRecords().length / this._pageSize));
  }

  sortBy(key: string, direction?: HYTableSortDirection): void {
    const column = this._columns.find(item => item.key === key && isSortable(item));
    if (!column) return;
    let nextDirection = direction;
    if (!nextDirection) {
      if (this._sort?.key !== key) nextDirection = 'asc';
      else if (this._sort.direction === 'asc') nextDirection = 'desc';
      else {
        this.sort = null;
        return;
      }
    }
    this.sort = { key, direction: nextDirection };
  }

  clearSort(): void { this.sort = null; }

  setFilter(key: string, value: string): void {
    const column = this._columns.find(item => item.key === key && isFilterable(item));
    if (!column) return;
    const normalized = String(value);
    if (normalized) this._filters[key] = normalized;
    else delete this._filters[key];
    this._page = 1;
    this._reflectNumber('page', 1);
    this._render();
    this._dispatchChange('filter');
  }

  clearFilters(): void {
    if (Object.keys(this._filters).length === 0) return;
    this._filters = {};
    this._page = 1;
    this._reflectNumber('page', 1);
    this._render();
    this._dispatchChange('filter');
  }

  private _syncAttributes(): void {
    this._pageSize = finiteInteger(this.getAttribute('page-size'), this._pageSize);
    this._page = finiteInteger(this.getAttribute('page'), this._page);
    if (this.hasAttribute('page-size-options')) {
      const options = positiveIntegerOptions((this.getAttribute('page-size-options') ?? '').split(','));
      if (options.length) this._pageSizeOptions = [...new Set(options)].sort((a, b) => a - b);
    }
    const label = this.getAttribute('aria-label');
    if (label) this._table.setAttribute('aria-label', label);
    else this._table.removeAttribute('aria-label');
    this._clampPage();
  }

  private _render(): void {
    this._renderHeader();
    this._renderBodyAndPagination();
  }

  private _renderHeader(): void {
    const titleRow = document.createElement('tr');
    titleRow.part.add('header-row');

    for (const column of this._columns) {
      const header = document.createElement('th');
      header.scope = 'col';
      header.part.add('header-cell', `header-cell-${partToken(column.key)}`);
      this._applyColumnLayout(header, column);
      const content = document.createElement('div');
      content.className = 'header-content';
      content.style.justifyContent = column.align === 'right' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start';
      if (isSortable(column)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sort-button';
        button.setAttribute('aria-label', `Sort by ${column.title}`);
        const title = document.createElement('span');
        title.className = 'header-title';
        title.textContent = column.title;
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        const direction = this._sort?.key === column.key ? this._sort.direction : null;
        indicator.textContent = direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '◆';
        header.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none');
        button.addEventListener('click', () => this.sortBy(column.key));
        button.append(title, indicator);
        content.append(button);
      } else {
        const title = document.createElement('span');
        title.className = 'header-title';
        title.textContent = column.title;
        content.append(title);
      }
      if (this.showFilters && column.showFilter !== false && isFilterable(column)) content.append(this._createFilterMenu(column));
      header.append(content);
      titleRow.append(header);
    }
    this._head.replaceChildren(titleRow);
  }

  private _createFilterMenu(column: HYTableColumn<T>): HTMLDetailsElement {
    const menu = document.createElement('details');
    menu.className = 'filter-menu';
    menu.part.add('filter-menu');
    const trigger = document.createElement('summary');
    trigger.className = 'filter-trigger';
    trigger.part.add('filter-trigger');
    trigger.setAttribute('aria-label', `Filter ${column.title}`);
    trigger.title = `Filter ${column.title}`;
    trigger.dataset.active = String(Boolean(this._filters[column.key]));
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M2 3h12L9.5 8v4l-3 1V8L2 3Z');
    icon.append(path);
    trigger.append(icon);

    const panel = document.createElement('div');
    panel.className = 'filter-panel';
    panel.part.add('filter-panel');
    let control: HTMLInputElement | HTMLSelectElement;
    if (column.filterOptions) {
      const select = document.createElement('select');
      const all = document.createElement('option');
      all.value = '';
      all.textContent = column.filterPlaceholder ?? 'All';
      select.append(all, ...column.filterOptions.map(option => {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        return element;
      }));
      control = select;
    } else {
      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = column.filterPlaceholder ?? `Filter ${column.title}`;
      control = input;
    }
    control.className = 'filter';
    control.part.add('filter');
    control.setAttribute('aria-label', `Filter ${column.title}`);
    control.value = this._filters[column.key] ?? '';
    const update = (): void => {
      this._updateFilterFromControl(column.key, control.value);
      trigger.dataset.active = String(Boolean(control.value));
      clear.disabled = !control.value;
    };
    control.addEventListener(control instanceof HTMLSelectElement ? 'change' : 'input', update);
    control.addEventListener('keydown', event => {
      if (!(event instanceof KeyboardEvent) || event.key !== 'Escape') return;
      menu.open = false;
      trigger.focus();
    });
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'filter-clear';
    clear.part.add('filter-clear');
    clear.textContent = 'Clear';
    clear.disabled = !control.value;
    clear.addEventListener('click', () => {
      control.value = '';
      update();
      control.focus();
    });
    menu.addEventListener('toggle', () => {
      if (!menu.open) return;
      for (const sibling of this._head.querySelectorAll<HTMLDetailsElement>('.filter-menu[open]')) {
        if (sibling !== menu) sibling.open = false;
      }
      control.focus();
    });
    panel.append(control, clear);
    menu.append(trigger, panel);
    return menu;
  }

  private _updateFilterFromControl(key: string, value: string): void {
    if (value) this._filters[key] = value;
    else delete this._filters[key];
    this._page = 1;
    this._reflectNumber('page', 1);
    this._renderBodyAndPagination();
    this._dispatchChange('filter');
  }

  private _renderBodyAndPagination(): void {
    this._clampPage();
    const rows = this._visibleRecords();
    if (rows.length === 0) {
      const row = document.createElement('tr');
      row.part.add('empty-row');
      const cell = document.createElement('td');
      cell.className = 'empty';
      cell.part.add('empty');
      cell.colSpan = Math.max(1, this._columns.length);
      const slot = document.createElement('slot');
      slot.name = 'empty';
      slot.textContent = 'No data';
      cell.append(slot);
      row.append(cell);
      this._body.replaceChildren(row);
    } else {
      this._body.replaceChildren(...rows.map(item => this._createRow(item)));
    }
    this._renderPagination();
  }

  private _createRow(item: IndexedRecord<T>): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.part.add('row');
    row.dataset.index = String(item.index);
    row.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent<HYTableRowClickDetail<T>>('row-click', {
        bubbles: true, composed: true, detail: { record: item.record, index: item.index },
      }));
    });
    for (const column of this._columns) {
      const cell = document.createElement('td');
      cell.part.add('cell', `cell-${partToken(column.key)}`);
      this._applyColumnLayout(cell, column);
      const value = readValue(item.record, column.dataIndex ?? column.key);
      const content = column.render ? column.render(value, item.record, item.index) : value;
      if (content instanceof Node) cell.append(content);
      else cell.textContent = content == null ? '' : String(content);
      row.append(cell);
    }
    return row;
  }

  private _renderPagination(): void {
    if (!this.pagination) {
      this._pagination.hidden = true;
      this._pagination.replaceChildren();
      return;
    }
    this._pagination.hidden = false;
    const processed = this._processedRecords();
    const pageCount = Math.max(1, Math.ceil(processed.length / this._pageSize));
    const summary = document.createElement('span');
    summary.className = 'summary';
    summary.part.add('summary');
    const start = processed.length ? (this._page - 1) * this._pageSize + 1 : 0;
    const end = Math.min(processed.length, this._page * this._pageSize);
    summary.textContent = `${start}–${end} of ${processed.length}`;
    const previous = this._pageButton('‹', 'Previous page', this._page - 1, this._page <= 1);
    const pages = this._pageNumbers(pageCount).map(page => this._pageButton(String(page), `Page ${page}`, page, false, page === this._page));
    const next = this._pageButton('›', 'Next page', this._page + 1, this._page >= pageCount);
    const pageSize = document.createElement('select');
    pageSize.part.add('page-size');
    pageSize.setAttribute('aria-label', 'Rows per page');
    const options = this._pageSizeOptions.includes(this._pageSize)
      ? this._pageSizeOptions
      : [...this._pageSizeOptions, this._pageSize].sort((a, b) => a - b);
    pageSize.append(...options.map(value => {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = `${value} / page`;
      option.selected = value === this._pageSize;
      return option;
    }));
    pageSize.addEventListener('change', () => { this.pageSize = Number(pageSize.value); });
    this._pagination.replaceChildren(summary, previous, ...pages, next, pageSize);
  }

  private _pageButton(text: string, label: string, page: number, disabled: boolean, current = false): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.disabled = disabled;
    button.setAttribute('aria-label', label);
    if (current) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => this.goToPage(page));
    return button;
  }

  private _pageNumbers(pageCount: number): number[] {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
    const start = Math.max(1, Math.min(pageCount - 4, this._page - 2));
    return Array.from({ length: 5 }, (_, index) => start + index);
  }

  private _processedRecords(): IndexedRecord<T>[] {
    let records = this._dataSource.map((record, index) => ({ record, index }));
    for (const [key, filterValue] of Object.entries(this._filters)) {
      const column = this._columns.find(item => item.key === key);
      if (!column || !filterValue) continue;
      const normalized = filterValue.toLocaleLowerCase();
      records = records.filter(item => {
        if (column.filter) return column.filter(filterValue, item.record);
        const value = String(readValue(item.record, column.dataIndex ?? column.key) ?? '');
        return column.filterOptions
          ? value === filterValue
          : value.toLocaleLowerCase().includes(normalized);
      });
    }
    if (this._sort) {
      const column = this._columns.find(item => item.key === this._sort?.key);
      if (column) {
        const direction = this._sort.direction === 'asc' ? 1 : -1;
        records.sort((left, right) => {
          const compared = column.sorter
            ? column.sorter(left.record, right.record)
            : defaultCompare(
              readValue(left.record, column.dataIndex ?? column.key),
              readValue(right.record, column.dataIndex ?? column.key),
            );
          return compared === 0 ? left.index - right.index : compared * direction;
        });
      }
    }
    return records;
  }

  private _visibleRecords(): IndexedRecord<T>[] {
    const records = this._processedRecords();
    if (!this.pagination) return records;
    const start = (this._page - 1) * this._pageSize;
    return records.slice(start, start + this._pageSize);
  }

  private _clampPage(): void {
    const total = this._processedRecords().length;
    const pageCount = this.pagination ? Math.max(1, Math.ceil(total / this._pageSize)) : 1;
    const next = Math.min(pageCount, Math.max(1, this._page));
    if (next !== this._page) {
      this._page = next;
      this._reflectNumber('page', next);
    }
  }

  private _applyColumnLayout(element: HTMLElement, column: HYTableColumn<T>): void {
    element.style.textAlign = column.align ?? 'left';
    if (typeof column.width === 'number') element.style.width = `${column.width}px`;
    else if (column.width) element.style.width = column.width;
  }

  private _reflectNumber(name: 'page' | 'page-size', value: number): void {
    const text = String(value);
    if (this.getAttribute(name) === text) return;
    this._reflecting = true;
    this.setAttribute(name, text);
    this._reflecting = false;
  }

  private _dispatchChange(reason: HYTableChangeReason): void {
    const processed = this._processedRecords();
    const detail: HYTableChangeDetail<T> = {
      reason,
      page: this._page,
      pageSize: this._pageSize,
      pageCount: this.pagination ? Math.max(1, Math.ceil(processed.length / this._pageSize)) : 1,
      total: this._dataSource.length,
      filteredTotal: processed.length,
      sort: this.sort,
      filters: this.filters,
      visibleData: this.visibleData,
    };
    this.dispatchEvent(new CustomEvent<HYTableChangeDetail<T>>('table-change', {
      bubbles: true, composed: true, detail,
    }));
  }
}

export function defineTableComponents(): void {
  if (!customElements.get('hy-table')) customElements.define('hy-table', HYTable);
}
