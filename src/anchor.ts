export type HYAnchorDirection = 'vertical' | 'horizontal';

export interface HYAnchorItem {
  readonly href: string;
  readonly title: string;
  readonly key?: string;
  readonly disabled?: boolean;
  readonly children?: readonly HYAnchorItem[];
}

export interface HYAnchorChangeDetail {
  readonly href: string;
  readonly item: HYAnchorItem | null;
}

export interface HYAnchorClickDetail extends HYAnchorChangeDetail {
  readonly nativeEvent: MouseEvent;
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

/** Hash-link navigation that tracks targets inside the viewport or an owned scroll container. */
export class HYAnchor extends HTMLElement {
  private readonly _nav = document.createElement('nav');
  private readonly _list = document.createElement('div');
  private _items: HYAnchorItem[] = [];
  private _scrollContainer: HTMLElement | Window | null = null;
  private _listeners: AbortController | null = null;
  private _frame = 0;
  private _programmaticHref: string | null = null;
  private _scrollEndTimer = 0;

  static get observedAttributes(): string[] {
    return ['items', 'active-href', 'offset-top', 'bounds', 'direction', 'smooth', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-secondary-text-color, #8fa7c8); font: 12px/1.5 system-ui, sans-serif; }
      nav { position: relative; min-width: 0; }
      .list { display: flex; min-width: 0; flex-direction: column; gap: 2px; border-inline-start: 1px solid var(--hy-anchor-rail-color, var(--hy-border-color, #303746)); }
      .item { position: relative; min-width: 0; }
      a { display: block; min-width: 0; padding: 5px 10px 5px calc(10px + var(--_depth, 0) * 14px); border-radius: 0 4px 4px 0; overflow: hidden; color: inherit; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; transition: color 120ms ease, background 120ms ease; }
      a::before { content: ''; position: absolute; inset-block: 5px; inset-inline-start: -1px; width: 2px; border-radius: 2px; background: transparent; }
      a:hover { color: var(--hy-text-color, #d8e2f2); background: var(--hy-hover-bg-color, #222b3a); }
      a.active { color: var(--hy-anchor-active-color, var(--hy-accent-color, #6fc8ef)); }
      a.active::before { background: currentColor; }
      a.disabled { opacity: 0.45; cursor: default; }
      a:focus-visible { outline: 2px solid var(--hy-focus-border-color, #3d6fa8); outline-offset: -2px; }
      :host([direction="horizontal"]) .list { flex-direction: row; gap: 4px; overflow-x: auto; border-inline-start: 0; border-block-end: 1px solid var(--hy-anchor-rail-color, var(--hy-border-color, #303746)); }
      :host([direction="horizontal"]) .item { flex: none; }
      :host([direction="horizontal"]) a { padding: 7px 10px; border-radius: 4px 4px 0 0; }
      :host([direction="horizontal"]) a::before { inset: auto 6px -1px; width: auto; height: 2px; }
      @media (prefers-reduced-motion: reduce) { a { transition: none; } }
    `;
    this._nav.part.add('nav');
    this._list.className = 'list';
    this._list.part.add('list');
    this._nav.append(this._list);
    root.append(style, this._nav);
  }

  connectedCallback(): void {
    if (this.hasAttribute('items')) this._readItemsAttribute();
    this._render();
    this._connect();
    queueMicrotask(() => this.refresh());
  }

  disconnectedCallback(): void { this._disconnect(); }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === 'items') this._readItemsAttribute();
    this._render();
    if (this.isConnected && ['offset-top', 'bounds'].includes(name)) this.refresh();
  }

  get items(): HYAnchorItem[] { return this._items; }
  set items(value: HYAnchorItem[]) { this._items = this._normalizeItems(value); this._render(); this.refresh(); }
  get activeHref(): string { return this.getAttribute('active-href') ?? ''; }
  set activeHref(value: string) { if (value) this.setAttribute('active-href', value); else this.removeAttribute('active-href'); }
  get offsetTop(): number { return finiteNumber(this.getAttribute('offset-top'), 0, 0, 10000); }
  set offsetTop(value: number) { this.setAttribute('offset-top', String(finiteNumber(value, 0, 0, 10000))); }
  get bounds(): number { return finiteNumber(this.getAttribute('bounds'), 5, 0, 1000); }
  set bounds(value: number) { this.setAttribute('bounds', String(finiteNumber(value, 5, 0, 1000))); }
  get direction(): HYAnchorDirection { return this.getAttribute('direction') === 'horizontal' ? 'horizontal' : 'vertical'; }
  set direction(value: HYAnchorDirection) { this.setAttribute('direction', value); }
  get smooth(): boolean { return this.hasAttribute('smooth'); }
  set smooth(value: boolean) { this.toggleAttribute('smooth', Boolean(value)); }
  get scrollContainer(): HTMLElement | Window | null { return this._scrollContainer; }
  set scrollContainer(value: HTMLElement | Window | null) {
    this._scrollContainer = value instanceof HTMLElement || value === window ? value : null;
    if (this.isConnected) { this._connect(); this.refresh(); }
  }

  scrollToAnchor(href: string): boolean {
    const target = this._resolveTarget(href);
    if (!target) return false;
    const container = this._scrollContainer ?? window;
    const behavior: ScrollBehavior = this.smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto';
    this._programmaticHref = href;
    this._setActive(href, true);
    if (container instanceof HTMLElement) {
      const top = container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - this.offsetTop;
      container.scrollTo({ top, behavior });
    } else {
      const top = window.scrollY + target.getBoundingClientRect().top - this.offsetTop;
      window.scrollTo({ top, behavior });
    }
    this._scheduleScrollEnd();
    return true;
  }

  refresh(): void {
    cancelAnimationFrame(this._frame);
    this._frame = requestAnimationFrame(() => this._measure());
  }

  private _normalizeItems(value: unknown): HYAnchorItem[] {
    if (!Array.isArray(value)) return [];
    return value.map(raw => {
      const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      const href = String(item.href ?? item.key ?? '');
      const normalized: HYAnchorItem = {
        href,
        title: String(item.title ?? item.label ?? href),
        disabled: Boolean(item.disabled),
        children: this._normalizeItems(item.children),
      };
      if (item.key != null) return { ...normalized, key: String(item.key) };
      return normalized;
    }).filter(item => Boolean(item.href));
  }

  private _readItemsAttribute(): void {
    const raw = this.getAttribute('items');
    if (!raw) { this._items = []; return; }
    try { this._items = this._normalizeItems(JSON.parse(raw)); }
    catch (error) { console.warn('Invalid hy-anchor items attribute.', error); this._items = []; }
  }

  private _flatten(items = this._items): HYAnchorItem[] {
    return items.flatMap(item => [item, ...this._flatten([...(item.children ?? [])])]);
  }

  private _render(): void {
    if (!this._list) return;
    this._nav.setAttribute('aria-label', this.getAttribute('aria-label') ?? 'On this page');
    this._list.replaceChildren();
    const append = (items: readonly HYAnchorItem[], depth: number): void => {
      for (const item of items) {
        const wrap = document.createElement('div');
        const link = document.createElement('a');
        wrap.className = 'item'; wrap.part.add('item');
        link.part.add('link'); link.href = item.href; link.textContent = item.title; link.dataset.href = item.href;
        link.style.setProperty('--_depth', String(depth));
        link.classList.toggle('active', item.href === this.activeHref);
        link.classList.toggle('disabled', Boolean(item.disabled));
        if (item.href === this.activeHref) link.setAttribute('aria-current', 'location');
        if (item.disabled) { link.setAttribute('aria-disabled', 'true'); link.tabIndex = -1; }
        link.addEventListener('click', event => this._onClick(event, item));
        wrap.append(link); this._list.append(wrap);
        append(item.children ?? [], depth + 1);
      }
    };
    append(this._items, 0);
  }

  private _onClick(event: MouseEvent, item: HYAnchorItem): void {
    if (item.disabled) { event.preventDefault(); return; }
    const custom = new CustomEvent<HYAnchorClickDetail>('anchor-click', {
      detail: { href: item.href, item, nativeEvent: event }, bubbles: true, composed: true, cancelable: true,
    });
    if (!this.dispatchEvent(custom)) { event.preventDefault(); return; }
    if (item.href.startsWith('#')) {
      event.preventDefault();
      if (this.scrollToAnchor(item.href)) history.replaceState(null, '', item.href);
    }
  }

  private _resolveTarget(href: string): HTMLElement | null {
    if (!href.startsWith('#')) return null;
    try { return document.getElementById(decodeURIComponent(href.slice(1))); }
    catch { return null; }
  }

  private _connect(): void {
    this._disconnect();
    const abort = new AbortController(); this._listeners = abort;
    const target = this._scrollContainer ?? window;
    target.addEventListener('scroll', () => {
      if (this._programmaticHref) this._scheduleScrollEnd();
      this.refresh();
    }, { passive: true, signal: abort.signal });
    target.addEventListener('scrollend', () => this._finishProgrammaticScroll(), { passive: true, signal: abort.signal });
    window.addEventListener('resize', () => this.refresh(), { passive: true, signal: abort.signal });
  }

  private _disconnect(): void {
    this._listeners?.abort(); this._listeners = null;
    cancelAnimationFrame(this._frame); this._frame = 0;
    window.clearTimeout(this._scrollEndTimer); this._scrollEndTimer = 0;
    this._programmaticHref = null;
  }

  private _measure(): void {
    if (!this.isConnected) return;
    if (this._programmaticHref) {
      this._setActive(this._programmaticHref, false);
      return;
    }
    const container = this._scrollContainer ?? window;
    const threshold = (container instanceof HTMLElement ? container.getBoundingClientRect().top : 0) + this.offsetTop + this.bounds;
    const candidates = this._flatten().filter(item => !item.disabled).map(item => ({ item, target: this._resolveTarget(item.href) })).filter((entry): entry is { item: HYAnchorItem; target: HTMLElement } => Boolean(entry.target));
    if (!candidates.length) return;
    let active = candidates[0]!.item;
    for (const entry of candidates) {
      if (entry.target.getBoundingClientRect().top <= threshold) active = entry.item;
      else break;
    }
    this._setActive(active.href, true);
  }

  private _scheduleScrollEnd(): void {
    window.clearTimeout(this._scrollEndTimer);
    this._scrollEndTimer = window.setTimeout(() => this._finishProgrammaticScroll(), 160);
  }

  private _finishProgrammaticScroll(): void {
    if (!this._programmaticHref) return;
    window.clearTimeout(this._scrollEndTimer); this._scrollEndTimer = 0;
    this._programmaticHref = null;
    this.refresh();
  }

  private _setActive(href: string, emit: boolean): void {
    if (!href || href === this.activeHref) return;
    this.setAttribute('active-href', href);
    if (!emit) return;
    const item = this._flatten().find(candidate => candidate.href === href) ?? null;
    this.dispatchEvent(new CustomEvent<HYAnchorChangeDetail>('anchor-change', {
      detail: { href, item }, bubbles: true, composed: true,
    }));
  }
}

export function defineAnchorComponents(): void {
  if (!customElements.get('hy-anchor')) customElements.define('hy-anchor', HYAnchor);
}
