export type HYVirtualMouseButton = 'left' | 'middle' | 'right';
export type HYVirtualMouseState = 'idle' | 'left-down' | 'middle-down' | 'right-down';

export interface HYVirtualMousePosition {
  readonly x: number;
  readonly y: number;
}

export interface HYVirtualMouseMoveOptions {
  readonly animate?: boolean;
  readonly duration?: number;
  readonly easing?: string;
}

export interface HYVirtualMouseClickOptions {
  readonly holdDuration?: number;
}

export type HYVirtualMouseImages = Partial<Record<HYVirtualMouseState, string>>;

export interface HYVirtualMouseMoveDetail {
  readonly from: HYVirtualMousePosition;
  readonly to: HYVirtualMousePosition;
  readonly animated: boolean;
  readonly duration: number;
}

export interface HYVirtualMouseButtonDetail extends HYVirtualMousePosition {
  readonly button: HYVirtualMouseButton;
  readonly buttons: readonly HYVirtualMouseButton[];
  readonly state: HYVirtualMouseState;
}

const DEFAULT_DURATION = 320;
const DEFAULT_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const BUTTONS: readonly HYVirtualMouseButton[] = ['left', 'middle', 'right'];
const STATES: readonly HYVirtualMouseState[] = ['idle', 'left-down', 'middle-down', 'right-down'];

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeButton(button: HYVirtualMouseButton): HYVirtualMouseButton {
  if (!BUTTONS.includes(button)) throw new RangeError(`Unsupported virtual mouse button: ${String(button)}`);
  return button;
}

/** Fixed, non-interactive cursor visual for tutorials, playback, and remote-operation feedback. */
export class HYVirtualMouse extends HTMLElement {
  private readonly _cursor = document.createElement('span');
  private readonly _shape = document.createElement('span');
  private readonly _image = document.createElement('img');
  private readonly _indicator = document.createElement('span');
  private readonly _pressed = new Set<HYVirtualMouseButton>();
  private _images: HYVirtualMouseImages = {};
  private _x = 0;
  private _y = 0;
  private _reflectingPosition = false;
  private _moveTimer: number | null = null;
  private _resolveMove: (() => void) | null = null;
  private readonly _delays = new Map<number, () => void>();

