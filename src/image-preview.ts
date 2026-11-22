import { HYImageViewer, normalizePreviewItems } from './internal/image-viewer.js';
import type { HYImagePreviewItem, HYImagePreviewOpenDetail, HYImagePreviewChangeDetail } from './internal/image-viewer.js';
export type { HYImagePreviewItem, HYImagePreviewOpenDetail, HYImagePreviewChangeDetail } from './internal/image-viewer.js';
export class HYImagePreview extends HTMLElement {
  private readonly _viewer: HYImageViewer;
  private _images: HYImagePreviewItem[] = [];
  private _reflecting = false;
  static get observedAttributes(): string[] { return ['images', 'open', 'current', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' });
    this._viewer = new HYImageViewer(this, root, detail => { this._reflecting = true; this.toggleAttribute('open', detail.open); this._reflecting = false; this.dispatchEvent(new CustomEvent<HYImagePreviewOpenDetail>('open-change', { detail, bubbles: true, composed: true })); }, detail => { this._reflecting = true; this.setAttribute('current', String(detail.index)); this._reflecting = false; this.dispatchEvent(new CustomEvent<HYImagePreviewChangeDetail>('preview-change', { detail, bubbles: true, composed: true })); });
  }
  connectedCallback(): void { this._sync(); }
  disconnectedCallback(): void { this._viewer.dispose(); }
  attributeChangedCallback(name: string, previous: string | null, next: string | null): void { if (this._reflecting || previous === next) return; if (name === 'images') { let value: unknown = []; try { value = JSON.parse(next ?? '[]'); } catch { /* Invalid lists are empty. */ } this._images = normalizePreviewItems(value); } this._sync(); }
  get images(): HYImagePreviewItem[] { return this._images.map(item => ({ ...item })); }
  set images(value: (HYImagePreviewItem | string)[]) { this._images = normalizePreviewItems(value); this._sync(); }
  get current(): number { const value = Number(this.getAttribute('current')); return Number.isFinite(value) ? Math.max(0, Math.min(this._images.length - 1, Math.floor(value))) : 0; }
  set current(value: number) { this.setAttribute('current', String(value)); }
  get open(): boolean { return this.hasAttribute('open'); }
  set open(value: boolean) { this.toggleAttribute('open', value); }
  show(index = this.current): void { this.current = index; this.open = true; }
  hide(): void { this.open = false; }
  private _sync(): void { this._viewer.setItems(this._images, this.current); this._viewer.dialog.setAttribute('aria-label', this.getAttribute('aria-label') || 'Image preview'); if (this.isConnected && this.open && this._images.length) this._viewer.show(); else this._viewer.close(); }
}
export function defineImagePreviewComponents(): void { if (!customElements.get('hy-image-preview')) customElements.define('hy-image-preview', HYImagePreview); }
