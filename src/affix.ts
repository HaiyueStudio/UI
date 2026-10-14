export interface HYAffixChangeDetail { readonly affixed: boolean; }

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (value == null || value === '') return fallback;
  const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

/** Keeps slotted content pinned to a viewport or scrolling target without collapsing layout. */
export class HYAffix extends HTMLElement {
  private readonly _placeholder = document.createElement('div');
  private readonly _content = document.createElement('div');
  private _target: HTMLElement | Window | null = null;
  private _affixed = false;
  private _listeners: AbortController | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _frame = 0;

  static get observedAttributes(): string[] { return ['offset-top', 'offset-bottom', 'disabled', 'z-index']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style'); const slot = document.createElement('slot');
    style.textContent = `
      :host { display: block; min-width: 0; }
      .placeholder { min-width: 0; }
      .content { min-width: 0; }
      .content.fixed { position: fixed; z-index: var(--_hy-affix-z-index, 100); box-sizing: border-box; }
    `;
    this._placeholder.className = 'placeholder'; this._placeholder.part.add('placeholder'); this._content.className = 'content'; this._content.part.add('content'); this._content.append(slot); this._placeholder.append(this._content); root.append(style, this._placeholder);
  }

  connectedCallback(): void { this._connect(); queueMicrotask(() => this.refresh()); }
  disconnectedCallback(): void { this._disconnect(); this._setAffixed(false); }
  attributeChangedCallback(): void { if (this.isConnected) { this._connect(); this.refresh(); } }

  get topOffset(): number | null { return this.hasAttribute('offset-top') ? finiteNumber(this.getAttribute('offset-top'), 0, 0, 10000) : null; }
  set topOffset(value: number | null) { if (value == null) this.removeAttribute('offset-top'); else this.setAttribute('offset-top', String(finiteNumber(value, 0, 0, 10000))); }
  get bottomOffset(): number | null { return this.hasAttribute('offset-bottom') ? finiteNumber(this.getAttribute('offset-bottom'), 0, 0, 10000) : null; }
  set bottomOffset(value: number | null) { if (value == null) this.removeAttribute('offset-bottom'); else this.setAttribute('offset-bottom', String(finiteNumber(value, 0, 0, 10000))); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }
  get zIndex(): number { return Math.round(finiteNumber(this.getAttribute('z-index'), 100, -1000, 100000)); }
  set zIndex(value: number) { this.setAttribute('z-index', String(Math.round(finiteNumber(value, 100, -1000, 100000)))); }
  get affixed(): boolean { return this._affixed; }
  get target(): HTMLElement | Window | null { return this._target; }
  set target(value: HTMLElement | Window | null) { this._target = value instanceof HTMLElement || value === window ? value : null; if (this.isConnected) { this._connect(); this.refresh(); } }

  refresh(): void {
    cancelAnimationFrame(this._frame); this._frame = requestAnimationFrame(() => this._measure());
  }

  private _connect(): void {
    this._disconnect(); const target = this._target ?? window; const abort = new AbortController(); this._listeners = abort;
    target.addEventListener('scroll', () => this.refresh(), { passive: true, signal: abort.signal });
    if (target !== window) window.addEventListener('scroll', () => this.refresh(), { passive: true, signal: abort.signal });
    window.addEventListener('resize', () => this.refresh(), { passive: true, signal: abort.signal });
    if (typeof ResizeObserver !== 'undefined') { this._resizeObserver = new ResizeObserver(() => this.refresh()); this._resizeObserver.observe(this); this._resizeObserver.observe(this._content); if (target instanceof HTMLElement) this._resizeObserver.observe(target); }
  }
  private _disconnect(): void { this._listeners?.abort(); this._listeners = null; this._resizeObserver?.disconnect(); this._resizeObserver = null; cancelAnimationFrame(this._frame); this._frame = 0; }
  private _measure(): void {
    if (!this.isConnected || this.disabled) { this._setAffixed(false); return; }
    const target = this._target ?? window; const targetRect = target instanceof HTMLElement ? target.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const placeholderRect = this._placeholder.getBoundingClientRect(); const contentRect = this._affixed ? placeholderRect : this._content.getBoundingClientRect(); const useBottom = this.topOffset == null && this.bottomOffset != null;
    const shouldAffix = useBottom ? contentRect.bottom >= targetRect.bottom - (this.bottomOffset ?? 0) : contentRect.top <= targetRect.top + (this.topOffset ?? 0);
    if (!shouldAffix) { this._setAffixed(false); return; }
    this._placeholder.style.width = `${contentRect.width}px`; this._placeholder.style.height = `${contentRect.height}px`; this._content.style.left = `${placeholderRect.left}px`; this._content.style.width = `${placeholderRect.width}px`; this._content.style.setProperty('--_hy-affix-z-index', String(this.zIndex));
    if (useBottom) { this._content.style.removeProperty('top'); this._content.style.bottom = `${Math.max(0, window.innerHeight - targetRect.bottom) + (this.bottomOffset ?? 0)}px`; }
    else { this._content.style.removeProperty('bottom'); this._content.style.top = `${Math.max(0, targetRect.top) + (this.topOffset ?? 0)}px`; }
    this._setAffixed(true);
  }
  private _setAffixed(value: boolean): void {
    if (!value) { this._content.classList.remove('fixed'); this._placeholder.style.removeProperty('width'); this._placeholder.style.removeProperty('height'); this._content.style.removeProperty('left'); this._content.style.removeProperty('width'); this._content.style.removeProperty('top'); this._content.style.removeProperty('bottom'); }
    else this._content.classList.add('fixed');
    if (value === this._affixed) return; this._affixed = value; this.toggleAttribute('affixed', value); this.dispatchEvent(new CustomEvent<HYAffixChangeDetail>('affix-change', { bubbles: true, composed: true, detail: { affixed: value } }));
  }
}

export function defineAffixComponents(): void {
  if (!customElements.get('hy-affix')) customElements.define('hy-affix', HYAffix);
}
