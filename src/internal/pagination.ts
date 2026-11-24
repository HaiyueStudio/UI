type HYPaginationSource = 'page' | 'size' | 'jump';

interface HYPaginationState {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions: readonly number[];
  label?: string;
  hidden?: boolean;
  disabled?: boolean;
  simple?: boolean;
  showTotal?: boolean;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
}

export const HY_PAGINATION_STYLES = `
  .pagination-controls, .pagination-controls .pages { display: flex; align-items: center; flex-wrap: wrap; gap: var(--hy-space-2, 4px); }
  .pagination-controls .pages { display: inline-flex; }
  .pagination-controls :is(button, select, input) {
    box-sizing: border-box; min-height: var(--hy-control-height-sm, 28px); min-width: 28px;
    padding: 2px 7px; border: 1px solid var(--hy-border-color, #303746); border-radius: var(--hy-radius-sm, 4px);
    color: inherit; background: var(--hy-surface-color, #121822); font: inherit;
  }
  .pagination-controls button { cursor: pointer; }
  .pagination-controls button:hover:not(:disabled) { background: var(--hy-hover-bg-color, #273241); }
  .pagination-controls button[aria-current="page"] { border-color: var(--hy-accent-color, #8177f2); color: var(--hy-accent-color, #8177f2); }
  .pagination-controls :is(button, select, input):disabled { opacity: .5; cursor: not-allowed; }
  .pagination-controls :is(button, select, input):focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 1px; }
  .pagination-controls label { display: inline-flex; align-items: center; gap: 4px; }
  .pagination-controls input { width: 62px; }
  .pagination-controls .summary { margin-inline-end: 4px; color: var(--hy-muted-text-color, var(--hy-muted-color, #8290a3)); }
  .pagination-controls[hidden], .pagination-controls [hidden] { display: none !important; }
`;

/** Shared native controls. The owning component validates state and emits its public events. */
export class HYPaginationControls {
  readonly element = document.createElement('nav');
  private readonly _previous = document.createElement('button');
  private readonly _next = document.createElement('button');
  private readonly _pages = document.createElement('span');
  private readonly _summary = document.createElement('span');
  private readonly _size = document.createElement('select');
  private readonly _jump = document.createElement('input');
  private readonly _jumpLabel = document.createElement('label');
  private _state: HYPaginationState = { page: 1, pageSize: 10, total: 0, pageSizeOptions: [] };

