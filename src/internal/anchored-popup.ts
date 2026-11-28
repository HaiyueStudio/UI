export const HY_COMBOBOX_STYLES = `
  :host { display: block; min-width: 0; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
  .control { display: flex; align-items: center; gap: var(--hy-space-2, 4px); min-height: var(--hy-control-height-sm, 28px); box-sizing: border-box; padding: 0 var(--hy-space-4, 8px); border: 1px solid var(--hy-border-color, #303746); border-radius: var(--hy-radius-sm, 4px); background: var(--hy-input-bg-color, var(--hy-surface-color, #121822)); }
  .control:focus-within { border-color: var(--hy-focus-border-color, #79a8ff); box-shadow: 0 0 0 2px var(--hy-focus-ring-color, rgba(61,111,168,.24)); }
  .control.disabled { opacity: .55; } input { flex: 1; width: 0; min-width: 30px; min-height: inherit; box-sizing: border-box; padding: 3px 0; border: 0; outline: 0; color: inherit; background: transparent; font: inherit; }
  input::placeholder { color: var(--hy-muted-text-color, #8290a3); } input:disabled { cursor: not-allowed; }
  .clear { flex: 0 0 auto; padding: 0 3px; border: 0; color: var(--hy-muted-text-color, #8290a3); background: transparent; font: inherit; cursor: pointer; }
  .clear:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); } button:disabled { cursor: not-allowed; }
  .panel { position: fixed; inset: auto; margin: 0; box-sizing: border-box; max-width: calc(100vw - 16px); max-height: var(--hy-popup-max-height, 280px); overflow: auto; padding: var(--hy-space-2, 4px); border: 1px solid var(--hy-border-color, #303746); border-radius: var(--hy-radius-sm, 4px); color: var(--hy-text-color, #d8e2f2); background: var(--hy-menu-bg-color, var(--hy-surface-elevated-color, #1b2230)); box-shadow: var(--hy-popup-shadow, 0 8px 24px rgba(0,0,0,.24)); font: inherit; z-index: var(--hy-popup-z-index, 1050); }
  .option { padding: var(--hy-space-3, 6px) var(--hy-space-4, 8px); border-radius: var(--hy-radius-xs, 2px); overflow-wrap: anywhere; cursor: pointer; }
  .option.active { color: var(--hy-selected-text-color, #fff); background: var(--hy-selected-bg-color, #255a91); }
  .option[aria-disabled="true"] { color: var(--hy-disabled-text-color, #65738a); cursor: not-allowed; }
  .status { padding: var(--hy-space-3, 6px) var(--hy-space-4, 8px); color: var(--hy-muted-text-color, #8290a3); } [hidden] { display: none !important; }
`;

export interface HYPopupAnimationOptions { duration: number; easing: string; }

