export type HYTourPlacement = 'top' | 'right' | 'bottom' | 'left' | 'center';
export type HYTourCloseReason = 'close' | 'mask' | 'escape' | 'finish' | 'programmatic';
export type HYTourTarget = string | Element | (() => Element | null);

export interface HYTourStep {
  readonly target?: HYTourTarget;
  readonly title: string;
  readonly description?: string;
  readonly placement?: HYTourPlacement;
  readonly nextText?: string;
  readonly previousText?: string;
  readonly mask?: boolean;
}

export interface HYTourChangeDetail { readonly current: number; readonly previous: number; readonly step: HYTourStep; }
export interface HYTourCloseDetail { readonly current: number; readonly reason: HYTourCloseReason; }
export interface HYTourOpenChangeDetail { readonly open: boolean; }
export interface HYTourFinishDetail { readonly current: number; readonly step: HYTourStep; }

function normalizeSteps(value: unknown): HYTourStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(step => {
    if (!step || typeof step !== 'object') return [];
    const record = step as Record<string, unknown>; if (record.title == null) return [];
    const placement = ['top', 'right', 'bottom', 'left', 'center'].includes(String(record.placement)) ? String(record.placement) as HYTourPlacement : undefined;
    return [{
      title: String(record.title),
      ...(record.description != null ? { description: String(record.description) } : {}),
      ...(typeof record.target === 'string' ? { target: record.target } : {}),
      ...(placement ? { placement } : {}),
      ...(record.nextText != null ? { nextText: String(record.nextText) } : {}),
      ...(record.previousText != null ? { previousText: String(record.previousText) } : {}),
      ...(typeof record.mask === 'boolean' ? { mask: record.mask } : {}),
    }];
  });
}

/** Multi-step spotlight tour for introducing controls and workflows. */
export class HYTour extends HTMLElement {
  private readonly _masks = [document.createElement('div'), document.createElement('div'), document.createElement('div'), document.createElement('div')];
  private readonly _highlight = document.createElement('div');
  private readonly _popover = document.createElement('section');
  private readonly _title = document.createElement('h2');
  private readonly _description = document.createElement('div');
  private readonly _counter = document.createElement('span');
  private readonly _previous = document.createElement('button');
  private readonly _next = document.createElement('button');
  private readonly _close = document.createElement('button');
  private _steps: readonly HYTourStep[] = [];
  private _stepsAssigned = false;
  private _current = 0;
  private _documentAbort: AbortController | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _target: Element | null = null;
  private _returnFocus: HTMLElement | null = null;
  private _scrolledStep = -1;
  private _frame = 0;

