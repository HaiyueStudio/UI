import { hasSlotContent } from './internal/presentation.js';

export type HYRibbonPlacement = 'start' | 'end';

/** Folded ribbon decorating content in the default slot. */
export class HYRibbon extends HTMLElement {
  private readonly _ribbon = document.createElement('div');
  private readonly _text = document.createElement('slot');
  private readonly _fallback = document.createTextNode('');

  static get observedAttributes(): string[] {
    return ['text', 'color', 'placement'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        min-width: 0;
        color: var(--hy-text-color, #eef0ff);
        font: var(--hy-font-size-sm, 12px)/var(--hy-line-height-relaxed, 1.5) var(--hy-font-family, system-ui, sans-serif);
      }
      :host([hidden]), [hidden] { display: none !important; }
      .wrapper { position: relative; display: flow-root; min-width: 0; }
      .ribbon {
        position: absolute;
        z-index: 1;
        inset-block-start: var(--hy-ribbon-offset, var(--hy-space-6, 12px));
        inset-inline-end: calc(-1 * var(--hy-ribbon-fold-size, var(--hy-space-4, 8px)));
        display: flex;
        align-items: center;
        box-sizing: border-box;
        max-inline-size: calc(100% + 2 * var(--hy-ribbon-fold-size, var(--hy-space-4, 8px)));
        min-block-size: var(--hy-ribbon-height, var(--hy-control-height-xs, 24px));
        padding: var(--hy-ribbon-padding, var(--hy-space-2, 4px) var(--hy-space-6, 12px));
        border-radius: var(--hy-ribbon-radius, var(--hy-radius-sm, 4px));
        color: var(--hy-ribbon-text-color, var(--hy-on-accent-color, #fff));
        background: var(--_hy-ribbon-color, var(--hy-ribbon-bg-color, var(--hy-accent-color, #8177f2)));
        font-size: var(--hy-ribbon-font-size, var(--hy-font-size-sm, 12px));
      }
      .text { display: block; min-width: 0; overflow-wrap: anywhere; }
      .fold {
        position: absolute;
        inset-block-start: 100%;
        inset-inline-end: 0;
        inline-size: var(--hy-ribbon-fold-size, var(--hy-space-4, 8px));
        block-size: var(--hy-ribbon-fold-size, var(--hy-space-4, 8px));
        background: color-mix(in srgb, var(--_hy-ribbon-color, var(--hy-ribbon-bg-color, var(--hy-accent-color, #8177f2))) 70%, #000);
        clip-path: polygon(0 0, 100% 0, 0 100%);
        pointer-events: none;
      }
      :host([placement="start"]) .ribbon {
        inset-inline-start: calc(-1 * var(--hy-ribbon-fold-size, var(--hy-space-4, 8px)));
        inset-inline-end: auto;
      }
      :host([placement="start"]) .fold { inset-inline-start: 0; inset-inline-end: auto; transform: scaleX(-1); }
      :host(:dir(rtl)) .fold { transform: scaleX(-1); }
      :host([placement="start"]:dir(rtl)) .fold { transform: none; }
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'wrapper';
    wrapper.part.add('wrapper');
    const content = document.createElement('div');
    content.part.add('content');
    content.append(document.createElement('slot'));
    this._ribbon.className = 'ribbon';
    this._ribbon.part.add('ribbon');
    this._text.name = 'text';
    this._text.className = 'text';
    this._text.part.add('text');
    this._text.append(this._fallback);
    const fold = document.createElement('span');
    fold.className = 'fold';
    fold.part.add('fold');
    fold.setAttribute('aria-hidden', 'true');
    this._ribbon.append(this._text, fold);
    wrapper.append(content, this._ribbon);
    root.append(style, wrapper);
    this._text.addEventListener('slotchange', this._render);
  }

  connectedCallback(): void { this._render(); }
  attributeChangedCallback(): void { this._render(); }

  get text(): string { return this.getAttribute('text') ?? ''; }
  set text(value: string) { this.setAttribute('text', value); }

  get color(): string { return this.getAttribute('color')?.trim() ?? ''; }
  set color(value: string) {
    if (value.trim()) this.setAttribute('color', value.trim());
    else this.removeAttribute('color');
  }

  get placement(): HYRibbonPlacement { return this.getAttribute('placement') === 'start' ? 'start' : 'end'; }
  set placement(value: HYRibbonPlacement) { this.setAttribute('placement', value === 'start' ? 'start' : 'end'); }

  private _render = (): void => {
    if (this._fallback.textContent !== this.text) this._fallback.textContent = this.text;
    this._ribbon.hidden = !this.text.trim() && !hasSlotContent(this._text);
    if (this.color && CSS.supports('color', this.color)) this._ribbon.style.setProperty('--_hy-ribbon-color', this.color);
    else this._ribbon.style.removeProperty('--_hy-ribbon-color');
  };
}

export function defineRibbonComponents(): void {
  if (!customElements.get('hy-ribbon')) customElements.define('hy-ribbon', HYRibbon);
}