  constructor(
    private readonly _onChange: (page: number, pageSize: number, source: HYPaginationSource) => void,
    private readonly _variant: 'pagination' | 'table' = 'pagination',
  ) {
    this.element.className = 'pagination-controls';
    this.element.part.add(_variant === 'table' ? 'pagination' : 'nav');
    this._previous.type = this._next.type = 'button';
    this._previous.textContent = '‹'; this._next.textContent = '›';
    this._previous.setAttribute('aria-label', 'Previous page'); this._next.setAttribute('aria-label', 'Next page');
    this._previous.part.add('previous'); this._next.part.add('next');
    this._pages.className = 'pages'; this._pages.part.add('pages');
    this._summary.className = 'summary'; this._summary.part.add(_variant === 'table' ? 'summary' : 'total');
    this._size.part.add('page-size'); this._size.setAttribute('aria-label', _variant === 'table' ? 'Rows per page' : 'Items per page');
    this._jump.type = 'number'; this._jump.min = '1'; this._jump.part.add('jumper'); this._jump.setAttribute('aria-label', 'Go to page');
    this._jumpLabel.append('Go to', this._jump);
    this.element.append(this._summary, this._previous, this._pages, this._next, this._size, this._jumpLabel);

    this._previous.addEventListener('click', () => this._request(this._state.page - 1, this._state.pageSize, 'page'));
    this._next.addEventListener('click', () => this._request(this._state.page + 1, this._state.pageSize, 'page'));
    this._pages.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-page]') : null;
      if (button) this._request(Number(button.dataset.page), this._state.pageSize, 'page');
    });
    this._pages.addEventListener('keydown', this._onKeydown);
    this._size.addEventListener('change', () => {
      const size = Number(this._size.value);
      this._request(Math.ceil(((this._state.page - 1) * this._state.pageSize + 1) / size), size, 'size');
    });
    this._jump.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault(); event.stopPropagation();
        this._request(Number(this._jump.value), this._state.pageSize, 'jump');
      }
    });
  }

  update(state: HYPaginationState): void {
    this._state = state;
    const { page, pageSize, total, disabled = false } = state;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    this.element.hidden = Boolean(state.hidden);
    this.element.setAttribute('aria-label', state.label || 'Pagination');
    this._previous.disabled = disabled || page <= 1;
    this._next.disabled = disabled || page >= pageCount;
    const root = this.element.getRootNode();
    const focusedPage = this._pages.contains(root instanceof ShadowRoot ? root.activeElement : this.element.ownerDocument.activeElement);
    const fragment = document.createDocumentFragment();
    if (state.simple) fragment.append(`${page} / ${pageCount}`);
    else {
      let previous = 0;
      for (const value of this._pageNumbers(pageCount)) {
        if (this._variant === 'pagination' && previous && value - previous > 1) {
          const gap = document.createElement('span'); gap.textContent = '…'; gap.setAttribute('aria-hidden', 'true'); fragment.append(gap);
        }
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.page = String(value); button.part.add('page');
        button.textContent = String(value); button.disabled = disabled; button.setAttribute('aria-label', `Page ${value}`);
        if (page === value) button.setAttribute('aria-current', 'page');
        fragment.append(button); previous = value;
      }
    }
    this._pages.replaceChildren(fragment);
    if (focusedPage) this._pages.querySelector<HTMLButtonElement>(`button[data-page="${page}"]`)?.focus({ preventScroll: true });
    const start = total ? (page - 1) * pageSize + 1 : 0;
    const end = Math.min(page * pageSize, total);
    this._summary.textContent = this._variant === 'table' ? `${start}–${end} of ${total}` : `${start}–${end} / ${total}`;
    this._summary.hidden = state.showTotal === false;
    const options = [...new Set([...state.pageSizeOptions, pageSize])].sort((a, b) => a - b);
    if ([...this._size.options].map(option => Number(option.value)).join(',') !== options.join(',')) {
      this._size.replaceChildren(...options.map(value => {
        const option = document.createElement('option'); option.value = String(value); option.textContent = `${value} / page`; return option;
      }));
    }
    this._size.value = String(pageSize); this._size.disabled = disabled; this._size.hidden = !state.showSizeChanger;
    this._jump.disabled = disabled; this._jump.max = String(pageCount); this._jump.value = String(page); this._jumpLabel.hidden = !state.showQuickJumper;
  }

  private _pageNumbers(pageCount: number): number[] {
    const page = this._state.page;
    if (this._variant === 'table') {
      if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
      const start = Math.max(1, Math.min(pageCount - 4, page - 2));
      return Array.from({ length: 5 }, (_, index) => start + index);
    }
    return [...new Set([1, pageCount, ...Array.from({ length: 5 }, (_, index) => page - 2 + index)
      .filter(value => value > 0 && value <= pageCount)])].sort((a, b) => a - b);
  }

  private _request(page: number, pageSize: number, source: HYPaginationSource): void {
    if (!this._state.disabled && !this._state.hidden) this._onChange(page, pageSize, source);
  }

  private _onKeydown = (event: KeyboardEvent): void => {
    if (!(event.target instanceof HTMLButtonElement) || this._state.disabled) return;
    const rtl = getComputedStyle(this.element).direction === 'rtl';
    let page: number;
    if (event.key === 'ArrowRight') page = this._state.page + (rtl ? -1 : 1);
    else if (event.key === 'ArrowLeft') page = this._state.page + (rtl ? 1 : -1);
    else if (event.key === 'Home') page = 1;
    else if (event.key === 'End') page = Math.max(1, Math.ceil(this._state.total / this._state.pageSize));
    else return;
    event.preventDefault(); this._request(page, this._state.pageSize, 'page');
  };
}