  static get observedAttributes(): string[] { return ['steps', 'open', 'current', 'placement', 'mask', 'close-on-mask', 'close-on-escape', 'scroll-into-view', 'gap', 'z-index']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style'); const header = document.createElement('header'); const footer = document.createElement('footer');
    style.textContent = `
      :host { position: fixed; z-index: var(--_hy-tour-z-index, 1000); inset: 0; display: block; visibility: hidden; pointer-events: none; color: var(--hy-text-color, #eef3ff); font: 12px/1.5 system-ui, sans-serif; }
      :host([open]) { visibility: visible; }
      .mask { position: absolute; background: var(--hy-tour-mask-color, rgba(3, 7, 18, .68)); pointer-events: auto; }
      .mask[hidden], .highlight[hidden] { display: none; }
      .highlight { position: absolute; box-sizing: border-box; border: 1px solid var(--hy-tour-highlight-color, var(--hy-accent-color, #79a8ff)); border-radius: var(--hy-tour-highlight-radius, 8px); box-shadow: 0 0 0 3px var(--hy-focus-ring-color, rgba(121, 168, 255, .22)); pointer-events: none; }
      .popover { position: absolute; width: min(var(--hy-tour-width, 310px), calc(100vw - 24px)); box-sizing: border-box; padding: 15px; border: 1px solid var(--hy-border-color, #3d4654); border-radius: var(--hy-tour-radius, 10px); outline: none; background: var(--hy-surface-elevated-color, #171d27); box-shadow: 0 18px 48px var(--hy-menu-shadow-color, rgba(0, 0, 0, .4)); pointer-events: auto; }
      header { display: flex; align-items: flex-start; gap: 12px; }
      h2 { flex: 1; margin: 0; color: var(--hy-text-color, #eef3ff); font: 650 14px/1.4 system-ui, sans-serif; }
      .close { width: 24px; height: 24px; padding: 0; border: 0; border-radius: 4px; color: var(--hy-muted-color, #788697); background: transparent; cursor: pointer; font: 17px/1 system-ui, sans-serif; }
      .close:hover { color: var(--hy-text-color, #eef3ff); background: var(--hy-hover-bg-color, #273241); }
      .description { margin-top: 8px; color: var(--hy-secondary-text-color, #aebbd0); }
      footer { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
      .counter { flex: 1; color: var(--hy-muted-color, #788697); font: 10px/1 ui-monospace, monospace; }
      footer button { min-width: 58px; height: 29px; padding: 0 10px; border: 1px solid var(--hy-border-color, #3d4654); border-radius: 5px; color: var(--hy-secondary-text-color, #aebbd0); background: transparent; cursor: pointer; font: inherit; }
      footer button:hover:not(:disabled) { color: var(--hy-text-color, #eef3ff); border-color: var(--hy-hover-border-color, #596779); background: var(--hy-hover-bg-color, #273241); }
      footer .next { color: var(--hy-selected-text-color, #fff); border-color: var(--hy-selected-bg-color, #554cc6); background: var(--hy-selected-bg-color, #554cc6); }
      footer button:disabled { visibility: hidden; }
      button:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 1px; }
    `;
    this._masks.forEach(mask => { mask.className = 'mask'; mask.part.add('mask'); mask.addEventListener('click', () => { if (this.closeOnMask) this.close('mask'); }); });
    this._highlight.className = 'highlight'; this._highlight.part.add('highlight');
    this._popover.className = 'popover'; this._popover.part.add('popover'); this._popover.tabIndex = -1; this._popover.setAttribute('role', 'dialog');
    this._title.part.add('title'); this._description.className = 'description'; this._description.part.add('description'); this._counter.className = 'counter'; this._counter.part.add('counter');
    this._close.type = 'button'; this._close.className = 'close'; this._close.part.add('close'); this._close.setAttribute('aria-label', 'Close tour'); this._close.textContent = '×'; this._close.addEventListener('click', () => this.close('close')); header.append(this._title, this._close);
    this._previous.type = this._next.type = 'button'; this._previous.className = 'previous'; this._previous.part.add('previous'); this._next.className = 'next'; this._next.part.add('next'); this._previous.addEventListener('click', () => this.previous()); this._next.addEventListener('click', () => this.next()); footer.append(this._counter, this._previous, this._next);
    this._popover.append(header, this._description, footer); root.append(style, ...this._masks, this._highlight, this._popover);
  }

