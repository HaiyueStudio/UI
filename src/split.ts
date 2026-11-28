import { HYPointerDrag } from './internal/pointer-drag.js';

export type HYSplitDirection = 'horizontal' | 'vertical';

const DEFAULT_BAR_SIZE = 6;

export interface HYSplitRatioChangeDetail {
  ratio: number;
  direction: HYSplitDirection;
}

export class HYSplit extends HTMLElement {
  private readonly _style = document.createElement('style');
  private readonly _first = document.createElement('div');
  private readonly _second = document.createElement('div');
  private readonly _bar = document.createElement('div');
  private readonly _pointer = new HYPointerDrag();
  private readonly _resizeObserver = new ResizeObserver(() => this._scheduleLayout());
  private _layoutFrame = 0;

  static get observedAttributes(): string[] {
    return ['direction', 'ratio', 'min-first', 'min-second', 'bar-size', 'disabled'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this._style.textContent = `
      :host {
        box-sizing: border-box;
        display: grid;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        color: var(--hy-split-text-color, var(--hy-text-color, #d8e2f2));
        background: var(--hy-split-bg-color, var(--hy-surface-color, #121822));
      }
      .pane {
        min-width: 0;
        min-height: 0;
        overflow: auto;
        background: var(--hy-split-pane-bg-color, transparent);
      }
      .bar {
        box-sizing: border-box;
        min-width: 0;
        min-height: 0;
        background: var(--hy-split-bar-color, var(--hy-border-strong-color, #273142));
        border: var(--hy-split-bar-border, 0);
        border-radius: var(--hy-split-bar-radius, 0);
        position: relative;
        z-index: 1;
        touch-action: none;
        user-select: none;
        transition: background var(--hy-split-bar-transition-duration, 0.12s) ease;
      }
      .bar:focus {
        outline: var(--hy-split-focus-ring-width, 1px) solid var(--hy-split-focus-ring-color, var(--hy-focus-border-color, var(--hy-accent-color, #3d6fa8)));
        outline-offset: -1px;
      }
      .bar:hover {
        background: var(--hy-split-bar-hover-color, var(--hy-split-bar-active-color, var(--hy-accent-color, #3d6fa8)));
      }
      .bar.dragging {
        background: var(--hy-split-bar-drag-color, var(--hy-split-bar-active-color, var(--hy-accent-color, #3d6fa8)));
      }
      .handle { position: absolute; inset: 0; display: grid; grid-template: minmax(0, 1fr) / minmax(0, 1fr); place-items: center; pointer-events: none; color: var(--hy-split-handle-color, var(--hy-muted-color, #8fa7c8)); }
      .bar:hover .handle, .bar.dragging .handle { color: var(--hy-split-handle-active-color, var(--hy-text-color, #d8e2f2)); }
      :host([direction="vertical"]) .bar {
        cursor: row-resize;
      }
      :host(:not([direction="vertical"])) .bar {
        cursor: col-resize;
      }
      :host([direction="vertical"]) .bar::before {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: calc(var(--hy-split-bar-hit-outset, 3px) * -1);
        bottom: calc(var(--hy-split-bar-hit-outset, 3px) * -1);
      }
      :host(:not([direction="vertical"])) .bar::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: calc(var(--hy-split-bar-hit-outset, 3px) * -1);
        right: calc(var(--hy-split-bar-hit-outset, 3px) * -1);
      }
      :host([disabled]) .bar { cursor: default; background: var(--hy-split-bar-disabled-color, var(--hy-split-bar-color, var(--hy-border-strong-color, #273142))); opacity: var(--hy-split-bar-disabled-opacity, .5); }
      :host([disabled]) .bar::before { pointer-events: none; }
      :host([disabled]) .handle { color: var(--hy-split-handle-disabled-color, var(--hy-disabled-text-color, #8fa7c8)); }
      @media (prefers-reduced-motion: reduce) { .bar { transition: none; } }
    `;

    this._first.className = 'pane first';
    this._first.part.add('pane', 'first');
    this._second.className = 'pane second';
    this._second.part.add('pane', 'second');
    this._bar.className = 'bar';
    this._bar.part.add('bar');
    this._bar.tabIndex = 0;
    this._bar.setAttribute('role', 'separator');
    this._bar.setAttribute('aria-valuemin', '0');
    this._bar.setAttribute('aria-valuemax', '100');
    this._first.append(this._createSlot('first'));
    this._second.append(this._createSlot('second'));
    const handle = document.createElement('span');
    handle.className = 'handle'; handle.part.add('handle'); handle.inert = true; handle.setAttribute('aria-hidden', 'true');
    handle.append(this._createSlot('handle')); this._bar.append(handle);
    root.append(this._style, this._first, this._bar, this._second);
  }

  connectedCallback(): void {
    if (!this.hasAttribute('direction')) this.setAttribute('direction', 'horizontal');
    if (!this.hasAttribute('ratio')) this.setAttribute('ratio', '0.5');
    this._bar.addEventListener('pointerdown', this._onPointerDown);
    this._bar.addEventListener('keydown', this._onKeyDown);
    this._resizeObserver.observe(this);
    this._syncAria();
    this._scheduleLayout();
  }

  disconnectedCallback(): void {
    this._pointer.cancel();
    this._resizeObserver.disconnect();
    this._bar.removeEventListener('pointerdown', this._onPointerDown);
    this._bar.removeEventListener('keydown', this._onKeyDown);
    if (this._layoutFrame) {
      cancelAnimationFrame(this._layoutFrame);
      this._layoutFrame = 0;
    }
  }

  attributeChangedCallback(): void {
    if (this.disabled) this._pointer.cancel();
    this._syncAria();
    this._scheduleLayout();
  }

  get direction(): HYSplitDirection {
    return this.getAttribute('direction') === 'vertical' ? 'vertical' : 'horizontal';
  }

  set direction(value: HYSplitDirection) {
    this.setAttribute('direction', value);
  }

  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }

