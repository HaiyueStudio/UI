import { presentationIcon } from './internal/presentation.js';

export type HYAvatarShape = 'circle' | 'square';
export type HYAvatarSize = 'small' | 'default' | 'large' | number;
export type HYAvatarStatus = 'empty' | 'loading' | 'loaded' | 'error';
export type HYAvatarFit = 'cover' | 'contain' | 'fill';
export interface HYAvatarLoadDetail { src: string; naturalWidth: number; naturalHeight: number; }
export interface HYAvatarErrorDetail { src: string; }

/** Image avatar with text or slotted fallback and stale-request protection. */
export class HYAvatar extends HTMLElement {
  private readonly _frame = document.createElement('span');
  private readonly _imageHost = document.createElement('span');
  private readonly _fallback = document.createElement('slot');
  private readonly _text = document.createElement('span');
  private readonly _icon = presentationIcon('avatar');
  private _image: HTMLImageElement | null = null;
  private _listeners: AbortController | null = null;
  private _key = '';
  private _status: HYAvatarStatus = 'empty';
  static get observedAttributes(): string[] { return ['src', 'srcset', 'sizes', 'alt', 'text', 'shape', 'size', 'fit', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; flex: 0 0 auto; vertical-align: middle; max-width: 100%; color: var(--hy-avatar-text-color, var(--hy-active-text-color, #eef0ff)); font-family: var(--hy-font-family, system-ui, sans-serif); }
      .avatar { display: inline-grid; place-items: center; box-sizing: border-box; position: relative; width: var(--hy-avatar-size, var(--_size, 40px)); height: var(--hy-avatar-size, var(--_size, 40px)); max-width: 100%; overflow: hidden; border-radius: var(--hy-avatar-radius, 50%); background: var(--hy-avatar-bg-color, var(--hy-hover-bg-color, #242752)); line-height: 1; }
      :host([shape="square"]) .avatar { border-radius: var(--hy-avatar-radius, var(--hy-radius-md, 6px)); }
      .image-host { display: contents; } img { display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: var(--_fit, cover); }
      .fallback { display: grid; place-items: center; width: 100%; height: 100%; min-width: 0; min-height: 0; max-height: 100%; font-size: var(--hy-avatar-font-size, var(--_font-size, 16px)); font-weight: var(--hy-font-weight-semibold, 600); }
      .fallback svg { width: 64%; height: 64%; } .text { max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .fallback::slotted(*) { max-width: 100%; max-height: 100%; } [hidden] { display: none !important; }
    `;
    this._frame.className = 'avatar'; this._frame.part.add('avatar'); this._imageHost.className = 'image-host';
    this._fallback.className = 'fallback'; this._fallback.part.add('fallback'); this._text.className = 'text'; this._text.part.add('text');
    this._fallback.append(this._text, this._icon); this._frame.append(this._imageHost, this._fallback); root.append(style, this._frame);
    this._fallback.addEventListener('slotchange', this._render);
  }
  connectedCallback(): void { this._syncSource(); this._render(); }
  disconnectedCallback(): void { this._listeners?.abort(); this._listeners = null; this._key = ''; }
  attributeChangedCallback(): void { if (this.isConnected) this._syncSource(); this._render(); }
  get src(): string { return this.getAttribute('src') ?? ''; }
  set src(value: string) { this.setAttribute('src', value); }
  get alt(): string { return this.getAttribute('alt') ?? this.text; }
  set alt(value: string) { this.setAttribute('alt', value); }
  get text(): string { return this.getAttribute('text') ?? ''; }
  set text(value: string) { this.setAttribute('text', value); }
  get shape(): HYAvatarShape { return this.getAttribute('shape') === 'square' ? 'square' : 'circle'; }
  set shape(value: HYAvatarShape) { this.setAttribute('shape', value); }
  get size(): HYAvatarSize {
    const value = this.getAttribute('size');
    if (value === 'small' || value === 'large') return value;
    if (value?.trim() && Number.isFinite(Number(value))) return Math.max(16, Math.min(256, Number(value)));
    return 'default';
  }
  set size(value: HYAvatarSize) { this.setAttribute('size', String(value)); }
  get fit(): HYAvatarFit { const value = this.getAttribute('fit'); return value === 'contain' || value === 'fill' ? value : 'cover'; }
  set fit(value: HYAvatarFit) { this.setAttribute('fit', value); }
  get status(): HYAvatarStatus { return this._status; }
  private _syncSource(): void {
    const srcset = this.getAttribute('srcset') ?? ''; const sizes = this.getAttribute('sizes') ?? '';
    const key = JSON.stringify([this.src, srcset, sizes]);
    if (key === this._key) return;
    this._key = key; this._listeners?.abort(); this._listeners = null; this._imageHost.replaceChildren(); this._image = null;
    if (!this.src && !srcset) { this._status = 'empty'; return; }
    const image = document.createElement('img'); this._image = image; this._status = 'loading'; image.alt = ''; image.part.add('image');
    this._listeners = new AbortController(); const signal = this._listeners.signal;
    image.addEventListener('load', () => {
      if (this._image !== image || !this.isConnected) return;
      this._status = 'loaded'; this._render();
      this.dispatchEvent(new CustomEvent<HYAvatarLoadDetail>('avatar-load', { bubbles: true, composed: true, detail: { src: image.currentSrc || this.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } }));
    }, { signal });
    image.addEventListener('error', () => {
      if (this._image !== image || !this.isConnected) return;
      this._status = 'error'; this._render();
      this.dispatchEvent(new CustomEvent<HYAvatarErrorDetail>('avatar-error', { bubbles: true, composed: true, detail: { src: this.src || srcset } }));
    }, { signal });
    this._imageHost.append(image);
    if (sizes) image.sizes = sizes;
    if (srcset) image.srcset = srcset;
    if (this.src) image.src = this.src;
  }
  private _render = (): void => {
    const size = typeof this.size === 'number' ? this.size : this.size === 'small' ? 28 : this.size === 'large' ? 56 : 40;
    this._frame.style.setProperty('--_size', `${size}px`); this._frame.style.setProperty('--_fit', this.fit);
    const text = this.text || this._fallback.assignedNodes().map(node => node.textContent ?? '').join('').trim();
    this._frame.style.setProperty('--_font-size', `${Math.max(8, Math.min(size * .4, size * .8 / Math.max(1, [...text].length)))}px`);
    if (this._text.textContent !== this.text) this._text.textContent = this.text;
    this._text.hidden = !this.text; this._icon.style.display = this.text ? 'none' : '';
    if (this._image) this._image.hidden = this._status !== 'loaded';
    this._fallback.hidden = this._status === 'loaded';
    const decorative = this.hasAttribute('alt') && this.alt === '' && !this.getAttribute('aria-label');
    this._frame.toggleAttribute('aria-hidden', decorative);
    if (decorative) { this._frame.setAttribute('aria-hidden', 'true'); this._frame.removeAttribute('role'); this._frame.removeAttribute('aria-label'); }
    else {
      this._frame.setAttribute('role', 'img');
      this._frame.setAttribute('aria-label', this.getAttribute('aria-label') || this.alt || text || 'Avatar');
    }
  };
}
export function defineAvatarComponents(): void { if (!customElements.get('hy-avatar')) customElements.define('hy-avatar', HYAvatar); }
