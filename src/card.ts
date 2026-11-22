import { hasSlotContent } from './internal/presentation.js';

export type HYCardSize = 'small' | 'default';

/** Content surface with header, cover, body and footer slots. */
export class HYCard extends HTMLElement {
  private readonly _surface = document.createElement('article');
  private readonly _header = document.createElement('header');
  private readonly _heading = document.createElement('slot');
  private readonly _title = document.createElement('h3');
  private readonly _extra = document.createElement('slot');
  private readonly _cover = document.createElement('slot');
  private readonly _body = document.createElement('div');
  private readonly _loading = document.createElement('div');
  private readonly _footer = document.createElement('slot');
  static get observedAttributes(): string[] { return ['heading', 'bordered', 'hoverable', 'loading', 'size', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #eef0ff); font: var(--hy-font-size-sm, 12px)/var(--hy-line-height-relaxed, 1.5) var(--hy-font-family, system-ui, sans-serif); }
      .card { min-width: 0; box-sizing: border-box; overflow: hidden; border: 1px solid var(--hy-border-color, #343765); border-radius: var(--hy-card-radius, var(--hy-radius-lg, 8px)); background: var(--hy-card-bg-color, var(--hy-surface-elevated-color, #181a40)); transition: box-shadow 160ms ease, border-color 160ms ease; }
      :host([bordered="false"]) .card { border-color: transparent; }
      :host([hoverable]:hover) .card { border-color: var(--hy-hover-border-color, #777baf); box-shadow: 0 8px 24px var(--hy-shadow-color, #0003); }
      header { display: flex; align-items: center; justify-content: space-between; gap: var(--hy-space-6, 12px); padding: var(--hy-card-header-padding, var(--hy-space-8, 16px) var(--hy-space-10, 20px)); border-bottom: 1px solid var(--hy-border-color, #343765); }
      h3 { flex: 1; min-width: 0; margin: 0; overflow-wrap: anywhere; font-size: var(--hy-font-size-md, 14px); font-weight: var(--hy-font-weight-semibold, 600); }
      .extra { flex: 0 0 auto; } .cover { display: block; } .cover::slotted(*) { display: block; max-width: 100%; } .cover::slotted(img) { width: 100%; object-fit: cover; }
      .body, .loading { padding: var(--hy-card-body-padding, var(--hy-space-10, 20px)); overflow-wrap: anywhere; }
      .footer { display: block; padding: var(--hy-space-6, 12px) var(--hy-space-10, 20px); border-top: 1px solid var(--hy-border-color, #343765); }
      .loading span { display: block; height: 12px; margin-block: var(--hy-space-4, 8px); border-radius: var(--hy-radius-sm, 4px); background: var(--hy-hover-bg-color, #242752); } .loading span:first-child { width: 40%; } .loading span:last-child { width: 70%; }
      :host([size="small"]) header, :host([size="small"]) .body, :host([size="small"]) .footer, :host([size="small"]) .loading { padding: var(--hy-space-6, 12px); }
      [hidden] { display: none !important; } @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
    `;
    this._surface.className = 'card'; this._surface.part.add('card');
    this._header.part.add('header'); this._title.id = 'card-heading'; this._title.part.add('heading'); this._heading.name = 'heading'; this._title.append(this._heading);
    this._extra.name = 'extra'; this._extra.className = 'extra'; this._extra.part.add('extra'); this._header.append(this._title, this._extra);
    this._cover.name = 'cover'; this._cover.className = 'cover'; this._cover.part.add('cover');
    this._body.className = 'body'; this._body.part.add('body'); this._body.append(document.createElement('slot'));
    this._loading.className = 'loading'; this._loading.part.add('loading'); this._loading.setAttribute('aria-hidden', 'true');
    this._loading.append(...Array.from({ length: 3 }, () => document.createElement('span')));
    this._footer.name = 'footer'; this._footer.className = 'footer'; this._footer.part.add('footer');
    this._surface.append(this._header, this._cover, this._body, this._loading, this._footer); root.append(style, this._surface);
    for (const slot of [this._heading, this._extra, this._cover, this._footer]) slot.addEventListener('slotchange', this._render);
  }
  connectedCallback(): void { this._render(); }
  attributeChangedCallback(): void { this._render(); }
  get heading(): string { return this.getAttribute('heading') ?? ''; }
  set heading(value: string) { this.setAttribute('heading', value); }
  get bordered(): boolean { return this.getAttribute('bordered') !== 'false'; }
  set bordered(value: boolean) { this.setAttribute('bordered', String(value)); }
  get hoverable(): boolean { return this.hasAttribute('hoverable'); }
  set hoverable(value: boolean) { this.toggleAttribute('hoverable', Boolean(value)); }
  get loading(): boolean { return this.hasAttribute('loading'); }
  set loading(value: boolean) { this.toggleAttribute('loading', Boolean(value)); }
  get size(): HYCardSize { return this.getAttribute('size') === 'small' ? 'small' : 'default'; }
  set size(value: HYCardSize) { this.setAttribute('size', value); }
  private _render = (): void => {
    if (this._heading.textContent !== this.heading) this._heading.textContent = this.heading;
    const heading = Boolean(this.heading) || hasSlotContent(this._heading);
    this._title.hidden = !heading; this._extra.hidden = !hasSlotContent(this._extra); this._header.hidden = !heading && this._extra.hidden;
    this._cover.hidden = !hasSlotContent(this._cover); this._body.hidden = this.loading; this._body.inert = this.loading;
    this._loading.hidden = !this.loading; this._footer.hidden = this.loading || !hasSlotContent(this._footer);
    this._surface.setAttribute('aria-busy', String(this.loading));
    if (heading) this._surface.setAttribute('aria-labelledby', 'card-heading'); else this._surface.removeAttribute('aria-labelledby');
    const label = this.getAttribute('aria-label');
    if (label) { this._surface.setAttribute('aria-label', label); this._surface.removeAttribute('aria-labelledby'); } else this._surface.removeAttribute('aria-label');
  };
}
export function defineCardComponents(): void { if (!customElements.get('hy-card')) customElements.define('hy-card', HYCard); }
