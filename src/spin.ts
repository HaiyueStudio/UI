export type HYSpinSize = 'small' | 'default' | 'large';

export class HYSpin extends HTMLElement {
  private readonly _content = document.createElement('div');
  private readonly _slot = document.createElement('slot');
  private readonly _indicator = document.createElement('div');
  private readonly _tip = document.createElement('span');
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _visible = false;
  static get observedAttributes(): string[] { return ['spinning', 'delay', 'tip', 'size', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { position: relative; display: inline-block; min-width: 0; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      :host(.has-content) { display: block; } .content.busy { opacity: .45; }
      .indicator { display: inline-flex; flex-direction: column; justify-content: center; align-items: center; gap: var(--hy-space-4, 8px); color: var(--hy-accent-color, #8177f2); }
      :host(.has-content) .indicator { position: absolute; inset: 0; z-index: 1; background: var(--hy-spin-mask-color, transparent); }
      .spinner { width: var(--hy-spin-size, 24px); height: var(--hy-spin-size, 24px); box-sizing: border-box; border: 3px solid color-mix(in srgb, currentColor 22%, transparent); border-top-color: currentColor; border-radius: 50%; animation: hy-spin 0.8s linear infinite; }
      :host([size="small"]) .spinner { width: 16px; height: 16px; border-width: 2px; } :host([size="large"]) .spinner { width: 36px; height: 36px; border-width: 4px; }
      [hidden] { display: none !important; } @keyframes hy-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
    `;
    this._content.className = 'content'; this._content.part.add('content'); this._content.append(this._slot);
    this._indicator.className = 'indicator'; this._indicator.part.add('indicator'); this._indicator.setAttribute('role', 'status');
    const spinner = document.createElement('span'); spinner.className = 'spinner'; spinner.part.add('spinner'); spinner.setAttribute('aria-hidden', 'true');
    this._tip.part.add('tip'); this._indicator.append(spinner, this._tip); this._indicator.hidden = true; root.append(style, this._content, this._indicator);
  }
  connectedCallback(): void { this._slot.addEventListener('slotchange', this._render); this._schedule(); }
  disconnectedCallback(): void { this._clearTimer(); this._slot.removeEventListener('slotchange', this._render); this._visible = false; this._content.inert = false; }
  attributeChangedCallback(name: string, previous: string | null, next: string | null): void { if (previous !== next) { if (name === 'spinning' || name === 'delay') this._schedule(); else this._render(); } }
  get spinning(): boolean { return this.getAttribute('spinning') !== 'false'; }
  set spinning(value: boolean) { this.setAttribute('spinning', String(value)); }
  get delay(): number { const value = Number(this.getAttribute('delay')); return Number.isFinite(value) ? Math.max(0, Math.min(value, 60000)) : 0; }
  set delay(value: number) { this.setAttribute('delay', String(value)); }
  get tip(): string { return this.getAttribute('tip') ?? ''; }
  set tip(value: string) { this.setAttribute('tip', value); }
  get size(): HYSpinSize { const value = this.getAttribute('size'); return value === 'small' || value === 'large' ? value : 'default'; }
  set size(value: HYSpinSize) { this.setAttribute('size', value); }
  private _schedule(): void {
    this._clearTimer();
    if (!this.isConnected) return;
    this._visible = this.spinning && this.delay === 0;
    if (this.spinning && this.delay > 0) this._timer = setTimeout(() => { this._timer = null; this._visible = this.spinning; this._render(); }, this.delay);
    this._render();
  }
  private _clearTimer(): void { if (this._timer !== null) clearTimeout(this._timer); this._timer = null; }
  private _render = (): void => {
    const hasContent = this._slot.assignedNodes().some(node => node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()));
    if (this.isConnected) this.classList.toggle('has-content', hasContent);
    this._content.inert = this.spinning; this._content.setAttribute('aria-busy', String(this.spinning)); this._content.classList.toggle('busy', this._visible);
    this._indicator.hidden = !this._visible; this._indicator.setAttribute('aria-label', this.getAttribute('aria-label') || this.tip || 'Loading');
    this._tip.textContent = this.tip; this._tip.hidden = !this.tip;
  };
}
export function defineSpinComponents(): void { if (!customElements.get('hy-spin')) customElements.define('hy-spin', HYSpin); }