  connectedCallback(): void { if (!this._stepsAssigned && this.hasAttribute('steps')) this._readStepsAttribute(); this._current = Math.max(0, Number(this.getAttribute('current')) || 0); this._syncOpen(); }
  disconnectedCallback(): void { this._teardown(); }
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return; if (name === 'steps' && !this._stepsAssigned) this._readStepsAttribute(); if (name === 'current') this._current = Math.max(0, Number(newValue) || 0);
    if (name === 'open') this._syncOpen(); else if (this.open) this._renderStep();
  }

  get steps(): readonly HYTourStep[] { return this._steps; }
  set steps(value: readonly HYTourStep[]) { this._stepsAssigned = true; this._steps = Array.isArray(value) ? value.filter(step => step && typeof step.title === 'string') : []; if (this.open) this._renderStep(); }
  get open(): boolean { return this.hasAttribute('open'); }
  set open(value: boolean) { this.toggleAttribute('open', Boolean(value)); }
  get current(): number { return this._resolvedCurrent(); }
  set current(value: number) { this._current = Math.max(0, Math.floor(Number(value) || 0)); this.setAttribute('current', String(this._current)); }
  get placement(): HYTourPlacement { const value = this.getAttribute('placement'); return ['top', 'right', 'left', 'center'].includes(String(value)) ? value as HYTourPlacement : 'bottom'; }
  set placement(value: HYTourPlacement) { this.setAttribute('placement', ['top', 'right', 'bottom', 'left', 'center'].includes(value) ? value : 'bottom'); }
  get mask(): boolean { return this.getAttribute('mask') !== 'false'; }
  set mask(value: boolean) { this.setAttribute('mask', String(Boolean(value))); }
  get closeOnMask(): boolean { return this.hasAttribute('close-on-mask'); }
  set closeOnMask(value: boolean) { this.toggleAttribute('close-on-mask', Boolean(value)); }
  get closeOnEscape(): boolean { return this.getAttribute('close-on-escape') !== 'false'; }
  set closeOnEscape(value: boolean) { this.setAttribute('close-on-escape', String(Boolean(value))); }
  get autoScroll(): boolean { return this.getAttribute('scroll-into-view') !== 'false'; }
  set autoScroll(value: boolean) { this.setAttribute('scroll-into-view', String(Boolean(value))); }
  get gap(): number { const number = Number(this.getAttribute('gap')); return Number.isFinite(number) ? Math.min(80, Math.max(0, number)) : 8; }
  set gap(value: number) { const number = Number(value); this.setAttribute('gap', String(Number.isFinite(number) ? Math.min(80, Math.max(0, number)) : 8)); }
  get zIndex(): number { const number = Number(this.getAttribute('z-index')); return Number.isFinite(number) ? Math.round(number) : 1000; }
  set zIndex(value: number) { this.setAttribute('z-index', String(Math.round(Number(value) || 1000))); }

  start(current = 0): void { if (!this._steps.length) return; this.current = current; this.open = true; }
  next(): void {
    if (!this._steps.length) return; if (this.current >= this._steps.length - 1) { const step = this._steps[this.current]!; this.dispatchEvent(new CustomEvent<HYTourFinishDetail>('tour-finish', { bubbles: true, composed: true, detail: { current: this.current, step } })); this.close('finish'); return; } this._goTo(this.current + 1);
  }
  previous(): void { if (this.current > 0) this._goTo(this.current - 1); }
  close(reason: HYTourCloseReason = 'programmatic'): void { if (!this.open) return; const current = this.current; this.open = false; this.dispatchEvent(new CustomEvent<HYTourCloseDetail>('tour-close', { bubbles: true, composed: true, detail: { current, reason } })); }

  private _readStepsAttribute(): void { try { this._steps = normalizeSteps(JSON.parse(this.getAttribute('steps') ?? '[]')); } catch { this._steps = []; } }
  private _resolvedCurrent(): number { return this._steps.length ? Math.min(this._steps.length - 1, this._current) : 0; }
  private _goTo(current: number): void { const previous = this.current; this.current = current; const step = this._steps[this.current]; if (step) this.dispatchEvent(new CustomEvent<HYTourChangeDetail>('tour-change', { bubbles: true, composed: true, detail: { current: this.current, previous, step } })); }
  private _syncOpen(): void {
    if (!this.isConnected) return; this.style.setProperty('--_hy-tour-z-index', String(this.zIndex));
    if (!this.open || !this._steps.length) { this._teardown(); this._returnFocus?.focus({ preventScroll: true }); this._returnFocus = null; this.dispatchEvent(new CustomEvent<HYTourOpenChangeDetail>('tour-open-change', { bubbles: true, composed: true, detail: { open: false } })); return; }
    if (!this._documentAbort) { this._returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; const abort = new AbortController(); this._documentAbort = abort; document.addEventListener('keydown', event => { if (event.key === 'Escape' && this.closeOnEscape) { event.preventDefault(); this.close('escape'); } }, { signal: abort.signal }); window.addEventListener('resize', () => this._schedulePosition(), { passive: true, signal: abort.signal }); window.addEventListener('scroll', () => this._schedulePosition(), { passive: true, capture: true, signal: abort.signal }); this.dispatchEvent(new CustomEvent<HYTourOpenChangeDetail>('tour-open-change', { bubbles: true, composed: true, detail: { open: true } })); }
    this._renderStep();
  }
  private _teardown(): void { this._documentAbort?.abort(); this._documentAbort = null; this._resizeObserver?.disconnect(); this._resizeObserver = null; cancelAnimationFrame(this._frame); this._frame = 0; this._target = null; this._scrolledStep = -1; }
  private _renderStep(): void {
    const step = this._steps[this.current]; if (!step) return; this._title.textContent = step.title; this._description.textContent = step.description ?? ''; this._description.hidden = !step.description; this._counter.textContent = `${this.current + 1} / ${this._steps.length}`; this._previous.textContent = step.previousText ?? 'Previous'; this._previous.disabled = this.current === 0; this._next.textContent = step.nextText ?? (this.current === this._steps.length - 1 ? 'Finish' : 'Next'); this._popover.setAttribute('aria-label', step.title);
    this.style.setProperty('--_hy-tour-z-index', String(this.zIndex));
    this._target = this._resolveTarget(step.target); if (this._target && this.autoScroll && this._scrolledStep !== this.current) { this._target.scrollIntoView({ block: 'center', inline: 'center' }); this._scrolledStep = this.current; }
    this._resizeObserver?.disconnect(); if (typeof ResizeObserver !== 'undefined') { this._resizeObserver = new ResizeObserver(() => this._schedulePosition()); this._resizeObserver.observe(this._popover); if (this._target instanceof Element) this._resizeObserver.observe(this._target); }
    this._schedulePosition(); queueMicrotask(() => this._popover.focus({ preventScroll: true }));
  }
  private _resolveTarget(target: HYTourTarget | undefined): Element | null { if (typeof target === 'function') return target(); if (typeof target === 'string') { try { return document.querySelector(target); } catch { return null; } } return target instanceof Element ? target : null; }
  private _schedulePosition(): void { cancelAnimationFrame(this._frame); this._frame = requestAnimationFrame(() => this._position()); }
  private _position(): void {
    if (!this.open) return; const step = this._steps[this.current]; if (!step) return; const viewportWidth = window.innerWidth; const viewportHeight = window.innerHeight; const margin = 12; const gap = this.gap; const mask = step.mask ?? this.mask;
    this._popover.setAttribute('aria-modal', String(mask));
    if (!this._target) { this._masks.forEach(piece => { piece.hidden = !mask; piece.style.cssText = mask ? 'inset:0' : ''; }); this._highlight.hidden = true; const rect = this._popover.getBoundingClientRect(); this._popover.style.left = `${Math.max(margin, (viewportWidth - rect.width) / 2)}px`; this._popover.style.top = `${Math.max(margin, (viewportHeight - rect.height) / 2)}px`; this._popover.dataset.placement = 'center'; return; }
    const targetRect = this._target.getBoundingClientRect(); const left = Math.max(0, targetRect.left - gap); const top = Math.max(0, targetRect.top - gap); const right = Math.min(viewportWidth, targetRect.right + gap); const bottom = Math.min(viewportHeight, targetRect.bottom + gap);
    this._setBox(this._highlight, left, top, right - left, bottom - top); this._highlight.hidden = !mask;
    const maskTop = this._masks[0]!; const maskLeft = this._masks[1]!; const maskRight = this._masks[2]!; const maskBottom = this._masks[3]!; this._masks.forEach(piece => { piece.hidden = !mask; }); this._setBox(maskTop, 0, 0, viewportWidth, top); this._setBox(maskBottom, 0, bottom, viewportWidth, Math.max(0, viewportHeight - bottom)); this._setBox(maskLeft, 0, top, left, Math.max(0, bottom - top)); this._setBox(maskRight, right, top, Math.max(0, viewportWidth - right), Math.max(0, bottom - top));
    const popoverRect = this._popover.getBoundingClientRect(); let placement = step.placement ?? this.placement; if (placement === 'center') placement = 'bottom'; const distance = 12; let x = left + (right - left - popoverRect.width) / 2; let y = bottom + distance;
    if (placement === 'top') y = top - popoverRect.height - distance; else if (placement === 'left') { x = left - popoverRect.width - distance; y = top + (bottom - top - popoverRect.height) / 2; } else if (placement === 'right') { x = right + distance; y = top + (bottom - top - popoverRect.height) / 2; }
    if (placement === 'top' && y < margin) { placement = 'bottom'; y = bottom + distance; } else if (placement === 'bottom' && y + popoverRect.height > viewportHeight - margin) { placement = 'top'; y = top - popoverRect.height - distance; } else if (placement === 'left' && x < margin) { placement = 'right'; x = right + distance; } else if (placement === 'right' && x + popoverRect.width > viewportWidth - margin) { placement = 'left'; x = left - popoverRect.width - distance; }
    this._popover.style.left = `${Math.min(viewportWidth - popoverRect.width - margin, Math.max(margin, x))}px`; this._popover.style.top = `${Math.min(viewportHeight - popoverRect.height - margin, Math.max(margin, y))}px`; this._popover.dataset.placement = placement;
  }
  private _setBox(element: HTMLElement, left: number, top: number, width: number, height: number): void { element.style.cssText = `left:${left}px;top:${top}px;width:${Math.max(0, width)}px;height:${Math.max(0, height)}px`; }
}

export function defineTourComponents(): void {
  if (!customElements.get('hy-tour')) customElements.define('hy-tour', HYTour);
}
