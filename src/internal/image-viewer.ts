export interface HYImagePreviewItem { src: string; alt?: string; caption?: string; }
export interface HYImagePreviewChangeDetail { index: number; item: HYImagePreviewItem; }
export interface HYImagePreviewOpenDetail { open: boolean; index: number; }

/** Native modal image viewer shared by isolated Image and ImagePreview entries. */
export class HYImageViewer {
  readonly dialog = document.createElement('dialog');
  private readonly _stage = document.createElement('div');
  private readonly _imageHost = document.createElement('div');
  private readonly _status = document.createElement('div');
  private readonly _caption = document.createElement('div');
  private readonly _counter = document.createElement('span');
  private readonly _buttons = new Map<string, HTMLButtonElement>();
  private _items: HYImagePreviewItem[] = [];
  private _index = 0;
  private _open = false;
  private _zoom = 1;
  private _rotation = 0;
  private _x = 0;
  private _y = 0;
  private _image: HTMLImageElement | null = null;
  private _imageListeners: AbortController | null = null;
  private _returnFocus: HTMLElement | null = null;
  private _drag: { id: number; x: number; y: number; originX: number; originY: number } | null = null;
  private _maskDown = false;

  constructor(private readonly _host: HTMLElement, root: ShadowRoot, private readonly _onOpen: (detail: HYImagePreviewOpenDetail) => void, private readonly _onChange: (detail: HYImagePreviewChangeDetail) => void) {
    const style = document.createElement('style'); style.textContent = `
      .viewer { box-sizing: border-box; flex-direction: column; width: 100vw; max-width: none; height: 100vh; height: 100dvh; max-height: none; margin: 0; padding: var(--hy-space-6, 12px); border: 0; color: var(--hy-image-preview-text-color, var(--hy-selected-text-color, #fff)); background: var(--hy-image-preview-bg, rgba(12,16,24,.94)); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); overflow: hidden; overscroll-behavior: contain; }
      .viewer[open] { display: flex; } .viewer:not([open]) { display: none; } .viewer::backdrop { background: var(--hy-image-preview-mask-color, rgba(0,0,0,.65)); }
      .toolbar { display: flex; flex: 0 0 auto; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--hy-space-3, 6px); }
      .toolbar button { min-height: 32px; min-width: 32px; padding: 0 8px; border: 1px solid var(--hy-border-color, #303746); border-radius: var(--hy-radius-sm, 4px); color: var(--hy-text-color, #d8e2f2); background: var(--hy-surface-elevated-color, #202733); cursor: pointer; font: inherit; }
      .toolbar button:hover:not(:disabled) { background: var(--hy-hover-bg-color, #273241); } .toolbar button:disabled { opacity: .4; cursor: default; } .toolbar button:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 1px; }
      .stage { position: relative; display: grid; place-items: center; flex: 1 1 auto; min-height: 0; min-width: 0; overflow: hidden; touch-action: none; }
      .image-host { display: contents; } .preview-image { display: block; max-width: calc(100vw - 48px); max-height: calc(100vh - 120px); max-height: calc(100dvh - 120px); object-fit: contain; user-select: none; transform-origin: center; }
      .viewer.zoomed .preview-image { cursor: grab; } .viewer.dragging .preview-image { cursor: grabbing; } .viewer-status { position: absolute; padding: 12px; color: var(--hy-image-preview-text-color, var(--hy-selected-text-color, #fff)); }
      .caption { flex: 0 0 auto; text-align: center; padding: 4px; overflow-wrap: anywhere; } [hidden] { display: none !important; }
      @media (max-width: 480px) { .toolbar { gap: 3px; } .toolbar button { min-width: 28px; padding: 0 5px; } }
    `;
    this.dialog.className = 'viewer'; this.dialog.part.add('preview'); this.dialog.setAttribute('aria-label', 'Image preview');
    const toolbar = document.createElement('div'); toolbar.className = 'toolbar'; toolbar.part.add('toolbar');
    for (const [action, text, label] of [['previous', '‹', 'Previous image'], ['next', '›', 'Next image'], ['out', '−', 'Zoom out'], ['in', '+', 'Zoom in'], ['left', '↶', 'Rotate left'], ['right', '↷', 'Rotate right'], ['reset', '1:1', 'Reset view'], ['close', '×', 'Close preview']]) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.action = action!; button.textContent = text!; button.setAttribute('aria-label', label!); button.part.add(action!); this._buttons.set(action!, button); toolbar.append(button);
    }
    this._counter.part.add('counter'); this._counter.setAttribute('aria-live', 'polite'); toolbar.prepend(this._counter);
    this._stage.className = 'stage'; this._stage.part.add('stage'); this._imageHost.className = 'image-host'; this._status.className = 'viewer-status'; this._status.part.add('preview-status'); this._status.setAttribute('role', 'status'); this._caption.className = 'caption'; this._caption.part.add('caption');
    this._stage.append(this._imageHost, this._status); this.dialog.append(toolbar, this._stage, this._caption); root.append(style, this.dialog);
    toolbar.addEventListener('click', event => { const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-action]') : null; if (button && !button.disabled) this._act(button.dataset.action!); });
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener('close', () => { if (!this.dialog.open && this._open) this.close(); });
    this.dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
      else if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); event.stopPropagation(); this.navigate(event.key === 'ArrowLeft' ? -1 : 1); }
    });
    this._stage.addEventListener('wheel', event => { if (this._open) { event.preventDefault(); this._zoom = clamp(this._zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2), .2, 5); this._transform(); } }, { passive: false });
    this.dialog.addEventListener('pointerdown', event => { this._maskDown = event.target === this.dialog || event.target === this._stage; });
    this.dialog.addEventListener('click', event => { if (this._maskDown && (event.target === this.dialog || event.target === this._stage)) this.close(); this._maskDown = false; });
    this._stage.addEventListener('pointerdown', event => { if (event.button !== 0 || this._zoom <= 1 || event.target !== this._image) return; event.preventDefault(); this._drag = { id: event.pointerId, x: event.clientX, y: event.clientY, originX: this._x, originY: this._y }; this._stage.setPointerCapture(event.pointerId); this.dialog.classList.add('dragging'); });
    this._stage.addEventListener('pointermove', event => { if (this._drag?.id === event.pointerId) { this._x = clamp(this._drag.originX + event.clientX - this._drag.x, -5000, 5000); this._y = clamp(this._drag.originY + event.clientY - this._drag.y, -5000, 5000); this._transform(); } });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this._stage.addEventListener(type, () => this._endDrag());
  }
  get open(): boolean { return this._open; }
  get index(): number { return this._index; }
  setItems(items: HYImagePreviewItem[], index: number): void {
    index = Math.max(0, Math.min(items.length - 1, Number.isFinite(index) ? Math.floor(index) : 0));
    const changed = index !== this._index || JSON.stringify(items) !== JSON.stringify(this._items); this._items = items.map(item => ({ ...item })); this._index = index;
    if (!items.length) { this.close(); return; } if (changed && this._open) this._render();
  }
  show(): void {
    if (this._open || !this._items.length || !this._host.isConnected) return;
    let active = this._host.ownerDocument.activeElement; while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    this._returnFocus = active instanceof HTMLElement ? active : null; this._open = true; this._render();
    this.dialog.showModal(); this._buttons.get('close')!.focus({ preventScroll: true }); this._onOpen({ open: true, index: this._index });
  }
  close(notify = true): void {
    if (!this._open) return;
    this._open = false; this._endDrag(); this._imageListeners?.abort(); this._imageListeners = null;
    if (this.dialog.open) this.dialog.close(); const focus = this._returnFocus; this._returnFocus = null;
    if (this._host.isConnected && focus?.isConnected) focus.focus({ preventScroll: true });
    if (notify && this._host.isConnected) this._onOpen({ open: false, index: this._index });
  }
  dispose(): void { this.close(false); this._imageListeners?.abort(); this._imageListeners = null; }
  navigate(delta: number): void { if (this._items.length <= 1) return; this._index = (this._index + delta + this._items.length) % this._items.length; this._render(); this._onChange({ index: this._index, item: { ...this._items[this._index]! } }); }
  private _act(action: string): void {
    if (action === 'close') this.close(); else if (action === 'previous' || action === 'next') this.navigate(action === 'previous' ? -1 : 1);
    else { if (action === 'in') this._zoom = clamp(this._zoom + .2, .2, 5); else if (action === 'out') this._zoom = clamp(this._zoom - .2, .2, 5); else if (action === 'left') this._rotation -= 90; else if (action === 'right') this._rotation += 90; else if (action === 'reset') { this._zoom = 1; this._rotation = 0; this._x = this._y = 0; } this._transform(); }
  }
  private _render(): void {
    const item = this._items[this._index]; if (!item) return;
    this._endDrag(); this._zoom = 1; this._rotation = this._x = this._y = 0;
    this._counter.textContent = `${this._index + 1} / ${this._items.length}`; this._caption.textContent = item.caption ?? ''; this._caption.hidden = !item.caption;
    this._buttons.get('previous')!.disabled = this._buttons.get('next')!.disabled = this._items.length <= 1;
    this._imageListeners?.abort(); this._imageListeners = new AbortController(); const { signal } = this._imageListeners;
    const image = document.createElement('img'); image.className = 'preview-image'; image.part.add('preview-image'); image.alt = item.alt ?? ''; image.draggable = false;
    this._image = image; this._status.textContent = 'Loading image…'; this._status.hidden = false;
    image.addEventListener('load', () => { this._status.hidden = true; }, { signal });
    image.addEventListener('error', () => { image.hidden = true; this._status.textContent = 'Image unavailable'; this._status.hidden = false; }, { signal });
    this._imageHost.replaceChildren(image); image.src = item.src; this._transform();
  }
  private _transform(): void { if (this._image) this._image.style.transform = `translate(${this._x}px, ${this._y}px) rotate(${this._rotation}deg) scale(${this._zoom})`; this.dialog.classList.toggle('zoomed', this._zoom > 1); this._buttons.get('in')!.disabled = this._zoom >= 5; this._buttons.get('out')!.disabled = this._zoom <= .2; }
  private _endDrag(): void { const drag = this._drag; this._drag = null; if (drag && this._stage.hasPointerCapture(drag.id)) this._stage.releasePointerCapture(drag.id); this.dialog.classList.remove('dragging'); }
}
export function normalizePreviewItems(value: unknown): HYImagePreviewItem[] { return Array.isArray(value) ? value.flatMap(item => typeof item === 'string' && item ? [{ src: item }] : item && typeof item.src === 'string' && item.src ? [{ src: item.src, ...(typeof item.alt === 'string' ? { alt: item.alt } : {}), ...(typeof item.caption === 'string' ? { caption: item.caption } : {}) }] : []) : []; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
