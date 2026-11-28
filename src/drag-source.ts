import { HYPointerDrag, dragTargetAllowed } from './internal/pointer-drag.js';
import { activeDrag, beginDrag, cancelDragSource, composedContains, finishDrag, moveDrag } from './internal/drag-drop.js';
import type { HYDragPayload, HYDragEndDetail } from './internal/drag-drop.js';
import { cloneDragPreview, customDragPreview, liveDragPreview, previewSnapshot, textDragPreview } from './internal/drag-preview.js';
import type { HYDragPoint, HYDragPreview } from './internal/drag-preview.js';
import { finiteNumber } from './internal/numbers.js';
import { isKeyboardControlEvent } from './internal/keyboard.js';
let instructionSequence = 0;

export type { HYDragPayload, HYDragEndDetail } from './internal/drag-drop.js';
export type HYDragSourcePreview = 'text' | 'clone' | 'custom' | 'move';
export type HYDragSourcePreviewRenderer = (payload: HYDragPayload) => HTMLElement | null;

/** Application data source for pointer, touch and keyboard drag-and-drop. */
export class HYDragSource extends HTMLElement {
  private readonly _surface = document.createElement('div');
  private readonly _pointer = new HYPointerDrag();
  private readonly _instructions = document.createElement('div');
  private readonly _previewContent = document.createElement('div');
  private readonly _previewSlot = document.createElement('slot');
  private readonly _renderSlot = document.createElement('slot');
  private _renderPreview: HYDragSourcePreviewRenderer | null = null;
  private _data: unknown;
  static get observedAttributes(): string[] { return ['type', 'value', 'effect', 'disabled', 'handle', 'aria-label', 'hidden', 'preview', 'preview-opacity', 'source-opacity']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; min-width: 0; max-width: 100%; touch-action: none; }
      :host([hidden]) { display: none !important; }
      .surface { cursor: grab; touch-action: none; border-radius: var(--hy-radius-md, 6px); }
      .surface:focus-visible { outline: 2px solid var(--hy-focus-border-color, #8177f2); outline-offset: 2px; }
      :host([dragging]:not([data-hy-live-drag])) .surface { opacity: var(--_hy-drag-source-opacity, var(--hy-drag-source-opacity, .55)); cursor: grabbing; }
      :host([disabled]) .surface { cursor: default; }
      .preview-content[hidden], slot[hidden] { display: none !important; }
      .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    `;
    this._surface.className = 'surface'; this._surface.part.add('surface');
    this._surface.setAttribute('role', 'group'); this._surface.append(document.createElement('slot'));
    this._instructions.id = `hy-drag-instructions-${++instructionSequence}`; this._instructions.className = 'sr';
    this._instructions.setAttribute('role', 'status'); this._instructions.setAttribute('aria-live', 'polite');
    this._instructions.textContent = 'Press Space to pick up, Tab to a drop zone, Enter to drop, and Escape to cancel.';
    this._surface.setAttribute('aria-describedby', this._instructions.id);
    this._previewContent.className = 'preview-content'; this._previewContent.hidden = true;
    this._previewSlot.name = 'preview'; this._renderSlot.name = 'hy-drag-render-preview';
    this._previewContent.append(this._previewSlot, this._renderSlot);
    root.append(style, this._surface, this._instructions, this._previewContent);
    this.addEventListener('pointerdown', event => {
      if (this.disabled || !dragTargetAllowed(event, this, this.handle)) return;
      if (this._pointer.start(event, this._surface, {
        start: origin => this._begin('pointer', { x: origin.clientX, y: origin.clientY }),
        move: move => moveDrag(this.ownerDocument, move.clientX, move.clientY),
        end: (up, cancelled) => {
          if (!cancelled) moveDrag(this.ownerDocument, up.clientX, up.clientY);
          finishDrag(this.ownerDocument, cancelled);
        },
      }, 6)) event.stopPropagation();
    });
    this.addEventListener('dragstart', event => event.preventDefault());
    this._surface.addEventListener('keydown', event => {
      if (this.disabled || event.defaultPrevented || (isKeyboardControlEvent(event, this._surface) && !(this.handle && dragTargetAllowed(event, this, this.handle)))) return;
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      if (activeDrag(this.ownerDocument)?.source === this) finishDrag(this.ownerDocument);
      else this._begin('keyboard');
    });
  }

  connectedCallback(): void { this._sync(); }
  disconnectedCallback(): void { this._pointer.cancel(); cancelDragSource(this); this.removeAttribute('dragging'); }
  attributeChangedCallback(name = '', previous?: string | null, next?: string | null): void {
    if (arguments.length >= 3 && previous === next) return;
    if (this.disabled || this.hidden || ['preview', 'preview-opacity', 'source-opacity'].includes(name)) { this._pointer.cancel(); cancelDragSource(this); }
    this._sync();
  }
  get type(): string { return this.getAttribute('type')?.trim() || 'item'; }
  set type(value: string) { this.setAttribute('type', value); }
  get data(): unknown { return this._data === undefined ? this.getAttribute('value') : this._data; }
  set data(value: unknown) { this._data = value; }
  get effect(): 'copy' | 'move' { return this.getAttribute('effect') === 'copy' ? 'copy' : 'move'; }
  set effect(value: 'copy' | 'move') { this.setAttribute('effect', value); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', value); }
  get handle(): string { return this.getAttribute('handle') ?? ''; }
  set handle(value: string) { this.setAttribute('handle', value); }
  get preview(): HYDragSourcePreview { const value = this.getAttribute('preview'); return value === 'clone' || value === 'custom' || value === 'move' ? value : 'text'; }
  set preview(value: HYDragSourcePreview) { this.setAttribute('preview', value); }
  get previewOpacity(): number { return Math.max(0, Math.min(1, finiteNumber(this.getAttribute('preview-opacity'), this.preview === 'clone' ? .65 : 1))); }
  set previewOpacity(value: number) { this.setAttribute('preview-opacity', String(value)); }
  get sourceOpacity(): number { return Math.max(0, Math.min(1, finiteNumber(this.getAttribute('source-opacity'), .55))); }
  set sourceOpacity(value: number) { this.setAttribute('source-opacity', String(value)); }
  get renderPreview(): HYDragSourcePreviewRenderer | null { return this._renderPreview; }
  set renderPreview(value: HYDragSourcePreviewRenderer | null) {
    const next = typeof value === 'function' ? value : null;
    if (next === this._renderPreview) return;
    this._pointer.cancel(); cancelDragSource(this); this._renderPreview = next;
  }
  override focus(options?: FocusOptions): void { this._surface.focus(options); }

  private _sync(): void {
    if (this.hasAttribute('source-opacity')) this._surface.style.setProperty('--_hy-drag-source-opacity', String(this.sourceOpacity));
    else this._surface.style.removeProperty('--_hy-drag-source-opacity');
    this._surface.tabIndex = this.disabled ? -1 : 0;
    this._surface.setAttribute('aria-disabled', String(this.disabled));
    this._surface.setAttribute('aria-label', this.getAttribute('aria-label') || 'Drag source. Press Space to pick up, Tab to a drop zone, and Enter to drop.');
  }

  private _createPreview(payload: HYDragPayload, origin: HYDragPoint): HYDragPreview | null {
    const style = getComputedStyle(this);
    const opacity = this.hasAttribute('preview-opacity') ? this.previewOpacity : Math.max(0, Math.min(1, finiteNumber(style.getPropertyValue('--hy-drag-preview-opacity'), this.previewOpacity)));
    const sourceOpacity = this.hasAttribute('source-opacity') ? this.sourceOpacity : Math.max(0, Math.min(1, finiteNumber(style.getPropertyValue('--hy-drag-source-opacity'), this.sourceOpacity)));
    if (this.preview === 'text') return textDragPreview(this, opacity);
    if (this.preview === 'move') return liveDragPreview(this, origin, opacity, sourceOpacity);
    if (this.preview === 'custom') {
      let rendered: HTMLElement | null = null;
      try { rendered = this._renderPreview?.(payload) ?? null; } catch { /* An invalid renderer falls back to the source snapshot. */ }
      if (this.disabled || !this.isConnected) return null;
      if (rendered && (!(rendered instanceof HTMLElement) || composedContains(rendered, this))) rendered = null;
      if (rendered || this._previewSlot.assignedElements().length) {
        const root = this.shadowRoot!; const oldSlot = rendered?.getAttribute('slot') ?? null;
        const content = rendered?.isConnected ? previewSnapshot(rendered) : rendered;
        if (content) { content.slot = this._renderSlot.name; this.append(content); }
        this._previewSlot.hidden = Boolean(content); this._renderSlot.hidden = !content; this._previewContent.hidden = false;
        const preview = customDragPreview(this, this._previewContent, origin, opacity);
        return {
          element: preview.element,
          move: preview.move,
          destroy: () => {
            content?.remove();
            if (content && content === rendered) { if (oldSlot === null) content.removeAttribute('slot'); else content.setAttribute('slot', oldSlot); }
            this._previewContent.hidden = true; root.append(this._previewContent); preview.destroy();
          },
        };
      }
    }
    return cloneDragPreview(this, origin, opacity);
  }

  private _begin(input: HYDragPayload['input'], origin: HYDragPoint = { x: 0, y: 0 }): boolean {
    if (this.disabled || !this.isConnected || activeDrag(this.ownerDocument)) return false;
    const payload: HYDragPayload = { type: this.type, data: this.data, source: this, effect: this.effect, input };
    if (!this.dispatchEvent(new CustomEvent<HYDragPayload>('drag-start', { detail: payload, bubbles: true, composed: true, cancelable: true })) || this.disabled || !this.isConnected) return false;
    const started = beginDrag(payload, detail => {
      this._pointer.cancel(); this.removeAttribute('dragging');
      this._instructions.textContent = detail.accepted ? 'Item dropped.' : 'Drag ended without a drop. Press Space to pick up again.';
      if (detail.cancelled && detail.input === 'keyboard' && this.isConnected) this.focus({ preventScroll: true });
      this.dispatchEvent(new CustomEvent<HYDragEndDetail>('drag-end', { detail, bubbles: true, composed: true }));
    }, () => this._createPreview(payload, origin));
    if (started) { this.setAttribute('dragging', ''); this._instructions.textContent = 'Picked up. Tab to a drop zone, Enter to drop, or Escape to cancel.'; this.focus({ preventScroll: true }); }
    return started;
  }
}

export function defineDragSourceComponents(): void {
  if (!customElements.get('hy-drag-source')) customElements.define('hy-drag-source', HYDragSource);
}
