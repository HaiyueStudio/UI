export type HYProgressType = 'line' | 'circle';
export type HYProgressStatus = 'normal' | 'active' | 'success' | 'exception';

export class HYProgress extends HTMLElement {
  private readonly _meter = document.createElement('div');
  private readonly _line = document.createElement('div');
  private readonly _fill = document.createElement('div');
  private readonly _svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private readonly _circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  private readonly _info = document.createElement('span');
  static get observedAttributes(): string[] { return ['percent', 'type', 'status', 'indeterminate', 'show-info', 'stroke-width', 'size', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      .meter { --_color: var(--hy-progress-color, var(--hy-accent-color, #8177f2)); display: flex; align-items: center; gap: var(--hy-space-4, 8px); }
      .meter.success { --_color: var(--hy-success-color, #3ea67a); } .meter.exception { --_color: var(--hy-error-color, #d95d72); }
      .line { flex: 1; overflow: hidden; height: var(--_stroke, 6px); border-radius: 999px; background: var(--hy-progress-trail-color, var(--hy-border-color, #303746)); }
      .fill { height: 100%; border-radius: inherit; background: var(--_color); transition: width 150ms ease; }
      .active .fill { background-image: linear-gradient(90deg, transparent, color-mix(in srgb, var(--hy-selected-text-color, #fff) 35%, transparent), transparent); background-size: 200% 100%; animation: hy-progress-active 1.5s linear infinite; }
      .indeterminate .fill { width: 35% !important; animation: hy-progress-unknown 1.3s ease-in-out infinite; }
      svg { display: block; width: var(--_size, 96px); height: var(--_size, 96px); transform: rotate(-90deg); }
      circle { fill: none; stroke-width: var(--_circle-stroke, 6); } .trail { stroke: var(--hy-progress-trail-color, var(--hy-border-color, #303746)); }
      .arc { stroke: var(--_color); stroke-linecap: round; transition: stroke-dashoffset 150ms ease; }
      .circle { position: relative; display: inline-grid; place-items: center; } .circle .info { position: absolute; max-width: 80%; text-align: center; }
      .circle.indeterminate svg { animation: hy-progress-rotate 1s linear infinite; }
      [hidden] { display: none !important; } .info { flex: 0 0 auto; }
      @keyframes hy-progress-active { to { background-position: -200% 0; } }
      @keyframes hy-progress-unknown { from { transform: translateX(-100%); } to { transform: translateX(385%); } }
      @keyframes hy-progress-rotate { to { transform: rotate(270deg); } }
      @media (prefers-reduced-motion: reduce) { .fill, .arc { transition: none; } .active .fill, .indeterminate .fill, .circle.indeterminate svg { animation: none; } }
    `;
    this._meter.className = 'meter'; this._meter.part.add('meter'); this._meter.setAttribute('role', 'progressbar');
    this._line.className = 'line'; this._line.part.add('trail'); this._fill.className = 'fill'; this._fill.part.add('fill'); this._line.append(this._fill);
    this._svg.setAttribute('viewBox', '0 0 100 100'); this._svg.setAttribute('aria-hidden', 'true'); this._svg.part.add('circle');
    const trail = this._circle.cloneNode() as SVGCircleElement;
    for (const circle of [trail, this._circle]) { circle.setAttribute('cx', '50'); circle.setAttribute('cy', '50'); circle.setAttribute('r', '44'); circle.setAttribute('pathLength', '100'); }
    trail.classList.add('trail'); this._circle.classList.add('arc'); this._circle.setAttribute('stroke-dasharray', '100');
    this._svg.append(trail, this._circle); this._info.className = 'info'; this._info.part.add('info');
    this._meter.append(this._line, this._svg, this._info); root.append(style, this._meter);
  }
  connectedCallback(): void { this._sync(); }
  attributeChangedCallback(): void { this._sync(); }
  get percent(): number { return boundedNumber(this.getAttribute('percent'), 0, 100, 0); }
  set percent(value: number) { this.setAttribute('percent', String(value)); }
  get type(): HYProgressType { return this.getAttribute('type') === 'circle' ? 'circle' : 'line'; }
  set type(value: HYProgressType) { this.setAttribute('type', value); }
  get status(): HYProgressStatus { const value = this.getAttribute('status'); return value === 'active' || value === 'success' || value === 'exception' ? value : 'normal'; }
  set status(value: HYProgressStatus) { this.setAttribute('status', value); }
  get indeterminate(): boolean { return this.hasAttribute('indeterminate'); }
  set indeterminate(value: boolean) { this.toggleAttribute('indeterminate', value); }
  get showInfo(): boolean { return this.getAttribute('show-info') !== 'false'; }
  set showInfo(value: boolean) { this.setAttribute('show-info', String(value)); }
  get strokeWidth(): number { return boundedNumber(this.getAttribute('stroke-width'), 1, 20, 6); }
  set strokeWidth(value: number) { this.setAttribute('stroke-width', String(value)); }
  get size(): number { return boundedNumber(this.getAttribute('size'), 24, 1000, 96); }
  set size(value: number) { this.setAttribute('size', String(value)); }
  private _sync(): void {
    const circle = this.type === 'circle';
    this._meter.className = `meter ${this.status}${circle ? ' circle' : ''}${this.indeterminate ? ' indeterminate' : ''}`;
    this._meter.setAttribute('aria-valuemin', '0'); this._meter.setAttribute('aria-valuemax', '100');
    if (this.indeterminate) this._meter.removeAttribute('aria-valuenow'); else this._meter.setAttribute('aria-valuenow', String(this.percent));
    this._meter.setAttribute('aria-label', this.getAttribute('aria-label') || 'Progress');
    this._meter.setAttribute('aria-valuetext', this.indeterminate ? 'In progress' : `${this.percent}%${this.status === 'exception' ? ' Failed' : this.status === 'success' ? ' Complete' : ''}`);
    this._meter.style.setProperty('--_stroke', `${this.strokeWidth}px`); this._meter.style.setProperty('--_circle-stroke', String(this.strokeWidth)); this._meter.style.setProperty('--_size', `${this.size}px`);
    this._line.hidden = circle; this._svg.style.display = circle ? '' : 'none'; this._fill.style.width = `${this.percent}%`;
    this._circle.setAttribute('r', String(50 - this.strokeWidth / 2 - 1)); this._svg.querySelector('.trail')?.setAttribute('r', String(50 - this.strokeWidth / 2 - 1));
    this._circle.setAttribute('stroke-dashoffset', String(this.indeterminate ? 65 : 100 - this.percent));
    this._info.hidden = !this.showInfo; this._info.textContent = this.indeterminate ? '…' : `${this.percent}%`;
  }
}
function boundedNumber(raw: string | null, min: number, max: number, fallback: number): number { const value = raw === null ? NaN : Number(raw); return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback; }
export function defineProgressComponents(): void { if (!customElements.get('hy-progress')) customElements.define('hy-progress', HYProgress); }