/** Shared top-layer positioning and optional reversible reveal motion. */
export class HYAnchoredPopup {
  private _listeners: AbortController | null = null;
  private _observer: ResizeObserver | null = null;
  private _animation: Animation | null = null;
  private _shown = false;
  private _above = false;
  private _opacity = 1;
  private readonly _preference: MediaQueryList;
  constructor(private readonly _host: HTMLElement, private readonly _anchor: HTMLElement, readonly panel: HTMLElement, private readonly _dismiss: () => void, private readonly _side: 'bottom' | 'right' = 'bottom', private readonly _motion?: () => HYPopupAnimationOptions) {
    panel.setAttribute('popover', 'manual'); panel.hidden = true;
    this._preference = _host.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');
  }
  connect(): void {
    this.dispose(); this._listeners = new AbortController(); const { signal } = this._listeners; const document = this._host.ownerDocument;
    document.addEventListener('pointerdown', this._outside, { capture: true, signal });
    document.addEventListener('scroll', this._scroll, { capture: true, signal });
    document.defaultView?.addEventListener('resize', this.position, { signal });
    this._preference.addEventListener('change', this.finishAnimation, { signal });
    this._observer = new ResizeObserver(this.position); this._observer.observe(this._anchor); this._observer.observe(this.panel);
  }
  dispose(): void { this._listeners?.abort(); this._listeners = null; this._observer?.disconnect(); this._observer = null; this.hide(true); }
  show(): void {
    if (!this._host.isConnected) return;
    if (this._shown) { this.position(); return; }
    const from = this._animation ? this._currentFrame() : null;
    this._shown = true; this._animation?.cancel(); this._animation = null;
    this.panel.hidden = false;
    this.panel.inert = false; this.panel.removeAttribute('aria-hidden');
    if (this.panel.showPopover && !this.panel.matches(':popover-open')) this.panel.showPopover();
    this.position();
    if (!this._shown) return;
    if (!from) { const opacity = Number.parseFloat(getComputedStyle(this.panel).opacity); this._opacity = Number.isFinite(opacity) ? opacity : 1; }
    this._transition(from ?? { clipPath: this._collapsedClip(), opacity: '0' });
  }
  hide(immediate = false): void {
    if (!immediate && !this._shown && this._animation) return;
    const wasVisible = !this.panel.hidden; const from = wasVisible ? this._currentFrame() : null;
    this._shown = false; this.panel.inert = true; this.panel.setAttribute('aria-hidden', 'true');
    if (immediate || !from) this.finishAnimation(); else this._transition(from);
  }
  finishAnimation = (): void => {
    this._animation?.cancel(); this._animation = null;
    if (!this._shown) {
      if (this.panel.hidePopover && this.panel.matches(':popover-open')) this.panel.hidePopover();
      this.panel.hidden = true;
    }
  };
  private _currentFrame(): { clipPath: string; opacity: string } { const style = getComputedStyle(this.panel); return { clipPath: style.clipPath === 'none' ? 'inset(0% 0% 0% 0%)' : style.clipPath, opacity: style.opacity }; }
  private _collapsedClip(): string { return this._above ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)'; }
  private _transition(from: { clipPath: string; opacity: string }): void {
    this._animation?.cancel(); this._animation = null;
    const settings = this._motion?.(); const duration = this._preference.matches ? 0 : settings?.duration ?? 0;
    if (!duration) { this.finishAnimation(); return; }
    const to = this._shown ? { clipPath: 'inset(0% 0% 0% 0%)', opacity: String(this._opacity) } : { clipPath: this._collapsedClip(), opacity: '0' };
    const animation = this.panel.animate([from, to], { duration, easing: settings!.easing, fill: 'both' }); this._animation = animation;
    void animation.finished.then(() => { if (this._animation === animation) this.finishAnimation(); }, () => { /* Reversal or disposal cancels the previous reveal. */ });
  }
  position = (): void => {
    if (this.panel.hidden || !this._host.isConnected) return;
    const view = this._host.ownerDocument.defaultView; if (!view) return;
    const anchor = this._anchor.getBoundingClientRect();
    if (anchor.bottom < 0 || anchor.top > view.innerHeight || anchor.right < 0 || anchor.left > view.innerWidth) { this._dismiss(); return; }
    const width = Math.min(Math.max(anchor.width, 180), view.innerWidth - 16);
    if (this._side === 'bottom') this.panel.style.width = `${width}px`;
    const panel = this.panel.getBoundingClientRect();
    let left = anchor.left; let top = anchor.bottom + 4; this._above = false;
    if (this._side === 'right') { left = anchor.right + 4; top = anchor.top; if (left + panel.width > view.innerWidth - 8) left = anchor.left - panel.width - 4; }
    else if (top + panel.height > view.innerHeight - 8 && anchor.top > view.innerHeight - anchor.bottom) { top = anchor.top - panel.height - 4; this._above = true; }
    this.panel.style.left = `${Math.max(8, Math.min(left, view.innerWidth - panel.width - 8))}px`;
    this.panel.style.top = `${Math.max(8, Math.min(top, view.innerHeight - panel.height - 8))}px`;
  };
  private _outside = (event: PointerEvent): void => { if (!this.panel.hidden && !event.composedPath().includes(this._host)) this._dismiss(); };
  private _scroll = (event: Event): void => { if (!event.composedPath().includes(this.panel)) this.position(); };
}
