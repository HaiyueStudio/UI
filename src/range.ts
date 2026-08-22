export type HYRangeHandle = 'single' | 'lower' | 'upper';
export type HYRangeValue = number | readonly [number, number];

export interface HYRangeChangeDetail {
  readonly value: HYRangeValue;
  readonly lowerValue: number;
  readonly upperValue: number;
  readonly handle: HYRangeHandle;
}

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
const DEFAULT_STEP = 1;

/** Accessible single-value or two-handle numeric range control. */
export class HYRange extends HTMLElement {
  private readonly _stage = document.createElement('div');
  private readonly _track = document.createElement('div');
  private readonly _lowerHandle = document.createElement('button');
  private readonly _upperHandle = document.createElement('button');
  private readonly _lowerBubble = document.createElement('span');
  private readonly _upperBubble = document.createElement('span');
  private _activeHandle: HYRangeHandle = 'single';
  private _dragStartValue = '';
  private _pointerId = -1;
  private _dragAbort: AbortController | null = null;
  private _connected = false;

  static get observedAttributes(): string[] {
    return [
      'min', 'max', 'step', 'value', 'range', 'lower-value', 'upper-value',
      'disabled', 'show-value', 'aria-label',
    ];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: inline-block;
        width: var(--hy-range-width, 280px);
        min-width: 120px;
        color: var(--hy-text-color, #e8effa);
        font: 11px/1.3 system-ui, sans-serif;
        --_handle-size: var(--hy-range-handle-size, 18px);
        --_rail-height: var(--hy-range-rail-height, 5px);
      }
      :host([disabled]) { opacity: 0.5; }
      .stage {
        position: relative;
        height: max(var(--_handle-size), 22px);
        margin-inline: calc(var(--_handle-size) / 2);
        touch-action: none;
        user-select: none;
      }
      .rail,
      .track {
        position: absolute;
        top: 50%;
        right: 0;
        left: 0;
        height: var(--_rail-height);
        border-radius: var(--hy-range-rail-radius, 999px);
        transform: translateY(-50%);
      }
      .rail {
        border: var(--hy-range-rail-border, 0);
        background: var(--hy-range-rail-color, var(--hy-border-strong-color, #354154));
        box-shadow: var(--hy-range-rail-shadow, none);
      }
      .track {
        right: auto;
        background: var(--hy-range-track-color, var(--hy-accent-color, #69bff4));
        box-shadow: var(--hy-range-track-shadow, 0 0 9px color-mix(in srgb, var(--hy-range-track-color, var(--hy-accent-color, #69bff4)) 24%, transparent));
      }
      .handle {
        position: absolute;
        z-index: 2;
        top: 50%;
        display: grid;
        width: var(--_handle-size);
        height: var(--_handle-size);
        padding: 0;
        border: var(--hy-range-handle-border-width, 2px) solid var(--hy-range-handle-border-color, var(--hy-accent-color, #69bff4));
        border-radius: var(--hy-range-handle-radius, 50%);
        place-items: center;
        outline: none;
        color: var(--hy-text-color, #e8effa);
        background: var(--hy-range-handle-color, var(--hy-surface-elevated-color, #171e2a));
        box-shadow: var(--hy-range-handle-shadow, 0 2px 8px rgba(0, 0, 0, 0.28));
        cursor: grab;
        transform: translate(-50%, -50%);
        transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
        box-sizing: border-box;
      }
      .handle:hover:not(:disabled) {
        border-color: var(--hy-range-handle-hover-border-color, var(--hy-accent-strong-color, #88d8ff));
        transform: translate(-50%, -50%) scale(1.08);
      }
      .handle:focus-visible {
        box-shadow: var(--hy-range-handle-focus-shadow, 0 0 0 4px var(--hy-focus-ring-color, rgba(105, 191, 244, 0.24)));
      }
      .handle[data-active="true"] { z-index: 3; cursor: grabbing; }
      .handle:disabled { cursor: default; }
      :host(:not([range])) .lower { display: none; }
      .bubble {
        position: absolute;
        bottom: calc(100% + 8px);
        display: none;
        min-width: 24px;
        padding: 3px 6px;
        border: 1px solid var(--hy-border-color, #303746);
        border-radius: 4px;
        pointer-events: none;
        color: var(--hy-text-color, #e8effa);
        background: var(--hy-surface-elevated-color, #171e2a);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
        font: 10px/1.2 ui-monospace, monospace;
        white-space: nowrap;
      }
      :host([show-value]) .bubble { display: block; }
    `;

    this._stage.className = 'stage';
    this._stage.part.add('stage');
    const rail = document.createElement('div');
    rail.className = 'rail';
    rail.part.add('rail');
    this._track.className = 'track';
    this._track.part.add('track');
    this._configureHandle(this._lowerHandle, this._lowerBubble, 'lower');
    this._configureHandle(this._upperHandle, this._upperBubble, 'upper');
    this._stage.append(rail, this._track, this._lowerHandle, this._upperHandle);
    root.append(style, this._stage);
  }

  connectedCallback(): void {
    if (this._connected) return;
    this._connected = true;
    this._stage.addEventListener('pointerdown', this._onPointerDown);
    this._stage.addEventListener('keydown', this._onKeyDown);
    this._render();
  }

  disconnectedCallback(): void {
    if (!this._connected) return;
    this._connected = false;
    this._stage.removeEventListener('pointerdown', this._onPointerDown);
    this._stage.removeEventListener('keydown', this._onKeyDown);
    this._stopDrag();
  }

  attributeChangedCallback(): void {
    this._render();
  }

  get min(): number {
    const value = Number(this.getAttribute('min'));
    return Number.isFinite(value) ? value : DEFAULT_MIN;
  }
  set min(value: number) { this.setAttribute('min', String(finiteOr(value, DEFAULT_MIN))); }

  get max(): number {
    const value = Number(this.getAttribute('max'));
    return Number.isFinite(value) && value > this.min ? value : Math.max(DEFAULT_MAX, this.min + DEFAULT_MAX);
  }
  set max(value: number) {
    const next = finiteOr(value, DEFAULT_MAX);
    this.setAttribute('max', String(next > this.min ? next : this.min + DEFAULT_MAX));
  }

  get step(): number {
    const value = Number(this.getAttribute('step'));
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_STEP;
  }
  set step(value: number) {
    const next = finiteOr(value, DEFAULT_STEP);
    this.setAttribute('step', String(next > 0 ? next : DEFAULT_STEP));
  }

  get value(): number { return this._normalize(Number(this.getAttribute('value') ?? this.min)); }
  set value(value: number) { this.setAttribute('value', String(this._normalize(value))); }

  get range(): boolean { return this.hasAttribute('range'); }
  set range(value: boolean) { this.toggleAttribute('range', Boolean(value)); }

  get lowerValue(): number {
    return Math.min(this._normalize(Number(this.getAttribute('lower-value') ?? this.min)), this.upperValue);
  }
  set lowerValue(value: number) {
    this.setAttribute('lower-value', String(Math.min(this._normalize(value), this.upperValue)));
  }

  get upperValue(): number {
    return Math.max(this._normalize(Number(this.getAttribute('upper-value') ?? this.max)), this._rawLowerValue());
  }
  set upperValue(value: number) {
    this.setAttribute('upper-value', String(Math.max(this._normalize(value), this.lowerValue)));
  }

  get values(): readonly [number, number] { return [this.lowerValue, this.upperValue]; }
  set values(value: readonly [number, number]) {
    const lower = this._normalize(Number(value[0]));
    const upper = this._normalize(Number(value[1]));
    this.setAttribute('lower-value', String(Math.min(lower, upper)));
    this.setAttribute('upper-value', String(Math.max(lower, upper)));
  }

  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }

  get showValue(): boolean { return this.hasAttribute('show-value'); }
  set showValue(value: boolean) { this.toggleAttribute('show-value', Boolean(value)); }

  override focus(options?: FocusOptions): void {
    this._upperHandle.focus(options);
  }

  private _configureHandle(button: HTMLButtonElement, bubble: HTMLElement, handle: 'lower' | 'upper'): void {
    button.className = `handle ${handle}`;
    button.type = 'button';
    button.dataset.handle = handle;
    button.part.add('handle', `handle-${handle}`);
    button.setAttribute('role', 'slider');
    bubble.className = 'bubble';
    bubble.setAttribute('aria-hidden', 'true');
    button.append(bubble);
  }

  private _render(): void {
    const lower = this.range ? this.lowerValue : this.min;
    const upper = this.range ? this.upperValue : this.value;
    const lowerPercent = this._toPercent(lower);
    const upperPercent = this._toPercent(upper);
    this._lowerHandle.style.left = `${lowerPercent}%`;
    this._upperHandle.style.left = `${upperPercent}%`;
    this._track.style.left = `${lowerPercent}%`;
    this._track.style.width = `${Math.max(0, upperPercent - lowerPercent)}%`;
    this._lowerBubble.textContent = this._formatValue(lower);
    this._upperBubble.textContent = this._formatValue(upper);
    const label = this.getAttribute('aria-label');
    this._syncHandle(this._lowerHandle, lower, label ? `${label} minimum` : 'Lower value');
    this._syncHandle(this._upperHandle, upper, this.range ? (label ? `${label} maximum` : 'Upper value') : (label ?? 'Range value'));
  }

  private _syncHandle(handle: HTMLButtonElement, value: number, fallbackLabel: string): void {
    handle.disabled = this.disabled;
    handle.setAttribute('aria-orientation', 'horizontal');
    handle.setAttribute('aria-valuemin', String(handle === this._upperHandle && this.range ? this.lowerValue : this.min));
    handle.setAttribute('aria-valuemax', String(handle === this._lowerHandle && this.range ? this.upperValue : this.max));
    handle.setAttribute('aria-valuenow', String(value));
    handle.setAttribute('aria-valuetext', this._formatValue(value));
    if (handle === this._lowerHandle) handle.setAttribute('aria-label', fallbackLabel);
    else handle.setAttribute('aria-label', fallbackLabel);
  }

  private _onPointerDown = (event: PointerEvent): void => {
    if (this.disabled || event.button !== 0) return;
    event.preventDefault();
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.handle') : null;
    const pointerValue = this._valueFromClientX(event.clientX);
    const handle = target?.dataset.handle === 'lower'
      ? 'lower'
      : target?.dataset.handle === 'upper'
        ? (this.range ? 'upper' : 'single')
        : this._nearestHandle(pointerValue);
    this._activeHandle = handle;
    this._pointerId = event.pointerId;
    this._dragStartValue = this._serializedValue();
    this._setActiveHandle(handle, true);
    (handle === 'lower' ? this._lowerHandle : this._upperHandle).focus();
    this._setFromPointer(event.clientX, true);
    this._dragAbort?.abort();
    this._dragAbort = new AbortController();
    const { signal } = this._dragAbort;
    document.addEventListener('pointermove', this._onPointerMove, { signal });
    document.addEventListener('pointerup', this._onPointerUp, { signal });
    document.addEventListener('pointercancel', this._onPointerUp, { signal });
  };

  private _onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this._pointerId) return;
    event.preventDefault();
    this._setFromPointer(event.clientX, true);
  };

  private _onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this._pointerId) return;
    const changed = this._dragStartValue !== this._serializedValue();
    const handle = this._activeHandle;
    this._stopDrag();
    if (changed) this._dispatchValueEvent('value-change', handle);
  };

  private _onKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || !(event.target instanceof HTMLButtonElement)) return;
    const rawHandle = event.target.dataset.handle;
    const handle: HYRangeHandle = rawHandle === 'lower' ? 'lower' : this.range ? 'upper' : 'single';
    let next: number | null = null;
    const current = handle === 'lower' ? this.lowerValue : this.range ? this.upperValue : this.value;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - this.step;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + this.step;
    if (event.key === 'PageDown') next = current - this.step * 10;
    if (event.key === 'PageUp') next = current + this.step * 10;
    if (event.key === 'Home') next = this.min;
    if (event.key === 'End') next = this.max;
    if (next === null) return;
    event.preventDefault();
    this._commitValue(next, handle, true);
    this._dispatchValueEvent('value-change', handle);
  };

  private _setFromPointer(clientX: number, emit: boolean): void {
    this._commitValue(this._valueFromClientX(clientX), this._activeHandle, emit);
  }

  private _commitValue(value: number, handle: HYRangeHandle, emit: boolean): void {
    const normalized = this._normalize(value);
    if (handle === 'lower') this.setAttribute('lower-value', String(Math.min(normalized, this.upperValue)));
    else if (handle === 'upper') this.setAttribute('upper-value', String(Math.max(normalized, this.lowerValue)));
    else this.setAttribute('value', String(normalized));
    if (emit) this._dispatchValueEvent('value-input', handle);
  }

  private _dispatchValueEvent(type: 'value-input' | 'value-change', handle: HYRangeHandle): void {
    const lowerValue = this.range ? this.lowerValue : this.min;
    const upperValue = this.range ? this.upperValue : this.value;
    this.dispatchEvent(new CustomEvent<HYRangeChangeDetail>(type, {
      detail: {
        value: this.range ? [lowerValue, upperValue] : upperValue,
        lowerValue,
        upperValue,
        handle,
      },
      bubbles: true,
      composed: true,
    }));
  }

  private _nearestHandle(value: number): HYRangeHandle {
    if (!this.range) return 'single';
    return Math.abs(value - this.lowerValue) < Math.abs(value - this.upperValue) ? 'lower' : 'upper';
  }

  private _valueFromClientX(clientX: number): number {
    const rect = this._stage.getBoundingClientRect();
    const percent = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return this._normalize(this.min + Math.max(0, Math.min(1, percent)) * (this.max - this.min));
  }

  private _normalize(value: number): number {
    const finite = finiteOr(value, this.min);
    const clamped = Math.max(this.min, Math.min(this.max, finite));
    const stepped = this.min + Math.round((clamped - this.min) / this.step) * this.step;
    return Number(Math.max(this.min, Math.min(this.max, stepped)).toFixed(this._precision()));
  }

  private _precision(): number {
    return Math.min(12, Math.max(numberPrecision(this.min), numberPrecision(this.max), numberPrecision(this.step)));
  }

  private _rawLowerValue(): number {
    return this._normalize(Number(this.getAttribute('lower-value') ?? this.min));
  }

  private _toPercent(value: number): number {
    return (value - this.min) / (this.max - this.min) * 100;
  }

  private _formatValue(value: number): string {
    return value.toFixed(this._precision());
  }

  private _serializedValue(): string {
    return this.range ? `${this.lowerValue}:${this.upperValue}` : String(this.value);
  }

  private _setActiveHandle(handle: HYRangeHandle, active: boolean): void {
    this._lowerHandle.dataset.active = String(active && handle === 'lower');
    this._upperHandle.dataset.active = String(active && handle !== 'lower');
  }

  private _stopDrag(): void {
    this._dragAbort?.abort();
    this._dragAbort = null;
    this._pointerId = -1;
    this._setActiveHandle(this._activeHandle, false);
  }
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function numberPrecision(value: number): number {
  const [coefficient = '', exponentText = '0'] = String(value).toLowerCase().split('e');
  const decimals = coefficient.includes('.') ? coefficient.length - coefficient.indexOf('.') - 1 : 0;
  return Math.max(0, decimals - Number(exponentText));
}

export function defineRangeComponents(): void {
  if (!customElements.get('hy-range')) customElements.define('hy-range', HYRange);
}
