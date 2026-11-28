import { finiteNumber } from './numbers.js';

interface RowMotion { animation: Animation; visible: boolean; }
const bounded = (value: number): number => Math.max(0, Math.min(10000, value));

/** Animates flat tree rows without changing logical visibility or virtual row geometry. */
export class HYTreeMotion {
  private readonly _motions = new Map<HTMLElement, RowMotion>();
  private readonly _preference: MediaQueryList;
  private _visible = new Set<HTMLElement>();
  private _virtualized = false;

  constructor(private readonly _host: HTMLElement, private readonly _list: HTMLElement, private readonly _removed: (row: HTMLElement) => void, private readonly _height = 28) {
    this._preference = _host.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');
  }

  connect(): void { this._preference.addEventListener('change', this._onPreference); }
  disconnect(): void { this._preference.removeEventListener('change', this._onPreference); this.finish(); }

  duration(arrow = false, tokens = false): number {
    const common = bounded(finiteNumber(this._host.getAttribute('animation-duration'), 200));
    const fallback = arrow && !this._host.hasAttribute('animation-duration') && !this.animated ? 160 : common;
    const attribute = arrow ? 'arrow-animation-duration' : 'animation-duration';
    if (this._host.hasAttribute(attribute)) return bounded(finiteNumber(this._host.getAttribute(attribute), fallback));
    if (arrow && this._host.hasAttribute('animation-duration')) return common;
    if (!tokens) return fallback;
    const style = getComputedStyle(this._host);
    const raw = (arrow ? style.getPropertyValue('--hy-tree-arrow-animation-duration').trim() : '') || (!this._host.hasAttribute('animation-duration') ? style.getPropertyValue('--hy-tree-animation-duration').trim() : '');
    if (!raw) return fallback;
    const match = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*(ms|s)$/u.exec(raw);
    const value = match ? Number(match[1]) * (match[2] === 's' ? 1000 : 1) : NaN;
    return Number.isFinite(value) ? bounded(value) : fallback;
  }

  get animated(): boolean { return this._host.hasAttribute('animated') && this._host.getAttribute('animated') !== 'false'; }
  private get _easing(): string {
    const value = getComputedStyle(this._host).getPropertyValue('--hy-tree-animation-easing').trim() || 'ease';
    return CSS.supports('transition-timing-function', value) ? value : 'ease';
  }

  render(rows: HTMLElement[], animate: boolean, virtualized: boolean): void {
    const duration = this.animated && this._host.isConnected && !this._preference.matches && !virtualized && !this._virtualized ? this.duration(false, true) : 0;
    this._virtualized = virtualized;
    this._syncArrow();
    const desired = new Set(rows); const previous = [...this._list.children] as HTMLElement[];
    const transitions: { row: HTMLElement; visible: boolean; height: number; opacity: number }[] = [];
    const exiting = new Set<HTMLElement>();
    for (const row of previous) {
      if (desired.has(row)) continue;
      const motion = this._motions.get(row);
      if (duration && row.classList.contains('row') && (motion || animate && this._visible.has(row))) {
        exiting.add(row);
        if (!motion || motion.visible) transitions.push(this._capture(row, false));
        row.inert = true; row.setAttribute('aria-hidden', 'true');
        if (row.matches(':focus-within')) this._host.focus({ preventScroll: true });
      } else this._remove(row);
    }
    for (const row of rows) {
      const motion = this._motions.get(row);
      if (!duration) { this._stop(row); continue; }
      if (!this._visible.has(row) && animate && row.classList.contains('row')) {
        transitions.push(motion ? this._capture(row, true) : { row, visible: true, height: 0, opacity: 0 });
      }
      row.inert = false; row.removeAttribute('aria-hidden');
    }
    // Keep closing rows before their next surviving sibling until their height reaches zero.
    const groups = new Map<HTMLElement | null, HTMLElement[]>(); let anchor: HTMLElement | null = null;
    for (let index = previous.length - 1; index >= 0; index--) {
      const row = previous[index]!;
      if (desired.has(row)) anchor = row;
      else if (exiting.has(row)) { const group = groups.get(anchor) ?? []; group.unshift(row); groups.set(anchor, group); }
    }
    const ordered = rows.flatMap(row => [...(groups.get(row) ?? []), row]); ordered.push(...groups.get(null) ?? []);
    let cursor = this._list.firstChild;
    const parent = this._list as HTMLElement & { moveBefore?: (node: Node, child: Node | null) => void };
    for (const row of ordered) {
      if (cursor === row) { cursor = cursor.nextSibling; continue; }
      if (parent.moveBefore && parent.isConnected && row.parentElement === parent) parent.moveBefore(row, cursor);
      else parent.insertBefore(row, cursor);
    }
    this._visible = desired;
    for (const transition of transitions) this._animate(transition, duration);
  }

  finish(): void {
    for (const [row, motion] of [...this._motions]) {
      if (motion.visible) this._stop(row); else this._remove(row);
    }
    for (const icon of this._list.querySelectorAll('.toggle-icon')) {
      for (const animation of icon.getAnimations()) if ('transitionProperty' in animation) animation.cancel();
    }
    this._syncArrow();
  }

  private _capture(row: HTMLElement, visible: boolean): { row: HTMLElement; visible: boolean; height: number; opacity: number } {
    const style = getComputedStyle(row);
    return { row, visible, height: row.getBoundingClientRect().height, opacity: finiteNumber(style.opacity, 1) };
  }

  private _animate(state: { row: HTMLElement; visible: boolean; height: number; opacity: number }, duration: number): void {
    const { row, visible, height, opacity } = state;
    this._stop(row); row.toggleAttribute('data-hy-tree-motion', true);
    row.inert = !visible; if (!visible) row.setAttribute('aria-hidden', 'true');
    const animation = row.animate([{ height: `${height}px`, opacity }, { height: `${visible ? this._height : 0}px`, opacity: visible ? 1 : 0 }], { duration, easing: this._easing, fill: 'both' });
    const motion = { animation, visible }; this._motions.set(row, motion);
    void animation.finished.then(() => {
      if (this._motions.get(row) !== motion) return;
      if (visible) this._stop(row); else this._remove(row);
    }, () => { /* Reversal, replacement and disconnect settle the previous effect. */ });
  }

  private _stop(row: HTMLElement): void {
    this._motions.get(row)?.animation.cancel(); this._motions.delete(row);
    row.removeAttribute('data-hy-tree-motion');
    if (row.classList.contains('row')) { row.inert = false; row.removeAttribute('aria-hidden'); }
  }
  private _remove(row: HTMLElement): void { this._stop(row); row.remove(); this._visible.delete(row); this._removed(row); }
  private _syncArrow(): void {
    const duration = this._preference.matches || this._host.getAttribute('arrow-animated') === 'false' ? 0 : this.duration(true, true);
    this._list.style.setProperty('--_hy-tree-arrow-duration', `${duration}ms`);
    this._list.style.setProperty('--_hy-tree-animation-easing', this._easing);
  }
  private _onPreference = (): void => { this.finish(); };
}
