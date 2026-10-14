const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, name);
}

/** Repeating, non-interactive text or image watermark over slotted content. */
export class HYWatermark extends HTMLElement {
  private readonly _svg = svgElement('svg');
  private readonly _pattern = svgElement('pattern');
  private readonly _patternId = `hy-watermark-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

  static get observedAttributes(): string[] {
    return ['content', 'image', 'rotate', 'gap-x', 'gap-y', 'offset-x', 'offset-y', 'mark-width', 'mark-height', 'font-size', 'font-family', 'font-weight', 'color', 'opacity', 'z-index'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style'); const content = document.createElement('div'); const slot = document.createElement('slot');
    style.textContent = `
      :host { position: relative; display: block; min-width: 0; isolation: isolate; }
      .content { position: relative; z-index: 0; min-width: 0; }
      svg { position: absolute; z-index: var(--_hy-watermark-z-index, 9); inset: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none; user-select: none; }
      svg[hidden] { display: none; }
      .mark-text { fill: var(--_hy-watermark-color, var(--hy-watermark-color, currentColor)); }
    `;
    content.className = 'content'; content.part.add('content'); content.append(slot);
    this._svg.classList.add('overlay'); this._svg.part.add('overlay'); this._svg.setAttribute('aria-hidden', 'true'); this._svg.setAttribute('focusable', 'false');
    const definitions = svgElement('defs'); this._pattern.id = this._patternId; this._pattern.setAttribute('patternUnits', 'userSpaceOnUse'); definitions.append(this._pattern);
    const fill = svgElement('rect'); fill.setAttribute('width', '100%'); fill.setAttribute('height', '100%'); fill.setAttribute('fill', `url(#${this._patternId})`); this._svg.append(definitions, fill);
    root.append(style, content, this._svg);
  }

  connectedCallback(): void { this._render(); }
  attributeChangedCallback(): void { this._render(); }

  get content(): string { return this.getAttribute('content') ?? ''; }
  set content(value: string | readonly string[]) { this.setAttribute('content', Array.isArray(value) ? value.map(String).join('\n') : String(value)); }
  get image(): string { return this.getAttribute('image') ?? ''; }
  set image(value: string) { const normalized = String(value).trim(); if (normalized) this.setAttribute('image', normalized); else this.removeAttribute('image'); }
  get rotate(): number { return finiteNumber(this.getAttribute('rotate'), -22, -180, 180); }
  set rotate(value: number) { this.setAttribute('rotate', String(finiteNumber(value, -22, -180, 180))); }
  get gapX(): number { return finiteNumber(this.getAttribute('gap-x'), 100, 0, 1000); }
  set gapX(value: number) { this.setAttribute('gap-x', String(finiteNumber(value, 100, 0, 1000))); }
  get gapY(): number { return finiteNumber(this.getAttribute('gap-y'), 100, 0, 1000); }
  set gapY(value: number) { this.setAttribute('gap-y', String(finiteNumber(value, 100, 0, 1000))); }
  get offsetX(): number { return finiteNumber(this.getAttribute('offset-x'), 0, -2000, 2000); }
  set offsetX(value: number) { this.setAttribute('offset-x', String(finiteNumber(value, 0, -2000, 2000))); }
  get offsetY(): number { return finiteNumber(this.getAttribute('offset-y'), 0, -2000, 2000); }
  set offsetY(value: number) { this.setAttribute('offset-y', String(finiteNumber(value, 0, -2000, 2000))); }
  get markWidth(): number { return finiteNumber(this.getAttribute('mark-width'), 120, 16, 1000); }
  set markWidth(value: number) { this.setAttribute('mark-width', String(finiteNumber(value, 120, 16, 1000))); }
  get markHeight(): number { return finiteNumber(this.getAttribute('mark-height'), 64, 16, 1000); }
  set markHeight(value: number) { this.setAttribute('mark-height', String(finiteNumber(value, 64, 16, 1000))); }
  get fontSize(): number { return finiteNumber(this.getAttribute('font-size'), 14, 6, 96); }
  set fontSize(value: number) { this.setAttribute('font-size', String(finiteNumber(value, 14, 6, 96))); }
  get fontFamily(): string { return this.getAttribute('font-family') || 'system-ui, sans-serif'; }
  set fontFamily(value: string) { this.setAttribute('font-family', String(value)); }
  get fontWeight(): string { return this.getAttribute('font-weight') || '500'; }
  set fontWeight(value: string | number) { this.setAttribute('font-weight', String(value)); }
  get color(): string { return this.getAttribute('color') ?? ''; }
  set color(value: string) { const normalized = String(value).trim(); if (normalized) this.setAttribute('color', normalized); else this.removeAttribute('color'); }
  get opacity(): number { return finiteNumber(this.getAttribute('opacity'), 0.16, 0, 1); }
  set opacity(value: number) { this.setAttribute('opacity', String(finiteNumber(value, 0.16, 0, 1))); }
  get zIndex(): number { return Math.round(finiteNumber(this.getAttribute('z-index'), 9, -1000, 100000)); }
  set zIndex(value: number) { this.setAttribute('z-index', String(Math.round(finiteNumber(value, 9, -1000, 100000)))); }

  private _render(): void {
    if (!this.isConnected) return;
    const hasMark = Boolean(this.image || this.content); this._svg.toggleAttribute('hidden', !hasMark); this._pattern.replaceChildren();
    this.style.setProperty('--_hy-watermark-z-index', String(this.zIndex));
    if (this.color) this.style.setProperty('--_hy-watermark-color', this.color); else this.style.removeProperty('--_hy-watermark-color');
    if (!hasMark) return;
    const tileWidth = this.markWidth + this.gapX; const tileHeight = this.markHeight + this.gapY;
    this._pattern.setAttribute('x', String(this.offsetX)); this._pattern.setAttribute('y', String(this.offsetY)); this._pattern.setAttribute('width', String(tileWidth)); this._pattern.setAttribute('height', String(tileHeight));
    const group = svgElement('g'); group.setAttribute('opacity', String(this.opacity)); group.setAttribute('transform', `rotate(${this.rotate} ${this.markWidth / 2} ${this.markHeight / 2})`);
    if (this.image) this._renderImage(group); else this._renderText(group);
    this._pattern.append(group);
  }

  private _renderImage(group: SVGGElement): void {
    const image = svgElement('image'); image.part.add('mark', 'image'); image.setAttribute('href', this.image); image.setAttribute('x', '0'); image.setAttribute('y', '0'); image.setAttribute('width', String(this.markWidth)); image.setAttribute('height', String(this.markHeight)); image.setAttribute('preserveAspectRatio', 'xMidYMid meet'); group.append(image);
  }

  private _renderText(group: SVGGElement): void {
    const lines = this.content.split(/\r?\n/u); const lineHeight = this.fontSize * 1.35; const startY = this.markHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
    const text = svgElement('text'); text.classList.add('mark-text'); text.part.add('mark', 'text'); text.setAttribute('x', String(this.markWidth / 2)); text.setAttribute('y', String(startY)); text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'middle'); text.setAttribute('font-size', String(this.fontSize)); text.setAttribute('font-family', this.fontFamily); text.setAttribute('font-weight', this.fontWeight);
    lines.forEach((line, index) => { const span = svgElement('tspan'); span.setAttribute('x', String(this.markWidth / 2)); if (index > 0) span.setAttribute('dy', String(lineHeight)); span.textContent = line; text.append(span); }); group.append(text);
  }
}

export function defineWatermarkComponents(): void {
  if (!customElements.get('hy-watermark')) customElements.define('hy-watermark', HYWatermark);
}
