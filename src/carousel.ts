export type HYCarouselDirection = 'horizontal' | 'vertical';
export type HYCarouselIndicatorPosition = 'top' | 'right' | 'bottom' | 'left';
export type HYCarouselIndicatorStyle = 'dot' | 'line' | 'number';
export type HYCarouselChangeSource = 'api' | 'indicator' | 'arrow' | 'keyboard' | 'drag' | 'autoplay' | 'content';
export interface HYCarouselChangeDetail { index: number; previousIndex: number; source: HYCarouselChangeSource; }
export type HYCarouselIndicatorRenderer = (index: number, active: boolean) => Node | string | null;

const properties = ['--_hy-carousel-transform', '--_hy-carousel-visibility'];
const attributes = ['role', 'aria-roledescription', 'aria-label', 'aria-hidden', 'inert'];
interface SavedSlide { attributes: (string | null)[]; properties: { value: string; priority: string }[]; }
interface Drag { id: number; x: number; y: number; offset: number; moved: boolean; }
function numeric(value: unknown, fallback: number, min: number, max: number): number {
  if (value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

/** A slotted, accessible carousel. Panels stay mounted and inactive panels are inert. */
export class HYCarousel extends HTMLElement {
  private readonly _viewport = document.createElement('div');
  private readonly _slot = document.createElement('slot');
  private readonly _indicators = document.createElement('div');
  private readonly _previous = document.createElement('button');
  private readonly _next = document.createElement('button');
  private readonly _playback = document.createElement('button');
  private readonly _motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly _saved = new Map<HTMLElement, SavedSlide>();
  private readonly _animations = new Set<Animation>();
  private readonly _hostAttributes = new Map<string, string | null>();
  private _slides: HTMLElement[] = [];
  private _index = 0;
  private _reflecting = false;
  private _connected = false;
  private _timer = 0;
  private _paused = false;
  private _hovered = false;
  private _motionOverride = false;
  private _drag: Drag | null = null;
  private _blockClickUntil = 0;
  private _playbackPointerAction: boolean | null = null;
  private _indicatorRenderer: HYCarouselIndicatorRenderer | null = null;

  static get observedAttributes(): string[] {
    return ['index', 'direction', 'indicator-position', 'indicator-style', 'show-indicators', 'show-arrows', 'autoplay', 'interval', 'draggable', 'loop'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; position: relative; box-sizing: border-box; width: 100%; height: var(--hy-carousel-height, 240px); min-width: 0; min-height: 0; color: var(--hy-text-color, #eef0ff); font: inherit; }
      :host([hidden]), [hidden] { display: none !important; }
      .viewport { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: var(--hy-carousel-radius, 10px); background: var(--hy-carousel-bg-color, var(--hy-surface-color, #10132f)); touch-action: pan-y; }
      :host([direction="vertical"]) .viewport { touch-action: pan-x; }
      :host([draggable="false"]) .viewport { touch-action: auto; }
      slot { display: contents; }
      ::slotted(*) { position: absolute; box-sizing: border-box; inset: 0; width: 100%; height: 100%; margin: 0; overflow: auto; touch-action: pan-y; transform: var(--_hy-carousel-transform, translate3d(0,0,0)); visibility: var(--_hy-carousel-visibility, hidden); }
      :host([direction="vertical"]) ::slotted(*) { touch-action: pan-x; }
      :host([draggable="false"]) ::slotted(*) { touch-action: auto; }
      button { box-sizing: border-box; color: inherit; font: inherit; cursor: pointer; border: 0; }
      button:disabled { opacity: .35; cursor: default; }
      button:focus-visible, .viewport:focus-visible { outline: 2px solid var(--hy-focus-border-color, #9c8fff); outline-offset: -3px; }
      .arrow, .playback { position: absolute; z-index: 2; display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--hy-carousel-control-radius, 50%); background: var(--hy-carousel-control-bg-color, var(--hy-surface-elevated-color, #181a40)); color: var(--hy-carousel-control-color, var(--hy-text-color, #eef0ff)); }
      .arrow:hover, .playback:hover { background: var(--hy-hover-bg-color, #242752); }
      .previous { left: 12px; top: calc(50% - 16px); }
      .next { right: 12px; top: calc(50% - 16px); }
      :host(:dir(rtl)) .previous { left: auto; right: 12px; }
      :host(:dir(rtl)) .next { right: auto; left: 12px; }
      :host([direction="vertical"]) .previous { left: calc(50% - 16px); right: auto; top: 12px; }
      :host([direction="vertical"]) .next { left: calc(50% - 16px); right: auto; top: auto; bottom: 12px; }
      :host(:not([direction="vertical"])[indicator-position="left"]) .arrow,
      :host(:not([direction="vertical"])[indicator-position="right"]) .arrow { top: auto; bottom: 12px; }
      :host([direction="vertical"]:not([indicator-position="left"]):not([indicator-position="right"])) .arrow { left: auto; right: auto; inset-inline-start: 12px; }
      .playback { top: 12px; inset-inline-end: 12px; font-size: 12px; }
      .indicators { position: absolute; z-index: 2; display: flex; align-items: center; max-width: calc(100% - 88px); overflow: auto; gap: var(--hy-carousel-indicator-gap, 4px); bottom: var(--hy-carousel-indicator-offset, 12px); left: 50%; transform: translateX(-50%); }
      :host([indicator-position="top"]) .indicators { top: var(--hy-carousel-indicator-offset, 12px); bottom: auto; }
      :host([indicator-position="left"]) .indicators, :host([indicator-position="right"]) .indicators { flex-direction: column; max-height: calc(100% - 88px); top: 50%; bottom: auto; transform: translateY(-50%); }
      :host([indicator-position="left"]) .indicators { left: var(--hy-carousel-indicator-offset, 12px); }
      :host([indicator-position="right"]) .indicators { left: auto; right: var(--hy-carousel-indicator-offset, 12px); }
      .indicator { display: grid; flex: 0 0 auto; place-items: center; min-width: 24px; min-height: 24px; padding: 4px; background: transparent; border-radius: 4px; }
      .indicator-content { display: grid; place-items: center; width: var(--hy-carousel-indicator-size, 8px); height: var(--hy-carousel-indicator-size, 8px); border-radius: var(--hy-carousel-indicator-radius, 50%); background: var(--hy-carousel-indicator-color, var(--hy-muted-color, #747ba8)); }
      .indicator[aria-current="true"] .indicator-content { background: var(--hy-carousel-indicator-active-color, var(--hy-accent-color, #8177f2)); }
      :host([indicator-style="line"]) .indicator-content { width: var(--hy-carousel-indicator-width, 24px); height: var(--hy-carousel-indicator-thickness, 3px); border-radius: var(--hy-carousel-indicator-radius, 2px); }
      :host([indicator-style="number"]) .indicator-content { width: 24px; height: 24px; font-size: 12px; color: var(--hy-carousel-indicator-text-color, var(--hy-text-color, #eef0ff)); }
      .indicators.custom .indicator-content { width: auto; height: auto; background: transparent; }
    `;
    this._viewport.className = 'viewport'; this._viewport.part.add('viewport'); this._viewport.tabIndex = 0;
    this._viewport.append(this._slot);
    this._indicators.className = 'indicators'; this._indicators.part.add('indicators'); this._indicators.setAttribute('role', 'group'); this._indicators.setAttribute('aria-label', 'Choose slide');
    for (const [button, name] of [[this._previous, 'previous'], [this._next, 'next'], [this._playback, 'playback']] as const) {
      button.type = 'button'; button.className = name === 'playback' ? name : `arrow ${name}`; button.part.add(name);
    }
    this._previous.setAttribute('aria-label', 'Previous slide'); this._next.setAttribute('aria-label', 'Next slide');
    this._previous.addEventListener('click', () => this._select(this._index - 1, 'arrow'));
    this._next.addEventListener('click', () => this._select(this._index + 1, 'arrow'));
    // Pointer focus pauses rotation before click fires. Preserve the action
    // the user saw on pointerdown so the first click still pauses playback.
    this._playback.addEventListener('pointerdown', () => { this._playbackPointerAction = !this._paused && !(this._motion.matches && !this._motionOverride); });
    this._playback.addEventListener('click', event => {
      const pause = event.detail > 0 && this._playbackPointerAction !== null ? this._playbackPointerAction : !this._paused && !(this._motion.matches && !this._motionOverride);
      this._playbackPointerAction = null;
      if (pause) this.pause(); else this.play();
    });
    this._indicators.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-index]');
      if (button) this._select(Number(button.dataset.index), 'indicator');
    });
    root.append(style, this._viewport, this._previous, this._next, this._indicators, this._playback);
  }

  connectedCallback(): void {
    if (this._connected) return;
    this._connected = true;
    for (const [name, value] of [['role', 'region'], ['aria-roledescription', 'carousel'], ['aria-label', 'Carousel']]) {
      this._hostAttributes.set(name!, this.getAttribute(name!));
      if (!this.hasAttribute(name!)) this.setAttribute(name!, value!);
    }
    this._slot.addEventListener('slotchange', this._syncSlides);
    this.addEventListener('keydown', this._onKeyDown);
    this.addEventListener('pointerenter', this._onEnter);
    this.addEventListener('pointerleave', this._onLeave);
    this.addEventListener('focusin', this._onFocus);
    this._viewport.addEventListener('pointerdown', this._onPointerDown);
    this._viewport.addEventListener('lostpointercapture', this._onPointerCancel);
    this._viewport.addEventListener('dragstart', this._onNativeDrag);
    this._viewport.addEventListener('click', this._onClick, true);
    document.addEventListener('visibilitychange', this._schedule);
    this._motion.addEventListener('change', this._onMotionChange);
    this._syncSlides();
  }

  disconnectedCallback(): void {
    this._connected = false;
    this._clearTimer(); this._cancelDrag(); this._cancelAnimations(); this._hovered = false; this._playbackPointerAction = null;
    this._slot.removeEventListener('slotchange', this._syncSlides);
    this.removeEventListener('keydown', this._onKeyDown);
    this.removeEventListener('pointerenter', this._onEnter);
    this.removeEventListener('pointerleave', this._onLeave);
    this.removeEventListener('focusin', this._onFocus);
    this._viewport.removeEventListener('pointerdown', this._onPointerDown);
    this._viewport.removeEventListener('lostpointercapture', this._onPointerCancel);
    this._viewport.removeEventListener('dragstart', this._onNativeDrag);
    this._viewport.removeEventListener('click', this._onClick, true);
    document.removeEventListener('visibilitychange', this._schedule);
    this._motion.removeEventListener('change', this._onMotionChange);
    for (const slide of this._saved.keys()) this._releaseSlide(slide);
    for (const [name, value] of this._hostAttributes) {
      if (value === null) this.removeAttribute(name); else this.setAttribute(name, value);
    }
    this._hostAttributes.clear();
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (oldValue === value || this._reflecting) return;
    if (name === 'index') {
      const index = Math.floor(numeric(value, 0, 0, Number.MAX_SAFE_INTEGER));
      if (this._connected) this._select(index, 'api'); else this._index = index;
      return;
    }
    if (name === 'direction' || name === 'draggable') { this._cancelDrag(); this._cancelAnimations(); }
    if (name === 'autoplay') { this._paused = false; this._motionOverride = false; }
    if (this._connected) { this._render(); this._schedule(); }
  }

  get index(): number { return this._index; }
  set index(value: number) { this.setAttribute('index', String(Math.floor(numeric(value, 0, 0, Number.MAX_SAFE_INTEGER)))); }
  get direction(): HYCarouselDirection { return this.getAttribute('direction') === 'vertical' ? 'vertical' : 'horizontal'; }
  set direction(value: HYCarouselDirection) { this.setAttribute('direction', value === 'vertical' ? value : 'horizontal'); }
  get indicatorPosition(): HYCarouselIndicatorPosition {
    const value = this.getAttribute('indicator-position'); return value === 'top' || value === 'left' || value === 'right' ? value : 'bottom';
  }
  set indicatorPosition(value: HYCarouselIndicatorPosition) { this.setAttribute('indicator-position', value); }
  get indicatorStyle(): HYCarouselIndicatorStyle {
    const value = this.getAttribute('indicator-style'); return value === 'line' || value === 'number' ? value : 'dot';
  }
  set indicatorStyle(value: HYCarouselIndicatorStyle) { this.setAttribute('indicator-style', value); }
  get indicatorRenderer(): HYCarouselIndicatorRenderer | null { return this._indicatorRenderer; }
  set indicatorRenderer(value: HYCarouselIndicatorRenderer | null) { this._indicatorRenderer = typeof value === 'function' ? value : null; if (this._connected) this._render(); }
  get showIndicators(): boolean { return this.getAttribute('show-indicators') !== 'false'; }
  set showIndicators(value: boolean) { this.setAttribute('show-indicators', String(Boolean(value))); }
  get showArrows(): boolean { return this.getAttribute('show-arrows') !== 'false'; }
  set showArrows(value: boolean) { this.setAttribute('show-arrows', String(Boolean(value))); }
  get autoplay(): boolean { return this.hasAttribute('autoplay') && this.getAttribute('autoplay') !== 'false'; }
  set autoplay(value: boolean) { if (value) this.setAttribute('autoplay', ''); else this.removeAttribute('autoplay'); }
  get interval(): number { return numeric(this.getAttribute('interval'), 3000, 100, 86_400_000); }
  set interval(value: number) { this.setAttribute('interval', String(numeric(value, 3000, 100, 86_400_000))); }
  get draggable(): boolean { return this.getAttribute('draggable') !== 'false'; }
  set draggable(value: boolean) { this.setAttribute('draggable', String(Boolean(value))); }
  get loop(): boolean { return this.getAttribute('loop') !== 'false'; }
  set loop(value: boolean) { this.setAttribute('loop', String(Boolean(value))); }
  next(): void { this._select(this._index + 1, 'api'); }
  previous(): void { this._select(this._index - 1, 'api'); }
  goTo(index: number): void { this._select(Math.floor(numeric(index, 0, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)), 'api'); }
  play(): void { this._paused = false; this.autoplay = true; this._motionOverride = true; if (this._connected) this._render(); this._schedule(); }
  pause(): void { this._paused = true; this._clearTimer(); if (this._connected) this._render(); }

  private _syncSlides = (): void => {
    const active = this._slides[this._index];
    const slides = this._slot.assignedElements().filter((slide): slide is HTMLElement => slide instanceof HTMLElement);
    this._cancelDrag(); this._cancelAnimations();
    for (const slide of this._saved.keys()) if (!slides.includes(slide)) this._releaseSlide(slide);
    this._slides = slides;
    for (const slide of slides) if (!this._saved.has(slide)) this._saved.set(slide, {
      attributes: attributes.map(name => slide.getAttribute(name)),
      properties: properties.map(name => ({ value: slide.style.getPropertyValue(name), priority: slide.style.getPropertyPriority(name) })),
    });
    this._indicators.replaceChildren(...slides.map((_, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'indicator'; button.dataset.index = String(index); button.part.add('indicator');
      button.setAttribute('aria-label', `Go to slide ${index + 1}`);
      const content = document.createElement('span'); content.className = 'indicator-content'; content.part.add('indicator-content'); content.setAttribute('aria-hidden', 'true'); button.append(content);
      return button;
    }));
    const index = active && slides.includes(active) ? slides.indexOf(active) : Math.min(this._index, Math.max(0, slides.length - 1));
    this._select(index, 'content', false);
  };

  private _releaseSlide(slide: HTMLElement): void {
    const saved = this._saved.get(slide); if (!saved) return;
    attributes.forEach((name, index) => { const value = saved.attributes[index]; if (value == null) slide.removeAttribute(name); else slide.setAttribute(name, value); });
    properties.forEach((name, index) => { const entry = saved.properties[index]!; if (entry.value) slide.style.setProperty(name, entry.value, entry.priority); else slide.style.removeProperty(name); });
    this._saved.delete(slide);
  }

  private _resolve(index: number): number {
    const length = this._slides.length;
    return !length ? 0 : this.loop ? ((index % length) + length) % length : Math.max(0, Math.min(length - 1, index));
  }

  private _select(requested: number, source: HYCarouselChangeSource, animate = true, dragOffset = 0): void {
    if (!this._connected) { this.index = Math.max(0, requested); return; }
    if (this._drag) this._cancelDrag();
    const index = this._resolve(requested); const previousIndex = this._index;
    const previous = this._slides[previousIndex]; const next = this._slides[index];
    this._cancelAnimations();
    if (previous && index !== previousIndex && previous.matches(':focus-within')) this._viewport.focus({ preventScroll: true });
    this._index = index;
    this._reflecting = true; this.setAttribute('index', String(index)); this._reflecting = false;
    this._render();
    if (animate && index !== previousIndex && previous && next) {
      const sign = requested > previousIndex ? 1 : -1;
      this._animate(previous, dragOffset, -sign * 100);
      this._animate(next, dragOffset + sign * 100, 0);
    }
    this._schedule();
    if (index !== previousIndex) this.dispatchEvent(new CustomEvent<HYCarouselChangeDetail>('change', {
      detail: { index, previousIndex, source }, bubbles: true, composed: true,
    }));
  }

  private _transform(offset: number): string {
    return this.direction === 'vertical' ? `translate3d(0, ${offset}%, 0)` : `translate3d(${offset * (getComputedStyle(this).direction === 'rtl' ? -1 : 1)}%, 0, 0)`;
  }
  private _position(slide: HTMLElement, offset: number, visible: boolean): void {
    slide.style.setProperty(properties[0]!, this._transform(offset)); slide.style.setProperty(properties[1]!, visible ? 'visible' : 'hidden');
  }
  private _paint(): void { this._slides.forEach((slide, index) => this._position(slide, 0, index === this._index)); }
  private _render(): void {
    this._paint();
    this._slides.forEach((slide, index) => {
      const saved = this._saved.get(slide); if (!saved) return;
      if (!saved.attributes[0]) slide.setAttribute('role', 'group');
      if (!saved.attributes[1]) slide.setAttribute('aria-roledescription', 'slide');
      if (!saved.attributes[2]) slide.setAttribute('aria-label', `${index + 1} of ${this._slides.length}`);
      for (const name of ['inert', 'aria-hidden']) {
        const value = saved.attributes[attributes.indexOf(name)];
        if (index !== this._index) slide.setAttribute(name, name === 'inert' ? '' : 'true');
        else if (value == null) slide.removeAttribute(name); else slide.setAttribute(name, value);
      }
    });
    this._indicators.hidden = !this.showIndicators || this._slides.length < 2;
    this._indicators.classList.toggle('custom', Boolean(this._indicatorRenderer));
    [...this._indicators.children].forEach((element, index) => {
      const button = element as HTMLButtonElement; const active = index === this._index;
      button.setAttribute('aria-current', String(active)); button.tabIndex = active ? 0 : -1; button.part.toggle('indicator-active', active);
      const content = button.firstElementChild!;
      if (this._indicatorRenderer) { const rendered = this._indicatorRenderer(index, active); content.replaceChildren(...(rendered == null ? [] : [rendered])); }
      else content.textContent = this.indicatorStyle === 'number' ? String(index + 1) : '';
    });
    const vertical = this.direction === 'vertical'; const rtl = getComputedStyle(this).direction === 'rtl';
    this._previous.textContent = vertical ? '↑' : rtl ? '→' : '←'; this._next.textContent = vertical ? '↓' : rtl ? '←' : '→';
    this._previous.hidden = this._next.hidden = !this.showArrows || this._slides.length < 2;
    this._previous.disabled = !this.loop && this._index === 0;
    this._next.disabled = !this.loop && this._index >= this._slides.length - 1;
    this._playback.hidden = !this.autoplay || this._slides.length < 2;
    const paused = this._paused || (this._motion.matches && !this._motionOverride);
    this._playback.textContent = paused ? '▶' : 'Ⅱ'; this._playback.setAttribute('aria-label', paused ? 'Start automatic slide rotation' : 'Pause automatic slide rotation');
    this._viewport.setAttribute('aria-live', this.autoplay && !paused ? 'off' : 'polite');
  }

  private _animate(slide: HTMLElement, from: number, to: number): void {
    if (this._motion.matches) return;
    const raw = getComputedStyle(this).getPropertyValue('--hy-carousel-duration').trim() || '320ms';
    const duration = numeric(Number.parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000), 320, 0, 5000);
    if (!duration) return;
    slide.style.setProperty(properties[1]!, 'visible');
    const animation = slide.animate([{ transform: this._transform(from) }, { transform: this._transform(to) }], { duration, easing: 'ease', fill: 'forwards' });
    this._animations.add(animation);
    void animation.finished.then(() => {
      if (!this._animations.delete(animation)) return;
      animation.cancel();
      this._position(slide, 0, slide === this._slides[this._index]);
    }, () => { this._animations.delete(animation); });
  }
  private _cancelAnimations(): void { for (const animation of this._animations) animation.cancel(); this._animations.clear(); }
  private _clearTimer(): void { window.clearTimeout(this._timer); this._timer = 0; }
  private _schedule = (): void => {
    this._clearTimer();
    if (!this._connected || !this.autoplay || this._paused || this._hovered || this._drag || document.hidden || this._slides.length < 2 ||
      (this._motion.matches && !this._motionOverride) || (!this.loop && this._index === this._slides.length - 1)) return;
    this._timer = window.setTimeout(() => this._select(this._index + 1, 'autoplay'), this.interval);
  };
  private _onEnter = (): void => { this._hovered = true; this._schedule(); };
  private _onLeave = (): void => { this._hovered = false; this._schedule(); };
  private _onMotionChange = (): void => { this._cancelAnimations(); if (this._connected) this._render(); this._schedule(); };
  private _onFocus = (event: FocusEvent): void => { if (!(event.relatedTarget instanceof Node) || !this.contains(event.relatedTarget)) this.pause(); };
  private _onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !this._slides.length) return;
    const path = event.composedPath(); const indicator = path.find(node => node instanceof HTMLButtonElement && node.dataset.index != null) as HTMLButtonElement | undefined;
    if (!indicator && path.some(node => node instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(node.tagName) || node instanceof HTMLElement && node.isContentEditable)) return;
    const backward = this.direction === 'vertical' ? 'ArrowUp' : 'ArrowLeft'; const forward = this.direction === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    let step = event.key === forward ? 1 : event.key === backward ? -1 : 0;
    if (indicator && !step) step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (this.direction === 'horizontal' && getComputedStyle(this).direction === 'rtl' && ['ArrowLeft', 'ArrowRight'].includes(event.key)) step *= -1;
    if (!step && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    this._select(event.key === 'Home' ? 0 : event.key === 'End' ? this._slides.length - 1 : this._index + step, 'keyboard');
    if (indicator) (this._indicators.children[this._index] as HTMLElement | undefined)?.focus();
  };
  private _onNativeDrag = (event: DragEvent): void => { if (this.draggable) event.preventDefault(); };
  private _onClick = (event: MouseEvent): void => { if (event.detail > 0 && performance.now() < this._blockClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); } };
  private _onPointerDown = (event: PointerEvent): void => {
    if (!this.draggable || !event.isPrimary || event.button !== 0 || this._slides.length < 2 ||
      event.composedPath().some(node => node instanceof HTMLElement && (node.matches('a, button, input, textarea, select, [contenteditable]:not([contenteditable="false"])')))) return;
    this._cancelAnimations(); this._paint();
    this._drag = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: 0, moved: false }; this._clearTimer();
    window.addEventListener('pointermove', this._onPointerMove, { passive: false });
    window.addEventListener('pointerup', this._onPointerUp); window.addEventListener('pointercancel', this._onPointerCancel);
  };
  private _onPointerMove = (event: PointerEvent): void => {
    const drag = this._drag; if (!drag || drag.id !== event.pointerId) return;
    const vertical = this.direction === 'vertical'; const delta = vertical ? event.clientY - drag.y : event.clientX - drag.x;
    const cross = vertical ? event.clientX - drag.x : event.clientY - drag.y;
    if (!drag.moved && Math.abs(cross) > Math.max(8, Math.abs(delta))) { this._cancelDrag(); this._schedule(); return; }
    if (!drag.moved && Math.abs(delta) < 6) return;
    if (!drag.moved) { drag.moved = true; this._viewport.setPointerCapture(event.pointerId); }
    event.preventDefault();
    const rect = this._viewport.getBoundingClientRect(); const size = vertical ? rect.height : rect.width;
    drag.offset = size > 0 ? delta / size * 100 * (!vertical && getComputedStyle(this).direction === 'rtl' ? -1 : 1) : 0;
    const step = drag.offset < 0 ? 1 : -1; const neighbor = this._resolve(this._index + step);
    this._paint();
    const offset = neighbor === this._index ? drag.offset * .25 : drag.offset;
    this._position(this._slides[this._index]!, offset, true);
    if (neighbor !== this._index) this._position(this._slides[neighbor]!, offset + step * 100, true);
  };
  private _onPointerUp = (event: PointerEvent): void => {
    const drag = this._drag; if (!drag || drag.id !== event.pointerId) return;
    const offset = drag.offset; const step = offset < 0 ? 1 : -1; const neighbor = this._resolve(this._index + step);
    this._cancelDrag();
    if (drag.moved) {
      this._blockClickUntil = performance.now() + 400;
      if (Math.abs(offset) >= 18 && neighbor !== this._index) this._select(this._index + step, 'drag', true, offset);
      else this._animate(this._slides[this._index]!, neighbor === this._index ? offset * .25 : offset, 0);
    }
    this._schedule();
  };
  private _onPointerCancel = (event: PointerEvent): void => {
    // Touch starts with implicit capture on the slotted content. Moving capture
    // to the viewport emits a bubbling loss from that content, not a cancellation.
    if (event.type === 'lostpointercapture' && event.target !== this._viewport) return;
    if (this._drag?.id === event.pointerId) { this._cancelDrag(); this._schedule(); }
  };
  private _cancelDrag(): void {
    const drag = this._drag; this._drag = null;
    window.removeEventListener('pointermove', this._onPointerMove); window.removeEventListener('pointerup', this._onPointerUp); window.removeEventListener('pointercancel', this._onPointerCancel);
    if (drag && this._viewport.hasPointerCapture(drag.id)) this._viewport.releasePointerCapture(drag.id);
    if (this._connected) this._paint();
  }
}

export function defineCarouselComponents(): void {
  if (!customElements.get('hy-carousel')) customElements.define('hy-carousel', HYCarousel);
}
