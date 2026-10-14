export interface HYRateChangeDetail { readonly value: number; }
export interface HYRateHoverChangeDetail { readonly value: number | null; }

function finiteNumber(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const number = Number(value); return Number.isFinite(number) ? number : fallback;
}

/** Accessible star rating with optional half-step pointer and keyboard selection. */
export class HYRate extends HTMLElement {
  private readonly _group = document.createElement('div');
  private _value = 0;
  private _hoverValue: number | null = null;
  private _tooltips: readonly string[] = [];
  private _reflecting = false;

  static get observedAttributes(): string[] {
    return ['value', 'count', 'allow-half', 'allow-clear', 'disabled', 'readonly', 'character', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; color: var(--hy-text-color, #eef3ff); font: 12px/1 system-ui, sans-serif; }
      .group { display: inline-flex; align-items: center; gap: var(--hy-rate-gap, 5px); border-radius: var(--hy-rate-focus-radius, 5px); }
      .group:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 3px; }
      .star { position: relative; width: 1em; height: 1em; padding: 0; overflow: hidden; border: 0; color: inherit; background: transparent; cursor: pointer; font: var(--hy-rate-font-size, 25px)/1 system-ui, sans-serif; transition: transform 120ms ease; }
      .star:hover { transform: scale(1.12); }
      .empty, .fill-inner { display: block; width: 1em; height: 1em; }
      .empty { color: var(--hy-rate-empty-color, color-mix(in srgb, var(--hy-text-color, #eef3ff) 16%, transparent)); }
      .fill { position: absolute; inset: 0 auto 0 0; width: var(--_fill, 0%); overflow: hidden; pointer-events: none; }
      .fill-inner { color: var(--hy-rate-color, #f2b84b); }
      .star:focus { outline: none; }
      :host([disabled]), :host([readonly]) { opacity: .62; }
      :host([disabled]) .star, :host([readonly]) .star { cursor: default; }
      :host([disabled]) .star:hover, :host([readonly]) .star:hover { transform: none; }
      @media (prefers-reduced-motion: reduce) { .star { transition: none; } }
    `;
    this._group.className = 'group'; this._group.part.add('group'); this._group.setAttribute('role', 'slider'); root.append(style, this._group);
    this._group.addEventListener('pointermove', event => this._handlePointerMove(event));
    this._group.addEventListener('pointerleave', () => this._setHover(null));
    this._group.addEventListener('click', event => this._handleClick(event));
    this._group.addEventListener('keydown', event => this._handleKeydown(event));
  }

  connectedCallback(): void { this._value = this._normalize(this.getAttribute('value')); this._reflectValue(); this._render(); }
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || this._reflecting) return;
    if (name === 'value' || name === 'count' || name === 'allow-half') { this._value = this._normalize(this.getAttribute('value')); this._reflectValue(); }
    this._render();
  }

  get value(): number { return this._value; }
  set value(value: number) { this._value = this._normalize(value); this._reflectValue(); this._render(); }
  get count(): number { return Math.min(20, Math.max(1, Math.floor(finiteNumber(this.getAttribute('count'), 5)))); }
  set count(value: number) { this.setAttribute('count', String(Math.min(20, Math.max(1, Math.floor(finiteNumber(value, 5)))))); }
  get allowHalf(): boolean { return this.hasAttribute('allow-half'); }
  set allowHalf(value: boolean) { this.toggleAttribute('allow-half', Boolean(value)); }
  get allowClear(): boolean { return this.getAttribute('allow-clear') !== 'false'; }
  set allowClear(value: boolean) { this.setAttribute('allow-clear', String(Boolean(value))); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }
  get readOnly(): boolean { return this.hasAttribute('readonly'); }
  set readOnly(value: boolean) { this.toggleAttribute('readonly', Boolean(value)); }
  get character(): string { return this.getAttribute('character') || '★'; }
  set character(value: string) { const normalized = String(value); if (normalized) this.setAttribute('character', normalized); else this.removeAttribute('character'); }
  get tooltips(): readonly string[] { return this._tooltips; }
  set tooltips(value: readonly string[]) { this._tooltips = Array.isArray(value) ? value.map(String) : []; this._render(); }

  private _normalize(value: unknown): number {
    const step = this.allowHalf ? 0.5 : 1; const number = Math.min(this.count, Math.max(0, finiteNumber(value, 0))); return Math.round(number / step) * step;
  }
  private _reflectValue(): void {
    const value = String(this._value); if (this.getAttribute('value') === value) return; this._reflecting = true; this.setAttribute('value', value); this._reflecting = false;
  }
  private _render(): void {
    if (!this.isConnected) return;
    const stars: HTMLButtonElement[] = [];
    for (let index = 0; index < this.count; index += 1) {
      const button = document.createElement('button'); const empty = document.createElement('span'); const fill = document.createElement('span'); const fillInner = document.createElement('span');
      button.type = 'button'; button.className = 'star'; button.part.add('star'); button.dataset.index = String(index); button.tabIndex = -1; button.setAttribute('aria-hidden', 'true');
      empty.className = 'empty'; empty.textContent = this.character; fill.className = 'fill'; fill.part.add('fill'); fillInner.className = 'fill-inner'; fillInner.textContent = this.character; fill.append(fillInner); button.append(empty, fill); stars.push(button);
    }
    this._group.replaceChildren(...stars); this._group.tabIndex = this.disabled || this.readOnly ? -1 : 0; this._group.setAttribute('aria-disabled', String(this.disabled)); this._group.setAttribute('aria-readonly', String(this.readOnly)); this._group.setAttribute('aria-valuemin', '0'); this._group.setAttribute('aria-valuemax', String(this.count)); this._group.setAttribute('aria-valuenow', String(this._value)); this._group.setAttribute('aria-valuetext', this._valueText(this._value)); this._group.setAttribute('aria-label', this.getAttribute('aria-label') || 'Rating'); this._updateVisuals();
  }
  private _updateVisuals(): void {
    const shown = this._hoverValue ?? this._value;
    this._group.querySelectorAll<HTMLElement>('.star').forEach((star, index) => { const fill = Math.min(1, Math.max(0, shown - index)); star.style.setProperty('--_fill', `${fill * 100}%`); star.title = this._valueText(index + 1); });
  }
  private _pointerValue(event: PointerEvent | MouseEvent): number | null {
    const target = (event.target as Element | null)?.closest<HTMLElement>('.star'); if (!target || !this._group.contains(target)) return null;
    const index = Number(target.dataset.index); if (!this.allowHalf) return index + 1; const rect = target.getBoundingClientRect(); return index + (event.clientX < rect.left + rect.width / 2 ? 0.5 : 1);
  }
  private _handlePointerMove(event: PointerEvent): void { if (this.disabled || this.readOnly) return; const value = this._pointerValue(event); if (value != null) this._setHover(value); }
  private _handleClick(event: MouseEvent): void {
    if (this.disabled || this.readOnly) return; const pointed = this._pointerValue(event); if (pointed == null) return; const value = this.allowClear && pointed === this._value ? 0 : pointed; this._setHover(null); this._commit(value);
  }
  private _handleKeydown(event: KeyboardEvent): void {
    if (this.disabled || this.readOnly) return; const step = this.allowHalf ? 0.5 : 1; let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = this._value + step; else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = this._value - step; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = this.count;
    if (next == null) return; event.preventDefault(); this._commit(next);
  }
  private _setHover(value: number | null): void {
    if (this._hoverValue === value) return; this._hoverValue = value; this._updateVisuals(); this.dispatchEvent(new CustomEvent<HYRateHoverChangeDetail>('hover-change', { bubbles: true, composed: true, detail: { value } }));
  }
  private _commit(value: number): void {
    const next = this._normalize(value); if (next === this._value) return; this._value = next; this._reflectValue(); this._group.setAttribute('aria-valuenow', String(next)); this._group.setAttribute('aria-valuetext', this._valueText(next)); this._updateVisuals(); this.dispatchEvent(new CustomEvent<HYRateChangeDetail>('value-change', { bubbles: true, composed: true, detail: { value: next } }));
  }
  private _valueText(value: number): string { const index = Math.ceil(value) - 1; return value > 0 && this._tooltips[index] ? `${value}: ${this._tooltips[index]}` : `${value} of ${this.count}`; }
}

export function defineRateComponents(): void {
  if (!customElements.get('hy-rate')) customElements.define('hy-rate', HYRate);
}