  get ratio(): number {
    return this._clampRatio(Number(this.getAttribute('ratio') ?? 0.5));
  }

  set ratio(value: number) {
    this.setAttribute('ratio', String(this._clampRatio(value)));
  }

  get minFirst(): number {
    return Math.max(0, Number(this.getAttribute('min-first') ?? 80));
  }

  set minFirst(value: number) {
    this.setAttribute('min-first', String(Math.max(0, value)));
  }

  get minSecond(): number {
    return Math.max(0, Number(this.getAttribute('min-second') ?? 80));
  }

  set minSecond(value: number) {
    this.setAttribute('min-second', String(Math.max(0, value)));
  }

  get barSize(): number {
    const value = Number(this.getAttribute('bar-size') ?? DEFAULT_BAR_SIZE);
    return Number.isFinite(value) ? Math.max(1, value) : DEFAULT_BAR_SIZE;
  }

  set barSize(value: number) {
    this.setAttribute('bar-size', String(Math.max(1, value)));
  }

  private _createSlot(name: string): HTMLSlotElement {
    const slot = document.createElement('slot');
    slot.name = name;
    return slot;
  }

  private _onPointerDown = (event: PointerEvent): void => {
    if (this.disabled || event.defaultPrevented) return;
    if (this._pointer.start(event, this._bar, {
      start: () => { this._bar.classList.add('dragging'); this._bar.part.add('bar-active'); return true; },
      move: this._onPointerMove,
      end: () => { this._bar.classList.remove('dragging'); this._bar.part.remove('bar-active'); },
    })) event.stopPropagation();
  };

  private _onPointerMove = (event: PointerEvent): void => {
    if (this.disabled) return;
    const rect = this.getBoundingClientRect();
    const size = this._getLayoutSize();
    const available = this._getAvailablePaneSize(size);
    if (available <= 0) return;

    // Pointer coordinates and DOMRect are visual (and may be transformed or
    // fractional), while CSS layout consumers usually observe integer
    // clientWidth/clientHeight. Map between the two coordinate spaces before
    // snapping the divider to the layout pixel grid.
    const visualSize = this.direction === 'vertical' ? rect.height : rect.width;
    const visualOffset = this.direction === 'vertical'
      ? event.clientY - rect.top
      : event.clientX - rect.left;
    const offset = visualSize > 0 ? visualOffset * size / visualSize : 0;
    const firstSize = this._snapFirstSize(
      offset - this._getLayoutBarSize() / 2,
      available,
    );
    this.ratio = firstSize / available;
    this._emitRatioChange();
  };

