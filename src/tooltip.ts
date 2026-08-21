export type HYTooltipPlacement =
  | 'top'
  | 'topLeft'
  | 'topRight'
  | 'bottom'
  | 'bottomLeft'
  | 'bottomRight'
  | 'left'
  | 'leftTop'
  | 'leftBottom'
  | 'right'
  | 'rightTop'
  | 'rightBottom';

const DEFAULT_DELAY = 1000;
const VIEWPORT_PADDING = 8;
const TRIGGER_GAP = 8;
const ARROW_SIZE = 8;
const ARROW_OFFSET = 16;
const TOOLTIP_PLACEMENTS = new Set<HYTooltipPlacement>([
  'top',
  'topLeft',
  'topRight',
  'bottom',
  'bottomLeft',
  'bottomRight',
  'left',
  'leftTop',
  'leftBottom',
  'right',
  'rightTop',
  'rightBottom',
]);

export class HYTooltip extends HTMLElement {
  private readonly _root: ShadowRoot;
  private readonly _style = document.createElement('style');
  private readonly _slot = document.createElement('slot');
  private readonly _tooltip = document.createElement('div');
  private readonly _content = document.createElement('div');
  private readonly _arrow = document.createElement('span');
  private _showTimer: number | null = null;
  private _visible = false;

