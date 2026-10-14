export type HYDividerOrientation = 'horizontal' | 'vertical';
export type HYDividerLineStyle = 'solid' | 'dashed' | 'dotted' | 'double';
export type HYDividerTextPlacement = 'start' | 'center' | 'end';

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (value == null || value === '') return fallback;
  const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

/** Theme-aware horizontal or vertical separator with optional slotted text. */
export class HYDivider extends HTMLElement {
  private readonly _divider = document.createElement('div');
  private readonly _before = document.createElement('span');
  private readonly _label = document.createElement('span');
  private readonly _slot = document.createElement('slot');
  private readonly _fallback = document.createElement('span');
  private readonly _after = document.createElement('span');

  static get observedAttributes(): string[] {
    return ['orientation', 'line-style', 'text-placement', 'label', 'thickness', 'color', 'spacing', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-secondary-text-color, #aebbd0); font: 12px/1.4 system-ui, sans-serif; }
      .divider { display: flex; width: 100%; align-items: center; gap: var(--_spacing, var(--hy-divider-text-gap, 12px)); box-sizing: border-box; }
      .line { flex: 1 1 auto; min-width: 0; height: 0; border-top: var(--_thickness, 1px) var(--_line-style, solid) var(--_color, var(--hy-divider-color, var(--hy-border-color, #3d4654))); }
      .label { flex: 0 0 auto; max-width: min(70%, 64ch); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .label[hidden] { display: none; }
      :host([text-placement="start"]) .before { flex: 0 0 var(--hy-divider-edge-length, 24px); }
      :host([text-placement="end"]) .after { flex: 0 0 var(--hy-divider-edge-length, 24px); }
      :host([orientation="vertical"]) { display: inline-block; width: max-content; height: var(--hy-divider-vertical-height, 1.4em); vertical-align: middle; }
      :host([orientation="vertical"]) .divider { width: auto; height: 100%; flex-direction: column; }
      :host([orientation="vertical"]) .line { width: 0; height: auto; min-height: 0; border-top: 0; border-left: var(--_thickness, 1px) var(--_line-style, solid) var(--_color, var(--hy-divider-color, var(--hy-border-color, #3d4654))); }
      :host([orientation="vertical"]) .label { max-width: none; max-height: 70%; writing-mode: vertical-rl; }
      :host([orientation="vertical"][text-placement="start"]) .before { flex-basis: var(--hy-divider-edge-length, 10px); }
      :host([orientation="vertical"][text-placement="end"]) .after { flex-basis: var(--hy-divider-edge-length, 10px); }
    `;
    this._divider.className = 'divider'; this._divider.part.add('divider'); this._divider.setAttribute('role', 'separator');
    this._before.className = 'line before'; this._before.part.add('line', 'line-before'); this._before.setAttribute('aria-hidden', 'true');
    this._label.className = 'label'; this._label.part.add('text'); this._fallback.className = 'fallback'; this._fallback.part.add('fallback'); this._slot.append(this._fallback); this._label.append(this._slot);
    this._after.className = 'line after'; this._after.part.add('line', 'line-after'); this._after.setAttribute('aria-hidden', 'true'); this._divider.append(this._before, this._label, this._after); root.append(style, this._divider);
    this._slot.addEventListener('slotchange', () => this._syncLabel());
  }

  connectedCallback(): void { this._render(); }
  attributeChangedCallback(): void { this._render(); }

  get orientation(): HYDividerOrientation { return this.getAttribute('orientation') === 'vertical' ? 'vertical' : 'horizontal'; }
  set orientation(value: HYDividerOrientation) { this.setAttribute('orientation', value === 'vertical' ? 'vertical' : 'horizontal'); }
  get lineStyle(): HYDividerLineStyle {
    const value = this.getAttribute('line-style'); return value === 'dashed' || value === 'dotted' || value === 'double' ? value : 'solid';
  }
  set lineStyle(value: HYDividerLineStyle) { this.setAttribute('line-style', value === 'dashed' || value === 'dotted' || value === 'double' ? value : 'solid'); }
  get textPlacement(): HYDividerTextPlacement {
    const value = this.getAttribute('text-placement'); return value === 'start' || value === 'end' ? value : 'center';
  }
  set textPlacement(value: HYDividerTextPlacement) { this.setAttribute('text-placement', value === 'start' || value === 'end' ? value : 'center'); }
  get label(): string { return this.getAttribute('label') ?? ''; }
  set label(value: string) { const normalized = String(value); if (normalized) this.setAttribute('label', normalized); else this.removeAttribute('label'); }
  get thickness(): number { return boundedNumber(this.getAttribute('thickness'), 1, 1, 12); }
  set thickness(value: number) { this.setAttribute('thickness', String(boundedNumber(value, 1, 1, 12))); }
  get color(): string { return this.getAttribute('color') ?? ''; }
  set color(value: string) { const normalized = String(value).trim(); if (normalized) this.setAttribute('color', normalized); else this.removeAttribute('color'); }
  get spacing(): number { return boundedNumber(this.getAttribute('spacing'), 12, 0, 80); }
  set spacing(value: number) { this.setAttribute('spacing', String(boundedNumber(value, 12, 0, 80))); }

  private _render(): void {
    if (!this.isConnected) return;
    this._divider.setAttribute('aria-orientation', this.orientation); const name = this.getAttribute('aria-label'); if (name) this._divider.setAttribute('aria-label', name); else this._divider.removeAttribute('aria-label');
    const effectiveThickness = this.lineStyle === 'double' ? Math.max(3, this.thickness) : this.thickness;
    this.style.setProperty('--_line-style', this.lineStyle); this.style.setProperty('--_thickness', `${effectiveThickness}px`); this.style.setProperty('--_spacing', `${this.spacing}px`);
    if (this.color) this.style.setProperty('--_color', this.color); else this.style.removeProperty('--_color'); this._fallback.textContent = this.label; this._syncLabel();
  }
  private _syncLabel(): void {
    const hasSlottedText = this._slot.assignedNodes().some(node => node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()));
    this._label.hidden = !hasSlottedText && !this.label;
  }
}

export function defineDividerComponents(): void {
  if (!customElements.get('hy-divider')) customElements.define('hy-divider', HYDivider);
}
