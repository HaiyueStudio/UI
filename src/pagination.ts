export interface HYPaginationChangeDetail { page: number; pageSize: number; total: number; source: 'page' | 'size' | 'jump'; }
export class HYPagination extends HTMLElement {
  private readonly _nav = document.createElement('nav');
  private readonly _previous = document.createElement('button');
  private readonly _next = document.createElement('button');
  private readonly _pages = document.createElement('span');
  private readonly _summary = document.createElement('span');
  private readonly _size = document.createElement('select');
  private readonly _jump = document.createElement('input');
  private readonly _jumpLabel = document.createElement('label');
  private _reflecting = false;
  static get observedAttributes(): string[] { return ['page', 'page-size', 'total', 'page-size-options', 'disabled', 'simple', 'show-size-changer', 'show-quick-jumper', 'show-total', 'hide-on-single-page', 'size', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      nav, .pages { display: flex; align-items: center; flex-wrap: wrap; gap: var(--hy-space-2, 4px); } .pages { display: inline-flex; }
      button, select, input { box-sizing: border-box; min-height: var(--hy-control-height-sm, 28px); min-width: 28px; padding: 2px 7px; border: 1px solid var(--hy-border-color, #303746); border-radius: var(--hy-radius-sm, 4px); color: inherit; background: var(--hy-surface-color, #121822); font: inherit; }
      button { cursor: pointer; } button:hover:not(:disabled) { background: var(--hy-hover-bg-color, #273241); } button[aria-current="page"] { border-color: var(--hy-accent-color, #8177f2); color: var(--hy-accent-color, #8177f2); }
      button:disabled, select:disabled, input:disabled { opacity: .5; cursor: not-allowed; } :is(button,select,input):focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 1px; }
      label { display: inline-flex; align-items: center; gap: 4px; } input { width: 62px; } .summary { margin-inline-end: 4px; color: var(--hy-muted-text-color, #8290a3); }
      :host([size="small"]) :is(button,select,input) { min-height: 22px; padding: 0 5px; } [hidden] { display: none !important; }
    `;
    this._previous.type = this._next.type = 'button'; this._previous.textContent = '‹'; this._next.textContent = '›';
    this._previous.setAttribute('aria-label', 'Previous page'); this._next.setAttribute('aria-label', 'Next page');
    this._previous.part.add('previous'); this._next.part.add('next'); this._pages.className = 'pages'; this._pages.part.add('pages');
    this._summary.className = 'summary'; this._summary.part.add('total'); this._size.part.add('page-size'); this._size.setAttribute('aria-label', 'Items per page');
    this._jump.type = 'number'; this._jump.min = '1'; this._jump.part.add('jumper'); this._jump.setAttribute('aria-label', 'Go to page'); this._jumpLabel.append('Go to', this._jump);
    this._nav.part.add('nav'); this._nav.append(this._summary, this._previous, this._pages, this._next, this._size, this._jumpLabel); root.append(style, this._nav);
    this._previous.addEventListener('click', () => this._change(this.page - 1, this.pageSize, 'page'));
    this._next.addEventListener('click', () => this._change(this.page + 1, this.pageSize, 'page'));
    this._pages.addEventListener('click', event => { const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-page]') : null; if (button) this._change(Number(button.dataset.page), this.pageSize, 'page'); });
    this._pages.addEventListener('keydown', this._onKeydown);
    this._size.addEventListener('change', () => this._change(Math.ceil(((this.page - 1) * this.pageSize + 1) / Number(this._size.value)), Number(this._size.value), 'size'));
    this._jump.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); event.stopPropagation(); this._change(Number(this._jump.value), this.pageSize, 'jump'); } });
  }
  connectedCallback(): void { this._sync(); }
  attributeChangedCallback(): void { if (!this._reflecting) this._sync(); }
  get page(): number { return Math.min(this.pageCount, integer(this.getAttribute('page'), 1, 1)); }
  set page(value: number) { this.setAttribute('page', String(value)); }
  get pageSize(): number { return integer(this.getAttribute('page-size'), 10, 1); }
  set pageSize(value: number) { this.setAttribute('page-size', String(value)); }
  get total(): number { return integer(this.getAttribute('total'), 0, 0); }
  set total(value: number) { this.setAttribute('total', String(value)); }
  get pageCount(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', value); }
  get simple(): boolean { return this.hasAttribute('simple'); }
  set simple(value: boolean) { this.toggleAttribute('simple', value); }
  get showSizeChanger(): boolean { return this.hasAttribute('show-size-changer'); }
  set showSizeChanger(value: boolean) { this.toggleAttribute('show-size-changer', value); }
  get showQuickJumper(): boolean { return this.hasAttribute('show-quick-jumper'); }
  set showQuickJumper(value: boolean) { this.toggleAttribute('show-quick-jumper', value); }
  get pageSizeOptions(): number[] { const values = (this.getAttribute('page-size-options') ?? '10,20,50,100').replace(/[\[\]]/gu, '').split(',').map(Number).filter(value => Number.isSafeInteger(value) && value > 0); return [...new Set(values)].sort((a, b) => a - b); }
  set pageSizeOptions(value: number[]) { this.setAttribute('page-size-options', value.join(',')); }
  private _sync(): void {
    const page = this.page; this._reflecting = true;
    if (this.hasAttribute('page')) this.setAttribute('page', String(page));
    if (this.hasAttribute('page-size')) this.setAttribute('page-size', String(this.pageSize));
    this._reflecting = false;
    this._nav.hidden = this.hasAttribute('hide-on-single-page') && this.pageCount === 1;
    this._nav.setAttribute('aria-label', this.getAttribute('aria-label') || 'Pagination');
    this._previous.disabled = this.disabled || page <= 1; this._next.disabled = this.disabled || page >= this.pageCount;
    const focusedPage = (this.shadowRoot?.activeElement as HTMLElement | null)?.dataset.page;
    const fragment = document.createDocumentFragment();
    if (this.simple) fragment.append(`${page} / ${this.pageCount}`);
    else {
      const pages = [...new Set([1, this.pageCount, ...Array.from({ length: 5 }, (_, index) => page - 2 + index).filter(value => value > 0 && value <= this.pageCount)])].sort((a, b) => a - b);
      let previous = 0;
      for (const value of pages) {
        if (previous && value - previous > 1) { const gap = document.createElement('span'); gap.textContent = '…'; gap.setAttribute('aria-hidden', 'true'); fragment.append(gap); }
        const button = document.createElement('button'); button.type = 'button'; button.dataset.page = String(value); button.part.add('page'); button.textContent = String(value); button.disabled = this.disabled; button.setAttribute('aria-label', `Page ${value}`);
        if (page === value) button.setAttribute('aria-current', 'page'); fragment.append(button); previous = value;
      }
    }
    this._pages.replaceChildren(fragment);
    if (focusedPage) this._pages.querySelector<HTMLButtonElement>(`button[data-page="${page}"]`)?.focus({ preventScroll: true });
    this._summary.textContent = `${this.total ? (page - 1) * this.pageSize + 1 : 0}–${Math.min(page * this.pageSize, this.total)} / ${this.total}`;
    this._summary.hidden = this.getAttribute('show-total') === 'false';
    const options = [...new Set([...this.pageSizeOptions, this.pageSize])].sort((a, b) => a - b);
    if ([...this._size.options].map(option => Number(option.value)).join(',') !== options.join(',')) this._size.replaceChildren(...options.map(value => { const option = document.createElement('option'); option.value = String(value); option.textContent = `${value} / page`; return option; }));
    this._size.value = String(this.pageSize); this._size.disabled = this.disabled; this._size.hidden = !this.showSizeChanger;
    this._jump.disabled = this.disabled; this._jump.max = String(this.pageCount); this._jump.value = String(page); this._jumpLabel.hidden = !this.showQuickJumper;
  }
  private _change(page: number, size: number, source: HYPaginationChangeDetail['source']): void {
    if (this.disabled) return;
    size = integer(String(size), this.pageSize, 1); page = Math.min(Math.max(1, integer(String(page), this.page, 1)), Math.max(1, Math.ceil(this.total / size)));
    if (page === this.page && size === this.pageSize) { this._sync(); return; }
    this._reflecting = true; this.setAttribute('page-size', String(size)); this.setAttribute('page', String(page)); this._reflecting = false; this._sync();
    this.dispatchEvent(new CustomEvent<HYPaginationChangeDetail>('page-change', { detail: { page, pageSize: size, total: this.total, source }, bubbles: true, composed: true }));
  }
  private _onKeydown = (event: KeyboardEvent): void => {
    if (!(event.target instanceof HTMLButtonElement) || this.disabled) return;
    const rtl = getComputedStyle(this).direction === 'rtl'; let page: number;
    if (event.key === 'ArrowRight') page = this.page + (rtl ? -1 : 1); else if (event.key === 'ArrowLeft') page = this.page + (rtl ? 1 : -1); else if (event.key === 'Home') page = 1; else if (event.key === 'End') page = this.pageCount; else return;
    event.preventDefault(); this._change(page, this.pageSize, 'page');
  };
}
function integer(raw: string | null, fallback: number, min: number): number { const value = raw === null ? NaN : Number(raw); return Number.isFinite(value) ? Math.max(min, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : fallback; }
export function definePaginationComponents(): void { if (!customElements.get('hy-pagination')) customElements.define('hy-pagination', HYPagination); }
