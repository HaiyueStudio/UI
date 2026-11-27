import { HYPointerDrag, dragTargetAllowed } from './internal/pointer-drag.js';
import { activeDrag, beginDrag, cancelDragSource, finishDrag, moveDrag } from './internal/drag-drop.js';
import type { HYDragPayload, HYDragEndDetail } from './internal/drag-drop.js';
import { isKeyboardControlEvent } from './internal/keyboard.js';
let instructionSequence = 0;

export type { HYDragPayload, HYDragEndDetail } from './internal/drag-drop.js';

/** Application data source for pointer, touch and keyboard drag-and-drop. */
export class HYDragSource extends HTMLElement {
  private readonly _surface = document.createElement('div');
  private readonly _pointer = new HYPointerDrag();
  private readonly _instructions = document.createElement('div');
  private _data: unknown;
  static get observedAttributes(): string[] { return ['type', 'value', 'effect', 'disabled', 'handle', 'aria-label']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; min-width: 0; max-width: 100%; touch-action: none; }
      :host([hidden]) { display: none !important; }
      .surface { cursor: grab; touch-action: none; border-radius: var(--hy-radius-md, 6px); }
      .surface:focus-visible { outline: 2px solid var(--hy-focus-border-color, #8177f2); outline-offset: 2px; }
      :host([dragging]) .surface { opacity: .55; cursor: grabbing; }
      :host([disabled]) .surface { cursor: default; }
      .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    `;
    this._surface.className = 'surface'; this._surface.part.add('surface');
    this._surface.setAttribute('role', 'group'); this._surface.append(document.createElement('slot'));
    this._instructions.id = `hy-drag-instructions-${++instructionSequence}`; this._instructions.className = 'sr';
    this._instructions.setAttribute('role', 'status'); this._instructions.setAttribute('aria-live', 'polite');
    this._instructions.textContent = 'Press Space to pick up, Tab to a drop zone, Enter to drop, and Escape to cancel.';
    this._surface.setAttribute('aria-describedby', this._instructions.id);
    root.append(style, this._surface, this._instructions);
    this.addEventListener('pointerdown', event => {
      if (this.disabled || !dragTargetAllowed(event, this, this.handle)) return;
      if (this._pointer.start(event, this._surface, {
        start: () => this._begin('pointer'),
        move: move => moveDrag(this.ownerDocument, move.clientX, move.clientY),
        end: (up, cancelled) => {
          if (!cancelled) moveDrag(this.ownerDocument, up.clientX, up.clientY);
          finishDrag(this.ownerDocument, cancelled);
        },
      }, 6)) event.stopPropagation();
    });
    this._surface.addEventListener('dragstart', event => event.preventDefault());
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
  attributeChangedCallback(): void {
    if (this.disabled) { this._pointer.cancel(); cancelDragSource(this); }
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
  override focus(options?: FocusOptions): void { this._surface.focus(options); }

  private _sync(): void {
    this._surface.tabIndex = this.disabled ? -1 : 0;
    this._surface.setAttribute('aria-disabled', String(this.disabled));
    this._surface.setAttribute('aria-label', this.getAttribute('aria-label') || 'Drag source. Press Space to pick up, Tab to a drop zone, and Enter to drop.');
  }

  private _begin(input: HYDragPayload['input']): boolean {
    if (this.disabled || !this.isConnected || activeDrag(this.ownerDocument)) return false;
    const payload: HYDragPayload = { type: this.type, data: this.data, source: this, effect: this.effect, input };
    if (!this.dispatchEvent(new CustomEvent<HYDragPayload>('drag-start', { detail: payload, bubbles: true, composed: true, cancelable: true })) || this.disabled || !this.isConnected) return false;
    const started = beginDrag(payload, detail => {
      this._pointer.cancel(); this.removeAttribute('dragging');
      this._instructions.textContent = detail.accepted ? 'Item dropped.' : 'Drag ended without a drop. Press Space to pick up again.';
      if (detail.cancelled && detail.input === 'keyboard' && this.isConnected) this.focus({ preventScroll: true });
      this.dispatchEvent(new CustomEvent<HYDragEndDetail>('drag-end', { detail, bubbles: true, composed: true }));
    });
    if (started) { this.setAttribute('dragging', ''); this._instructions.textContent = 'Picked up. Tab to a drop zone, Enter to drop, or Escape to cancel.'; this.focus({ preventScroll: true }); }
    return started;
  }
}

export function defineDragSourceComponents(): void {
  if (!customElements.get('hy-drag-source')) customElements.define('hy-drag-source', HYDragSource);
}
