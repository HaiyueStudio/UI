const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const DEFAULT_THICKNESS = 2;
const DEFAULT_SPEED = 1;
const DEFAULT_COUNT = 1;
const BASE_DURATION_SECONDS = 6;

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Decorative animated border that follows the host's live rounded rectangle. */
export class HYBorderBeam extends HTMLElement {
  private readonly _svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  private readonly _track = document.createElementNS(SVG_NAMESPACE, 'rect');
  private readonly _beamLayer = document.createElementNS(SVG_NAMESPACE, 'g');
  private _resizeObserver: ResizeObserver | null = null;
  private _connected = false;

  static get observedAttributes(): string[] {
    return ['thickness', 'speed', 'color', 'count'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: relative;
        display: block;
        min-width: 0;
        border-radius: var(--hy-border-beam-radius, 10px);
        isolation: isolate;
        --_beam-color: var(--hy-accent-color, #7dd3fc);
      }
      svg {
        position: absolute;
        z-index: 1;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
      }
      .track {
        fill: none;
        stroke: var(--hy-border-beam-track-color, var(--hy-border-color, rgba(125, 211, 252, 0.2)));
        vector-effect: non-scaling-stroke;
      }
      .beam {
        fill: none;
        stroke: var(--_beam-color);
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 0 var(--_beam-glow, 5px) var(--_beam-color));
        animation: hy-border-beam-flow linear infinite;
      }
      @keyframes hy-border-beam-flow {
        to { stroke-dashoffset: -100; }
      }
      @media (prefers-reduced-motion: reduce) {
        .beam { animation-play-state: paused; }
      }
    `;
    const slot = document.createElement('slot');
    this._svg.setAttribute('aria-hidden', 'true');
    this._svg.setAttribute('preserveAspectRatio', 'none');
    this._track.classList.add('track');
    this._track.part.add('track');
    this._track.setAttribute('pathLength', '100');
    this._svg.append(this._track, this._beamLayer);
    root.append(style, slot, this._svg);
    this._renderBeams();
  }

  connectedCallback(): void {
    if (this._connected) return;
    this._connected = true;
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this.refresh());
      this._resizeObserver.observe(this);
    }
    this.refresh();
  }

  disconnectedCallback(): void {
    if (!this._connected) return;
    this._connected = false;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  attributeChangedCallback(name: string): void {
    if (name === 'count') this._renderBeams();
    this._updateAppearance();
    this.refresh();
  }

  get thickness(): number {
    return Math.min(20, Math.max(0.5, finiteNumber(this.getAttribute('thickness'), DEFAULT_THICKNESS)));
  }
  set thickness(value: number) {
    this.setAttribute('thickness', String(Math.min(20, Math.max(0.5, finiteNumber(value, DEFAULT_THICKNESS)))));
  }

  /** Animation speed multiplier. 1 is normal speed and 2 is twice as fast. */
  get speed(): number {
    return Math.min(10, Math.max(0.1, finiteNumber(this.getAttribute('speed'), DEFAULT_SPEED)));
  }
  set speed(value: number) {
    this.setAttribute('speed', String(Math.min(10, Math.max(0.1, finiteNumber(value, DEFAULT_SPEED)))));
  }

  get color(): string { return this.getAttribute('color') ?? ''; }
  set color(value: string) {
    const normalized = String(value).trim();
    if (normalized) this.setAttribute('color', normalized);
    else this.removeAttribute('color');
  }

  get count(): number {
    return Math.min(12, Math.max(1, Math.floor(finiteNumber(this.getAttribute('count'), DEFAULT_COUNT))));
  }
  set count(value: number) {
    this.setAttribute('count', String(Math.min(12, Math.max(1, Math.floor(finiteNumber(value, DEFAULT_COUNT))))));
  }

  refresh(): void {
    const rect = this.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const inset = this.thickness / 2;
    const radius = Math.min(
      Math.max(0, Number.parseFloat(getComputedStyle(this).borderTopLeftRadius) || 10),
      width / 2,
      height / 2,
    );
    this._svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    for (const element of [this._track, ...this._beamLayer.querySelectorAll<SVGRectElement>('.beam')]) {
      element.setAttribute('x', String(inset));
      element.setAttribute('y', String(inset));
      element.setAttribute('width', String(Math.max(0, width - this.thickness)));
      element.setAttribute('height', String(Math.max(0, height - this.thickness)));
      element.setAttribute('rx', String(Math.max(0, radius - inset)));
      element.setAttribute('ry', String(Math.max(0, radius - inset)));
    }
  }

  private _renderBeams(): void {
    const beams: SVGRectElement[] = [];
    for (let index = 0; index < this.count; index += 1) {
      const beam = document.createElementNS(SVG_NAMESPACE, 'rect');
      beam.classList.add('beam');
      beam.part.add('beam');
      beam.setAttribute('pathLength', '100');
      beams.push(beam);
    }
    this._beamLayer.replaceChildren(...beams);
    this._updateAppearance();
  }

  private _updateAppearance(): void {
    const duration = BASE_DURATION_SECONDS / this.speed;
    const beamLength = Math.min(14, 60 / this.count);
    this.style.setProperty('--_beam-glow', `${Math.max(3, this.thickness * 2.5)}px`);
    if (this.color) this.style.setProperty('--_beam-color', this.color);
    else this.style.removeProperty('--_beam-color');
    this._track.setAttribute('stroke-width', String(Math.max(1, this.thickness * 0.5)));
    const beams = [...this._beamLayer.querySelectorAll<SVGRectElement>('.beam')];
    beams.forEach((beam, index) => {
      beam.setAttribute('stroke-width', String(this.thickness));
      beam.setAttribute('stroke-dasharray', `${beamLength} ${100 - beamLength}`);
      beam.style.animationDuration = `${duration}s`;
      beam.style.animationDelay = `${-(duration * index) / Math.max(1, beams.length)}s`;
    });
  }
}

export function defineBorderBeamComponents(): void {
  if (!customElements.get('hy-border-beam')) customElements.define('hy-border-beam', HYBorderBeam);
}