  static get observedAttributes(): string[] {
    return [
      'x', 'y', 'animated', 'duration', 'easing',
      'idle-image', 'left-down-image', 'middle-down-image', 'right-down-image',
    ];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: fixed !important;
        z-index: var(--hy-virtual-mouse-z-index, 2147483000);
        inset: 0 auto auto 0;
        display: block;
        width: 0;
        height: 0;
        overflow: visible;
        pointer-events: none !important;
        transform: translate3d(var(--_hy-virtual-mouse-x, 0px), var(--_hy-virtual-mouse-y, 0px), 0);
        transition-property: transform;
        transition-duration: 0ms;
        transition-timing-function: var(--_hy-virtual-mouse-easing, cubic-bezier(0.22, 1, 0.36, 1));
        will-change: transform;
        contain: layout style;
      }
      :host([hidden]) { display: none !important; }
      .cursor {
        position: absolute;
        width: var(--hy-virtual-mouse-width, 24px);
        height: var(--hy-virtual-mouse-height, 30px);
        transform: translate(
          calc(-1 * var(--hy-virtual-mouse-hotspot-x, 2px)),
          calc(-1 * var(--hy-virtual-mouse-hotspot-y, 2px))
        );
        transform-origin: var(--hy-virtual-mouse-hotspot-x, 2px) var(--hy-virtual-mouse-hotspot-y, 2px);
        transition: scale 90ms ease;
      }
      :host([data-state$="-down"]) .cursor { scale: var(--hy-virtual-mouse-pressed-scale, 0.9); }
      .shape {
        position: absolute;
        inset: 0;
        display: block;
        box-sizing: border-box;
        border: var(--hy-virtual-mouse-border-width, 1.5px) solid var(--hy-virtual-mouse-border-color, #f5fbff);
        clip-path: polygon(5% 0, 88% 70%, 55% 74%, 72% 100%, 51% 100%, 36% 76%, 10% 96%);
        background: var(--hy-virtual-mouse-idle-background, linear-gradient(145deg, #78d7ff, #5265e8));
        filter: drop-shadow(var(--hy-virtual-mouse-shadow, 0 3px 5px rgba(4, 9, 28, 0.5)));
      }
      :host([data-state="left-down"]) .shape {
        background: var(--hy-virtual-mouse-left-down-background, linear-gradient(145deg, #b5f1ff, #6d74ff));
      }
      :host([data-state="middle-down"]) .shape {
        background: var(--hy-virtual-mouse-middle-down-background, linear-gradient(145deg, #d6c4ff, #7654e8));
      }
      :host([data-state="right-down"]) .shape {
        background: var(--hy-virtual-mouse-right-down-background, linear-gradient(145deg, #f4c8ff, #9156dc));
      }
      .image {
        position: absolute;
        inset: 0;
        display: none;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: left top;
        filter: drop-shadow(var(--hy-virtual-mouse-shadow, 0 3px 5px rgba(4, 9, 28, 0.5)));
        user-select: none;
      }
      .cursor[data-image-ready] .shape { display: none; }
      .cursor[data-image-ready] .image { display: block; }
      .indicator {
        position: absolute;
        top: var(--hy-virtual-mouse-hotspot-y, 2px);
        left: var(--hy-virtual-mouse-hotspot-x, 2px);
        width: var(--hy-virtual-mouse-click-size, 28px);
        height: var(--hy-virtual-mouse-click-size, 28px);
        border: 2px solid var(--hy-virtual-mouse-click-color, #83dcff);
        border-radius: 50%;
        opacity: 0;
        translate: -50% -50%;
      }
      .indicator.pulse { animation: hy-virtual-mouse-click 360ms ease-out; }
      @keyframes hy-virtual-mouse-click {
        0% { opacity: 0.9; scale: 0.3; }
        100% { opacity: 0; scale: 1.35; }
      }
      @media (prefers-reduced-motion: reduce) {
        :host { transition-duration: 0ms !important; }
        .cursor { transition-duration: 0ms; }
        .indicator.pulse { animation-duration: 1ms; }
      }
    `;

    this._cursor.className = 'cursor';
    this._cursor.part.add('cursor');
    this._shape.className = 'shape';
    this._shape.part.add('shape');
    this._image.className = 'image';
    this._image.part.add('image');
    this._image.alt = '';
    this._image.draggable = false;
    this._indicator.className = 'indicator';
    this._indicator.part.add('indicator');
    this._image.addEventListener('load', () => { this._cursor.dataset.imageReady = ''; });
    this._image.addEventListener('error', () => { delete this._cursor.dataset.imageReady; });
    this._indicator.addEventListener('animationend', () => this._indicator.classList.remove('pulse'));
    this._cursor.append(this._shape, this._image, this._indicator);
    root.append(style, this._cursor);
  }

  connectedCallback(): void {
    this.setAttribute('aria-hidden', 'true');
    this._x = finiteNumber(this.getAttribute('x'), this._x);
    this._y = finiteNumber(this.getAttribute('y'), this._y);
    this._applyPosition();
    this._syncState();
  }

  disconnectedCallback(): void {
    this._cancelMove();
    for (const cancel of this._delays.values()) cancel();
    this._delays.clear();
    this._pressed.clear();
  }

  attributeChangedCallback(name: string): void {
    if ((name === 'x' || name === 'y') && !this._reflectingPosition) {
      this._x = finiteNumber(this.getAttribute('x'), this._x);
      this._y = finiteNumber(this.getAttribute('y'), this._y);
      this._applyPosition();
    } else if (name.endsWith('-image')) {
      this._syncImage();
    }
  }

  get x(): number { return this._x; }
  set x(value: number) { this._setPosition(finiteNumber(value, this._x), this._y); }

  get y(): number { return this._y; }
  set y(value: number) { this._setPosition(this._x, finiteNumber(value, this._y)); }

  get animated(): boolean { return this.hasAttribute('animated'); }
  set animated(value: boolean) { this.toggleAttribute('animated', Boolean(value)); }

  get duration(): number {
    return Math.min(60_000, Math.max(0, finiteNumber(this.getAttribute('duration'), DEFAULT_DURATION)));
  }
  set duration(value: number) {
    this.setAttribute('duration', String(Math.min(60_000, Math.max(0, finiteNumber(value, DEFAULT_DURATION)))));
  }

  get easing(): string { return this.getAttribute('easing')?.trim() || DEFAULT_EASING; }
  set easing(value: string) {
    const normalized = String(value).trim();
    if (normalized) this.setAttribute('easing', normalized);
    else this.removeAttribute('easing');
  }

  get state(): HYVirtualMouseState { return this._currentState(); }
  get pressedButtons(): readonly HYVirtualMouseButton[] { return BUTTONS.filter(button => this._pressed.has(button)); }

  get images(): HYVirtualMouseImages { return { ...this._images }; }
  set images(value: HYVirtualMouseImages) {
    this._images = Object.fromEntries(
      STATES.flatMap(state => {
        const source = value?.[state]?.trim();
        return source ? [[state, source]] : [];
      }),
    ) as HYVirtualMouseImages;
    this._syncImage();
  }

  setStateImage(state: HYVirtualMouseState, source: string | null): void {
    if (!STATES.includes(state)) throw new RangeError(`Unsupported virtual mouse state: ${String(state)}`);
    const normalized = source?.trim();
    if (normalized) this._images[state] = normalized;
    else delete this._images[state];
    this._syncImage();
  }

  show(): void { this.hidden = false; }
  hide(): void { this.hidden = true; }

  moveBy(deltaX: number, deltaY: number, options: HYVirtualMouseMoveOptions = {}): Promise<void> {
    return this.moveTo(
      this._x + finiteNumber(deltaX, 0),
      this._y + finiteNumber(deltaY, 0),
      options,
    );
  }

  moveTo(x: number, y: number, options: HYVirtualMouseMoveOptions = {}): Promise<void> {
    const from = { x: this._x, y: this._y };
    const to = { x: finiteNumber(x, this._x), y: finiteNumber(y, this._y) };
    const requestedDuration = Math.min(60_000, Math.max(0, finiteNumber(options.duration, this.duration)));
    const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animated = (options.animate ?? this.animated) && requestedDuration > 0 && !reducedMotion;
    const duration = animated ? requestedDuration : 0;
    const detail: HYVirtualMouseMoveDetail = { from, to, animated, duration };

    this._cancelMove();
    this.dispatchEvent(new CustomEvent<HYVirtualMouseMoveDetail>('virtual-mouse-move-start', {
      bubbles: true, composed: true, detail,
    }));
    this.style.transitionDuration = `${duration}ms`;
    this.style.setProperty('--_hy-virtual-mouse-easing', options.easing?.trim() || this.easing);
    this._setPosition(to.x, to.y);
    this.dispatchEvent(new CustomEvent<HYVirtualMouseMoveDetail>('virtual-mouse-move', {
      bubbles: true, composed: true, detail,
    }));

    if (!animated) {
      this.dispatchEvent(new CustomEvent<HYVirtualMouseMoveDetail>('virtual-mouse-move-end', {
        bubbles: true, composed: true, detail,
      }));
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this._resolveMove = resolve;
      this._moveTimer = window.setTimeout(() => {
        this._moveTimer = null;
        this._resolveMove = null;
        this.style.transitionDuration = '0ms';
        resolve();
        this.dispatchEvent(new CustomEvent<HYVirtualMouseMoveDetail>('virtual-mouse-move-end', {
          bubbles: true, composed: true, detail,
        }));
      }, duration);
    });
  }

  press(button: HYVirtualMouseButton = 'left'): void {
    const normalized = normalizeButton(button);
    if (this._pressed.has(normalized)) return;
    this._pressed.add(normalized);
    this._syncState();
    this._dispatchButtonEvent('virtual-mouse-down', normalized);
  }

  release(button: HYVirtualMouseButton = 'left'): void {
    const normalized = normalizeButton(button);
    if (!this._pressed.delete(normalized)) return;
    this._syncState();
    this._dispatchButtonEvent('virtual-mouse-up', normalized);
  }

  releaseAll(): void {
    for (const button of [...this.pressedButtons]) this.release(button);
  }

  async click(button: HYVirtualMouseButton = 'left', options: HYVirtualMouseClickOptions = {}): Promise<void> {
    const normalized = normalizeButton(button);
    this.press(normalized);
    await this._wait(Math.min(60_000, Math.max(0, finiteNumber(options.holdDuration, 90))));
    this.release(normalized);
    this._pulse();
    this._dispatchButtonEvent('virtual-mouse-click', normalized);
  }

  leftClick(options: HYVirtualMouseClickOptions = {}): Promise<void> { return this.click('left', options); }
  middleClick(options: HYVirtualMouseClickOptions = {}): Promise<void> { return this.click('middle', options); }
  rightClick(options: HYVirtualMouseClickOptions = {}): Promise<void> { return this.click('right', options); }

  private _setPosition(x: number, y: number): void {
    this._x = x;
    this._y = y;
    this._reflectingPosition = true;
    this.setAttribute('x', String(x));
    this.setAttribute('y', String(y));
    this._reflectingPosition = false;
    this._applyPosition();
  }

  private _applyPosition(): void {
    this.style.setProperty('--_hy-virtual-mouse-x', `${this._x}px`);
    this.style.setProperty('--_hy-virtual-mouse-y', `${this._y}px`);
  }

  private _currentState(): HYVirtualMouseState {
    if (this._pressed.has('right')) return 'right-down';
    if (this._pressed.has('middle')) return 'middle-down';
    if (this._pressed.has('left')) return 'left-down';
    return 'idle';
  }

  private _syncState(): void {
    this.dataset.state = this._currentState();
    this._syncImage();
  }

  private _syncImage(): void {
    const state = this._currentState();
    const source = this._images[state]
      ?? this.getAttribute(`${state}-image`)?.trim()
      ?? this._images.idle
      ?? this.getAttribute('idle-image')?.trim()
      ?? '';
    delete this._cursor.dataset.imageReady;
    if (source) {
      if (this._image.getAttribute('src') !== source) this._image.src = source;
      else if (this._image.complete && this._image.naturalWidth > 0) this._cursor.dataset.imageReady = '';
    } else {
      this._image.removeAttribute('src');
    }
  }

  private _dispatchButtonEvent(name: 'virtual-mouse-down' | 'virtual-mouse-up' | 'virtual-mouse-click', button: HYVirtualMouseButton): void {
    this.dispatchEvent(new CustomEvent<HYVirtualMouseButtonDetail>(name, {
      bubbles: true,
      composed: true,
      detail: { button, buttons: this.pressedButtons, state: this.state, x: this._x, y: this._y },
    }));
  }

  private _pulse(): void {
    this._indicator.classList.remove('pulse');
    void this._indicator.offsetWidth;
    this._indicator.classList.add('pulse');
  }

  private _cancelMove(): void {
    if (this._moveTimer !== null) window.clearTimeout(this._moveTimer);
    this._moveTimer = null;
    const resolve = this._resolveMove;
    this._resolveMove = null;
    resolve?.();
    this.style.transitionDuration = '0ms';
  }

  private _wait(duration: number): Promise<void> {
    if (duration === 0) return Promise.resolve();
    return new Promise(resolve => {
      const timer = window.setTimeout(() => {
        this._delays.delete(timer);
        resolve();
      }, duration);
      this._delays.set(timer, () => {
        window.clearTimeout(timer);
        resolve();
      });
    });
  }
}

export function defineVirtualMouseComponents(): void {
  if (!customElements.get('hy-virtual-mouse')) customElements.define('hy-virtual-mouse', HYVirtualMouse);
}