  static get observedAttributes(): string[] {
    return ['label', 'placement', 'delay', 'disabled', 'arrow', 'no-arrow'];
  }

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    this._style.textContent = `
      :host {
        display: inline-block;
        width: max-content;
        min-width: 0;
      }
      .tooltip {
        position: fixed;
        z-index: 10001;
        box-sizing: border-box;
        max-width: min(280px, calc(100vw - 16px));
        padding: 5px 8px;
        border-radius: 4px;
        color: var(--hy-tooltip-text-color, #f4f7fb);
        background: var(--hy-tooltip-bg-color, #0f141c);
        border: 1px solid var(--hy-tooltip-border-color, rgba(255, 255, 255, 0.08));
        box-shadow: 0 8px 24px var(--hy-tooltip-shadow-color, rgba(0, 0, 0, 0.35));
        font: 12px system-ui, sans-serif;
        line-height: 1.35;
        width: max-content;
        white-space: normal;
        overflow-wrap: anywhere;
        pointer-events: none;
        opacity: 0;
        transform: translate3d(0, -2px, 0);
        transition: opacity 0.12s ease, transform 0.12s ease;
      }
      .arrow {
        position: absolute;
        width: ${ARROW_SIZE}px;
        height: ${ARROW_SIZE}px;
        background: var(--hy-tooltip-bg-color, #0f141c);
        border: solid var(--hy-tooltip-border-color, rgba(255, 255, 255, 0.08));
        border-width: 0 1px 1px 0;
        transform: rotate(45deg);
      }
      .tooltip.no-arrow .arrow {
        display: none;
      }
      .tooltip.visible {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }
    `;
    this._tooltip.className = 'tooltip';
    this._tooltip.setAttribute('role', 'tooltip');
    this._content.className = 'content';
    this._arrow.className = 'arrow';
    this._tooltip.append(this._content, this._arrow);
    this._root.append(this._style, this._slot, this._tooltip);
  }

  connectedCallback(): void {
    this.addEventListener('pointerenter', this._onEnter);
    this.addEventListener('pointerleave', this._onLeave);
    this.addEventListener('focusin', this._onEnter);
    this.addEventListener('focusout', this._onLeave);
    this.addEventListener('keydown', this._onKeyDown);
    this._syncLabel();
  }

  disconnectedCallback(): void {
    this.removeEventListener('pointerenter', this._onEnter);
    this.removeEventListener('pointerleave', this._onLeave);
    this.removeEventListener('focusin', this._onEnter);
    this.removeEventListener('focusout', this._onLeave);
    this.removeEventListener('keydown', this._onKeyDown);
    this._clearShowTimer();
    this._hide();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'label') this._syncLabel();
    if (name === 'arrow' || name === 'no-arrow') this._syncArrow();
    if ((name === 'placement' || name === 'disabled' || name === 'arrow' || name === 'no-arrow') && this._visible) {
      this._syncPosition();
    }
  }

  get label(): string {
    return this.getAttribute('label') ?? '';
  }

  set label(value: string) {
    if (value) this.setAttribute('label', value);
    else this.removeAttribute('label');
  }

  get placement(): HYTooltipPlacement {
    return normalizePlacement(this.getAttribute('placement'));
  }

  set placement(value: HYTooltipPlacement) {
    this.setAttribute('placement', value);
  }

  get delay(): number {
    const value = Number(this.getAttribute('delay'));
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DELAY;
  }

  set delay(value: number) {
    this.setAttribute('delay', String(Math.max(0, value)));
  }

  get arrow(): boolean {
    if (this.hasAttribute('no-arrow')) return false;
    const value = this.getAttribute('arrow');
    return value === null || value !== 'false';
  }

  set arrow(value: boolean) {
    if (value) {
      this.removeAttribute('no-arrow');
      this.setAttribute('arrow', '');
    } else {
      this.setAttribute('arrow', 'false');
    }
  }

  private _onEnter = (): void => {
    if (this.hasAttribute('disabled') || !this.label) return;
    this._clearShowTimer();
    this._showTimer = window.setTimeout(() => this._show(), this.delay);
  };

  private _onLeave = (): void => {
    this._clearShowTimer();
    this._hide();
  };

  private _onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this._hide();
  };

  private _show(): void {
    this._showTimer = null;
    if (!this.isConnected || this.hasAttribute('disabled') || !this.label) return;
    this._visible = true;
    this._syncArrow();
    this._syncPosition();
    this._tooltip.classList.add('visible');
    window.addEventListener('scroll', this._onViewportChange, { capture: true, passive: true });
    window.addEventListener('resize', this._onViewportChange);
  }

  private _hide(): void {
    if (!this._visible) return;
    this._visible = false;
    this._tooltip.classList.remove('visible');
    window.removeEventListener('scroll', this._onViewportChange, { capture: true });
    window.removeEventListener('resize', this._onViewportChange);
  }

  private _onViewportChange = (): void => {
    if (this._visible) this._syncPosition();
  };

  private _syncLabel(): void {
    this._content.textContent = this.label;
  }

  private _syncArrow(): void {
    this._tooltip.classList.toggle('no-arrow', !this.arrow);
  }

  private _syncPosition(): void {
    const hostRect = this.getBoundingClientRect();
    const tooltipRect = this._measureTooltip();
    const placement = this.placement;
    let top = getAlignedTop(hostRect, tooltipRect, placement);
    let left = getAlignedLeft(hostRect, tooltipRect, placement);

    if (placement.startsWith('top')) top = hostRect.top - tooltipRect.height - TRIGGER_GAP;
    else if (placement.startsWith('bottom')) top = hostRect.bottom + TRIGGER_GAP;
    else if (placement.startsWith('left')) left = hostRect.left - tooltipRect.width - TRIGGER_GAP;
    else if (placement.startsWith('right')) left = hostRect.right + TRIGGER_GAP;

    top = clamp(top, VIEWPORT_PADDING, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING);
    left = clamp(left, VIEWPORT_PADDING, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING);
    this._tooltip.style.top = `${top}px`;
    this._tooltip.style.left = `${left}px`;
    this._syncArrowPosition(hostRect, tooltipRect, top, left, placement);
  }

  private _syncArrowPosition(
    hostRect: DOMRect,
    tooltipRect: DOMRect,
    top: number,
    left: number,
    placement: HYTooltipPlacement,
  ): void {
    const x = clamp(hostRect.left + hostRect.width / 2 - left - ARROW_SIZE / 2, ARROW_OFFSET, tooltipRect.width - ARROW_OFFSET - ARROW_SIZE);
    const y = clamp(hostRect.top + hostRect.height / 2 - top - ARROW_SIZE / 2, ARROW_OFFSET, tooltipRect.height - ARROW_OFFSET - ARROW_SIZE);
    this._arrow.style.inset = 'auto';

    if (placement.startsWith('top')) {
      this._arrow.style.left = `${x}px`;
      this._arrow.style.bottom = `${-ARROW_SIZE / 2}px`;
      this._arrow.style.transform = 'rotate(45deg)';
      return;
    }

    if (placement.startsWith('bottom')) {
      this._arrow.style.left = `${x}px`;
      this._arrow.style.top = `${-ARROW_SIZE / 2}px`;
      this._arrow.style.transform = 'rotate(225deg)';
      return;
    }

    if (placement.startsWith('left')) {
      this._arrow.style.top = `${y}px`;
      this._arrow.style.right = `${-ARROW_SIZE / 2}px`;
      this._arrow.style.transform = 'rotate(315deg)';
      return;
    }

    this._arrow.style.top = `${y}px`;
    this._arrow.style.left = `${-ARROW_SIZE / 2}px`;
    this._arrow.style.transform = 'rotate(135deg)';
  }

  private _measureTooltip(): DOMRect {
    const previousVisibility = this._tooltip.style.visibility;
    const previousOpacity = this._tooltip.style.opacity;
    this._tooltip.style.visibility = 'hidden';
    this._tooltip.style.opacity = '0';
    this._tooltip.classList.add('visible');
    const rect = this._tooltip.getBoundingClientRect();
    this._tooltip.classList.toggle('visible', this._visible);
    this._tooltip.style.visibility = previousVisibility;
    this._tooltip.style.opacity = previousOpacity;
    return rect;
  }

  private _clearShowTimer(): void {
    if (this._showTimer === null) return;
    window.clearTimeout(this._showTimer);
    this._showTimer = null;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function normalizePlacement(value: string | null): HYTooltipPlacement {
  return value && TOOLTIP_PLACEMENTS.has(value as HYTooltipPlacement)
    ? value as HYTooltipPlacement
    : 'top';
}

function getAlignedTop(hostRect: DOMRect, tooltipRect: DOMRect, placement: HYTooltipPlacement): number {
  if (placement.endsWith('Top')) return hostRect.top;
  if (placement.endsWith('Bottom')) return hostRect.bottom - tooltipRect.height;
  return hostRect.top + (hostRect.height - tooltipRect.height) / 2;
}

function getAlignedLeft(hostRect: DOMRect, tooltipRect: DOMRect, placement: HYTooltipPlacement): number {
  if (placement.endsWith('Left')) return hostRect.left;
  if (placement.endsWith('Right')) return hostRect.right - tooltipRect.width;
  return hostRect.left + (hostRect.width - tooltipRect.width) / 2;
}

export function defineTooltipComponents(): void {
  if (!customElements.get('hy-tooltip')) {
    customElements.define('hy-tooltip', HYTooltip);
  }
}