  private _onKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented) return;
    const direction = this.direction;
    const backward = direction === 'vertical' ? event.key === 'ArrowUp' : event.key === 'ArrowLeft';
    const forward = direction === 'vertical' ? event.key === 'ArrowDown' : event.key === 'ArrowRight';
    if (!backward && !forward && event.key !== 'Home' && event.key !== 'End') return;

    event.preventDefault();
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === 'Home') this.ratio = 0;
    else if (event.key === 'End') this.ratio = 1;
    else this.ratio = this.ratio + (forward ? step : -step);
    this._emitRatioChange();
  };

  private _applyLayout(): void {
    this._layoutFrame = 0;
    const size = this._getLayoutSize();
    const available = this._getAvailablePaneSize(size);
    const firstSize = available > 0 ? this._snapFirstSize(this.ratio * available, available) : 0;
    const secondSize = Math.max(0, available - firstSize);
    const barSize = `${this._getLayoutBarSize()}px`;
    if (this.direction === 'vertical') {
      this.style.gridTemplateColumns = 'minmax(0, 1fr)';
      this.style.gridTemplateRows = `${firstSize}px ${barSize} minmax(0, ${secondSize}px)`;
    } else {
      this.style.gridTemplateRows = 'minmax(0, 1fr)';
      this.style.gridTemplateColumns = `${firstSize}px ${barSize} minmax(0, ${secondSize}px)`;
    }
    this._syncAria();
  }

  private _clampRatio(value: number): number {
    if (!Number.isFinite(value)) return 0.5;
    return Math.max(0, Math.min(1, value));
  }

  private _scheduleLayout(): void {
    if (!this.isConnected) return;
    if (this._layoutFrame) return;
    this._layoutFrame = requestAnimationFrame(() => this._applyLayout());
  }

  private _syncAria(): void {
    const direction = this.direction;
    this._bar.setAttribute('aria-orientation', direction === 'vertical' ? 'horizontal' : 'vertical');
    this._bar.setAttribute('aria-valuenow', String(Math.round(this.ratio * 100)));
    this._bar.setAttribute('aria-disabled', String(this.disabled));
    this._bar.tabIndex = this.disabled ? -1 : 0;
  }

  private _emitRatioChange(): void {
    this._syncAria();
    this.dispatchEvent(new CustomEvent<HYSplitRatioChangeDetail>('ratio-change', {
      detail: { ratio: this.ratio, direction: this.direction },
      bubbles: true,
      composed: true,
    }));
  }

  private _getAvailablePaneSize(size: number): number {
    return Math.max(0, size - this._getLayoutBarSize());
  }

  private _getLayoutSize(): number {
    return this.direction === 'vertical' ? this.clientHeight : this.clientWidth;
  }

  private _getLayoutBarSize(): number {
    return Math.max(1, Math.round(this.barSize));
  }

  private _snapFirstSize(value: number, available: number): number {
    if (available <= 0) return 0;
    const clamped = this._clampFirstSize(value, available);
    const minFirst = Math.ceil(Math.min(this.minFirst, available));
    const minSecond = Math.ceil(Math.min(this.minSecond, Math.max(0, available - minFirst)));
    const maxFirst = Math.max(minFirst, available - minSecond);
    return Math.max(minFirst, Math.min(maxFirst, Math.round(clamped)));
  }

  private _clampFirstSize(value: number, available: number): number {
    if (available <= 0) return 0;
    const minFirst = Math.min(this.minFirst, available);
    const minSecond = Math.min(this.minSecond, Math.max(0, available - minFirst));
    const maxFirst = Math.max(minFirst, available - minSecond);
    return Math.max(minFirst, Math.min(maxFirst, value));
  }
}

export function defineSplitComponents(): void {
  if (!customElements.get('hy-split')) {
    customElements.define('hy-split', HYSplit);
  }
}
