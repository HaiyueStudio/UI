import { HYPaginationControls, HY_PAGINATION_STYLES } from './internal/pagination.js';

export interface HYPaginationChangeDetail { page: number; pageSize: number; total: number; source: 'page' | 'size' | 'jump'; }
export class HYPagination extends HTMLElement {
  private readonly _controls = new HYPaginationControls((page, pageSize, source) => this._change(page, pageSize, source));
  private _reflecting = false;
  static get observedAttributes(): string[] { return ['page', 'page-size', 'total', 'page-size-options', 'disabled', 'simple', 'show-size-changer', 'show-quick-jumper', 'show-total', 'hide-on-single-page', 'size', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      ${HY_PAGINATION_STYLES}
      :host([size="small"]) .pagination-controls :is(button,select,input) { min-height: 22px; padding: 0 5px; }
    `;
    root.append(style, this._controls.element);
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
    this._controls.update({
      page, pageSize: this.pageSize, total: this.total, pageSizeOptions: this.pageSizeOptions,
      label: this.getAttribute('aria-label') || 'Pagination',
      hidden: this.hasAttribute('hide-on-single-page') && this.pageCount === 1,
      disabled: this.disabled, simple: this.simple, showTotal: this.getAttribute('show-total') !== 'false',
      showSizeChanger: this.showSizeChanger, showQuickJumper: this.showQuickJumper,
    });
  }
  private _change(page: number, size: number, source: HYPaginationChangeDetail['source']): void {
    if (this.disabled) return;
    size = integer(String(size), this.pageSize, 1); page = Math.min(Math.max(1, integer(String(page), this.page, 1)), Math.max(1, Math.ceil(this.total / size)));
    if (page === this.page && size === this.pageSize) { this._sync(); return; }
    this._reflecting = true; this.setAttribute('page-size', String(size)); this.setAttribute('page', String(page)); this._reflecting = false; this._sync();
    this.dispatchEvent(new CustomEvent<HYPaginationChangeDetail>('page-change', { detail: { page, pageSize: size, total: this.total, source }, bubbles: true, composed: true }));
  }
}
function integer(raw: string | null, fallback: number, min: number): number { const value = raw === null ? NaN : Number(raw); return Number.isFinite(value) ? Math.max(min, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : fallback; }
export function definePaginationComponents(): void { if (!customElements.get('hy-pagination')) customElements.define('hy-pagination', HYPagination); }
