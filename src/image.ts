import { HYImageViewer } from './internal/image-viewer.js';
import type { HYImagePreviewOpenDetail } from './internal/image-viewer.js';
export type HYImageStatus = 'empty' | 'loading' | 'loaded' | 'error';
export interface HYImageLoadDetail { src: string; naturalWidth: number; naturalHeight: number; }
export interface HYImageErrorDetail { src: string; fallback: boolean; }
export class HYImage extends HTMLElement {
  private readonly _frame = document.createElement('div');
  private readonly _imageHost = document.createElement('span');
  private readonly _placeholder = document.createElement('slot');
  private readonly _error = document.createElement('slot');
  private readonly _preview = document.createElement('button');
  private readonly _viewer: HYImageViewer;
  private _image: HTMLImageElement | null = null;
  private _loadListeners: AbortController | null = null;
  private _status: HYImageStatus = 'empty';
  private _sourceKey = '';
  private _usedFallback = false;
  static get observedAttributes(): string[] { return ['src', 'srcset', 'sizes', 'alt', 'fallback', 'width', 'height', 'fit', 'loading', 'preview', 'preview-src', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; max-width: 100%; vertical-align: middle; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      .frame { display: grid; position: relative; max-width: 100%; min-width: 32px; min-height: 32px; overflow: hidden; border-radius: var(--hy-image-radius, var(--hy-radius-sm, 4px)); background: var(--hy-image-bg, var(--hy-surface-color, #121822)); }
      .image-host { display: contents; } .image { display: block; width: 100%; height: 100%; max-width: 100%; object-fit: var(--_fit, contain); }
      .placeholder, .error { position: absolute; inset: 0; display: grid; place-items: center; padding: 8px; text-align: center; color: var(--hy-muted-text-color, #8290a3); background: var(--hy-image-bg, var(--hy-surface-color, #121822)); }
      .preview-trigger { position: absolute; inset: 0; width: 100%; padding: 0; border: 0; border-radius: inherit; color: var(--hy-selected-text-color, #fff); background: transparent; cursor: zoom-in; font: inherit; }
      .preview-trigger span { opacity: 0; padding: 5px 10px; border-radius: var(--hy-radius-sm, 4px); background: var(--hy-image-preview-mask-color, rgba(0,0,0,.6)); }
      .preview-trigger:hover span, .preview-trigger:focus-visible span { opacity: 1; } .preview-trigger:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: -2px; } [hidden] { display: none !important; }
    `;
    this._frame.className = 'frame'; this._frame.part.add('frame'); this._imageHost.className = 'image-host';
    this._placeholder.name = 'placeholder'; this._placeholder.className = 'placeholder'; this._placeholder.part.add('placeholder'); this._placeholder.textContent = 'Loading…'; this._placeholder.setAttribute('role', 'status');
    this._error.name = 'fallback'; this._error.className = 'error'; this._error.part.add('error'); this._error.textContent = 'Image unavailable'; this._error.setAttribute('role', 'img');
    this._preview.type = 'button'; this._preview.className = 'preview-trigger'; this._preview.part.add('preview-trigger'); const label = document.createElement('span'); label.textContent = 'Preview'; this._preview.append(label);
    this._frame.append(this._imageHost, this._placeholder, this._error, this._preview); root.append(style, this._frame);
    this._viewer = new HYImageViewer(this, root, detail => this.dispatchEvent(new CustomEvent<HYImagePreviewOpenDetail>('preview-open-change', { detail, bubbles: true, composed: true })), () => {});
    this._preview.addEventListener('click', () => this.showPreview());
  }
  connectedCallback(): void { this._sourceKey = ''; this._sync(); }
  disconnectedCallback(): void { this._loadListeners?.abort(); this._loadListeners = null; this._viewer.dispose(); }
  attributeChangedCallback(): void { this._sync(); }
  get src(): string { return this.getAttribute('src') ?? ''; }
  set src(value: string) { this.setAttribute('src', value); }
  get alt(): string { return this.getAttribute('alt') ?? ''; }
  set alt(value: string) { this.setAttribute('alt', value); }
  get fallback(): string { return this.getAttribute('fallback') ?? ''; }
  set fallback(value: string) { this.setAttribute('fallback', value); }
  get preview(): boolean { return this.getAttribute('preview') !== 'false'; }
  set preview(value: boolean) { this.setAttribute('preview', String(value)); }
  get previewSrc(): string { return this.getAttribute('preview-src') || (this._usedFallback ? this.fallback : this._image?.currentSrc || this.src); }
  set previewSrc(value: string) { this.setAttribute('preview-src', value); }
  get width(): string { return this.getAttribute('width') ?? ''; }
  set width(value: string | number) { this.setAttribute('width', String(value)); }
  get height(): string { return this.getAttribute('height') ?? ''; }
  set height(value: string | number) { this.setAttribute('height', String(value)); }
  get fit(): string { return this.getAttribute('fit') ?? 'contain'; }
  set fit(value: string) { this.setAttribute('fit', value); }
  get loading(): 'lazy' | 'eager' { return this.getAttribute('loading') === 'lazy' ? 'lazy' : 'eager'; }
  set loading(value: 'lazy' | 'eager') { this.setAttribute('loading', value); }
  get status(): HYImageStatus { return this._status; }
  showPreview(): void { if (this._status === 'loaded' && this.preview && this.previewSrc) { this._viewer.setItems([{ src: this.previewSrc, alt: this.alt }], 0); this._viewer.show(); } }
  hidePreview(): void { this._viewer.close(); }
  private _sync(): void {
    for (const name of ['width', 'height'] as const) { const value = this.getAttribute(name) ?? ''; this._frame.style[name] = /^\d+(\.\d+)?$/u.test(value) ? `${value}px` : value && CSS.supports(name, value) ? value : ''; }
    this._frame.style.setProperty('--_fit', ['contain', 'cover', 'fill', 'none', 'scale-down'].includes(this.fit) ? this.fit : 'contain');
    const key = JSON.stringify([this.src, this.getAttribute('srcset'), this.getAttribute('sizes'), this.fallback]);
    if (this.isConnected && key !== this._sourceKey) { this._sourceKey = key; this._usedFallback = false; this._viewer.close(); this._load(this.src, false); }
    if (this._image) { this._image.alt = this.alt; this._image.loading = this.loading; }
    this._placeholder.hidden = this._status !== 'loading'; this._error.hidden = this._status !== 'error' && this._status !== 'empty'; this._error.setAttribute('aria-label', this.alt || 'Image unavailable');
    this._preview.hidden = !this.preview || this._status !== 'loaded'; this._preview.setAttribute('aria-label', this.getAttribute('aria-label') || `Preview ${this.alt || 'image'}`);
    this._frame.setAttribute('aria-busy', String(this._status === 'loading')); if (!this.preview) this._viewer.close();
  }
  private _load(src: string, fallback: boolean): void {
    this._loadListeners?.abort(); this._loadListeners = new AbortController(); const { signal } = this._loadListeners;
    this._imageHost.replaceChildren(); this._image = null;
    if (!src && (fallback || !this.getAttribute('srcset'))) { this._status = 'empty'; this._sync(); return; }
    this._status = 'loading'; const image = document.createElement('img'); image.className = 'image'; image.part.add('image'); image.alt = this.alt; image.loading = this.loading; image.decoding = 'async'; this._image = image;
    if (!fallback) { image.srcset = this.getAttribute('srcset') ?? ''; image.sizes = this.getAttribute('sizes') ?? ''; }
    image.addEventListener('load', () => { if (this._image !== image) return; this._status = 'loaded'; this._sync(); this.dispatchEvent(new CustomEvent<HYImageLoadDetail>('image-load', { detail: { src: image.currentSrc || src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }, bubbles: true, composed: true })); }, { signal });
    image.addEventListener('error', () => {
      this.dispatchEvent(new CustomEvent<HYImageErrorDetail>('image-error', { detail: { src, fallback }, bubbles: true, composed: true }));
      if (this._image !== image) return;
      if (!fallback && this.fallback && this.fallback !== src) { this._usedFallback = true; this._load(this.fallback, true); } else { this._status = 'error'; image.hidden = true; this._sync(); }
    }, { signal });
    this._imageHost.append(image); if (src) image.src = src; this._sync();
  }
}
export function defineImageComponents(): void { if (!customElements.get('hy-image')) customElements.define('hy-image', HYImage); }
