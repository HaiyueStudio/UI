import { hasSlotContent, presentationIcon } from './internal/presentation.js';

export type HYEmptyImage = 'default' | 'simple' | 'none';
export type HYEmptySize = 'small' | 'default';

/** Empty-state illustration, description and slotted actions. */
export class HYEmpty extends HTMLElement {
  private readonly _image = document.createElement('slot');
  private readonly _description = document.createElement('slot');
  private readonly _actions = document.createElement('slot');
  static get observedAttributes(): string[] { return ['description', 'image', 'size']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-secondary-text-color, #a9add4); font: var(--hy-font-size-sm, 12px)/var(--hy-line-height-relaxed, 1.5) var(--hy-font-family, system-ui, sans-serif); }
      .empty { display: flex; flex-direction: column; align-items: center; gap: var(--hy-space-6, 12px); padding: var(--hy-empty-padding, var(--hy-space-12, 24px)); text-align: center; overflow-wrap: anywhere; }
      .image { display: flex; justify-content: center; width: var(--hy-empty-image-size, 80px); max-width: 100%; color: var(--hy-empty-image-color, var(--hy-muted-color, #777baf)); }
      .image svg { width: 100%; height: auto; } .image::slotted(*) { max-width: 100%; max-height: var(--hy-empty-image-size, 80px); object-fit: contain; }
      :host([image="simple"]) .image { width: 48px; opacity: .65; }
      :host([size="small"]) .empty { gap: var(--hy-space-3, 6px); padding: var(--hy-space-6, 12px); }
      :host([size="small"]) .image { width: 40px; }
      .description { display: block; max-width: 100%; } .actions { display: flex; justify-content: center; flex-wrap: wrap; gap: var(--hy-space-4, 8px); }
      [hidden] { display: none !important; }
    `;
    const surface = document.createElement('div'); surface.className = 'empty'; surface.part.add('empty');
    this._image.name = 'image'; this._image.className = 'image'; this._image.part.add('image'); this._image.append(presentationIcon('empty'));
    this._description.name = 'description'; this._description.className = 'description'; this._description.part.add('description');
    this._actions.className = 'actions'; this._actions.part.add('actions');
    surface.append(this._image, this._description, this._actions); root.append(style, surface);
    for (const slot of [this._image, this._description, this._actions]) slot.addEventListener('slotchange', this._render);
  }
  connectedCallback(): void { this._render(); }
  attributeChangedCallback(): void { this._render(); }
  get description(): string { return this.getAttribute('description') ?? 'No data'; }
  set description(value: string) { this.setAttribute('description', value); }
  get image(): HYEmptyImage { const value = this.getAttribute('image'); return value === 'simple' || value === 'none' ? value : 'default'; }
  set image(value: HYEmptyImage) { this.setAttribute('image', value); }
  get size(): HYEmptySize { return this.getAttribute('size') === 'small' ? 'small' : 'default'; }
  set size(value: HYEmptySize) { this.setAttribute('size', value); }
  private _render = (): void => {
    this._image.hidden = this.image === 'none';
    if (this._description.textContent !== this.description) this._description.textContent = this.description;
    this._description.hidden = !this.description && !hasSlotContent(this._description);
    this._actions.hidden = !hasSlotContent(this._actions);
  };
}
export function defineEmptyComponents(): void { if (!customElements.get('hy-empty')) customElements.define('hy-empty', HYEmpty); }
