export type HYCollapseKey = string;
export type HYCollapseIconPosition = 'start' | 'end';
export type HYCollapseTrigger = 'header' | 'icon' | 'disabled';
export type HYCollapseContent = string | Node | (() => string | Node);

export interface HYCollapseItem {
  readonly key: HYCollapseKey;
  readonly title: string;
  readonly content?: HYCollapseContent;
  readonly extra?: string;
  readonly disabled?: boolean;
  readonly showArrow?: boolean;
}

export interface HYCollapseChangeDetail {
  readonly activeKeys: readonly HYCollapseKey[];
  readonly changedKey: HYCollapseKey;
  readonly expanded: boolean;
}

interface PanelRecord {
  readonly item: HYCollapseItem;
  readonly section: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly arrow: HTMLElement;
  readonly region: HTMLElement;
  readonly body: HTMLElement;
  rendered: boolean;
  expanded: boolean | null;
  animation: Animation | null;
  targetHeight: number;
}

let collapseInstance = 0;

function parseKeys(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? [...new Set(parsed.map(String))] : [String(parsed)];
  } catch {
    return [...new Set(value.split(',').map(key => key.trim()).filter(Boolean))];
  }
}

/** Accessible accordion and multi-panel disclosure group. */
export class HYCollapse extends HTMLElement {
  private readonly _container = document.createElement('div');
  private readonly _uid = `hy-collapse-${++collapseInstance}`;
  private _items: readonly HYCollapseItem[] = [];
  private _itemsAssigned = false;
  private _activeKeys: string[] = [];
  private _panels = new Map<string, PanelRecord>();
  private readonly _motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly _resizeObserver = new ResizeObserver(() => {
    for (const panel of this._panels.values()) {
      if (panel.animation && panel.expanded && panel.targetHeight !== panel.body.offsetHeight) {
        this._transition(panel, Number.parseFloat(getComputedStyle(panel.region).height), this._duration());
      }
    }
  });

  static get observedAttributes(): string[] {
    return ['items', 'active-keys', 'default-active-keys', 'accordion', 'bordered', 'ghost', 'icon-position', 'collapsible', 'destroy-on-hidden', 'animated', 'animation-duration', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #eef3ff); font: 12px/1.5 system-ui, sans-serif; }
      .collapse { overflow: hidden; border: 1px solid var(--hy-border-color, #3d4654); border-radius: var(--hy-collapse-radius, 8px); background: var(--hy-surface-color, #111722); }
      .panel + .panel { border-top: 1px solid var(--hy-border-color, #3d4654); }
      .header { display: flex; min-height: var(--hy-collapse-header-height, 44px); align-items: center; background: var(--hy-collapse-header-bg, color-mix(in srgb, var(--hy-surface-elevated-color, #171d27) 82%, transparent)); }
      .trigger { display: flex; min-width: 0; min-height: inherit; flex: 1 1 auto; align-items: center; gap: 10px; padding: 9px 14px; border: 0; color: inherit; background: transparent; cursor: pointer; font: inherit; text-align: start; }
      .trigger:hover:not(:disabled) { background: var(--hy-hover-bg-color, #273241); }
      .trigger:focus-visible { position: relative; z-index: 1; outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: -2px; }
      .trigger:disabled { color: var(--hy-muted-color, #788697); cursor: not-allowed; }
      .arrow { display: grid; width: 16px; height: 16px; flex: 0 0 auto; place-items: center; color: var(--hy-muted-color, #788697); transition: transform var(--hy-collapse-animation-duration, 200ms) var(--hy-collapse-animation-easing, ease); }
      .arrow::before { content: ''; width: 6px; height: 6px; border-block-start: 1.5px solid currentColor; border-inline-end: 1.5px solid currentColor; transform: rotate(45deg); }
      .panel.expanded .arrow { transform: rotate(90deg); }
      .title { min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .extra { flex: 0 0 auto; padding-inline: var(--hy-collapse-extra-gap, 10px) 14px; color: var(--hy-muted-color, #788697); font-size: 10px; }
      .region[hidden] { display: none; }
      .body { padding: var(--hy-collapse-content-padding, 16px); border-top: 1px solid var(--hy-border-color, #3d4654); color: var(--hy-secondary-text-color, #aebbd0); background: var(--hy-collapse-content-bg, transparent); }
      :host([icon-position="end"]) .arrow { order: 2; }
      :host([bordered="false"]) .collapse { border: 0; border-radius: 0; }
      :host([ghost]) .collapse { border: 0; background: transparent; }
      :host([ghost]) .panel + .panel { border-top-color: transparent; }
      :host([ghost]) .header, :host([ghost]) .body { border: 0; background: transparent; }
      @media (prefers-reduced-motion: reduce) { .arrow { transition: none; } }
    `;
    this._container.className = 'collapse'; this._container.part.add('collapse'); this._container.setAttribute('role', 'group'); root.append(style, this._container);
  }

  connectedCallback(): void {
    this._motion.addEventListener('change', this._onMotionChange);
    if (!this._itemsAssigned && this.hasAttribute('items')) this._readItemsAttribute();
    this._activeKeys = this.hasAttribute('active-keys') ? parseKeys(this.getAttribute('active-keys')) : parseKeys(this.getAttribute('default-active-keys'));
    this._normalizeActiveKeys(); this._syncItems(); this._syncLabel();
  }

  disconnectedCallback(): void {
    this._motion.removeEventListener('change', this._onMotionChange);
    this._resizeObserver.disconnect();
    for (const panel of this._panels.values()) this._finishTransition(panel);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === 'items' && !this._itemsAssigned) { this._readItemsAttribute(); this._syncItems(); return; }
    if (name === 'active-keys') { this._activeKeys = parseKeys(newValue); this._normalizeActiveKeys(); this._syncExpanded(); return; }
    if (name === 'default-active-keys' && !this.hasAttribute('active-keys')) { this._activeKeys = parseKeys(newValue); this._normalizeActiveKeys(); this._syncExpanded(); return; }
    if (name === 'aria-label') { this._syncLabel(); return; }
    if (name === 'accordion') { this._normalizeActiveKeys(); this._reflectActiveKeys(); }
    this._syncExpanded();
  }

  get items(): readonly HYCollapseItem[] { return this._items; }
  set items(value: readonly HYCollapseItem[]) {
    this._itemsAssigned = true;
    this._items = Array.isArray(value) ? value.flatMap(item => item && item.key != null && item.title != null ? [{ ...item, key: String(item.key), title: String(item.title) }] : []) : [];
    this._normalizeActiveKeys(); this._syncItems();
  }
  get activeKeys(): readonly HYCollapseKey[] { return [...this._activeKeys]; }
  set activeKeys(value: readonly HYCollapseKey[]) {
    this._activeKeys = Array.isArray(value) ? [...new Set(value.map(String))] : [];
    this._normalizeActiveKeys(); this._reflectActiveKeys(); this._syncExpanded();
  }
  get accordion(): boolean { return this.hasAttribute('accordion'); }
  set accordion(value: boolean) { this.toggleAttribute('accordion', Boolean(value)); }
  get bordered(): boolean { return this.getAttribute('bordered') !== 'false'; }
  set bordered(value: boolean) { this.setAttribute('bordered', String(Boolean(value))); }
  get ghost(): boolean { return this.hasAttribute('ghost'); }
  set ghost(value: boolean) { this.toggleAttribute('ghost', Boolean(value)); }
  get iconPosition(): HYCollapseIconPosition { return this.getAttribute('icon-position') === 'end' ? 'end' : 'start'; }
  set iconPosition(value: HYCollapseIconPosition) { this.setAttribute('icon-position', value === 'end' ? 'end' : 'start'); }
  get collapsible(): HYCollapseTrigger {
    const value = this.getAttribute('collapsible'); return value === 'icon' || value === 'disabled' ? value : 'header';
  }
  set collapsible(value: HYCollapseTrigger) { this.setAttribute('collapsible', value === 'icon' || value === 'disabled' ? value : 'header'); }
  get destroyOnHidden(): boolean { return this.hasAttribute('destroy-on-hidden'); }
  set destroyOnHidden(value: boolean) { this.toggleAttribute('destroy-on-hidden', Boolean(value)); }
  /** Opt-in height and arrow transitions. Initial rendering is always immediate. */
  get animated(): boolean { return this.hasAttribute('animated') && this.getAttribute('animated') !== 'false'; }
  set animated(value: boolean) { if (value) this.setAttribute('animated', ''); else this.removeAttribute('animated'); }
  /** Milliseconds; zero disables animation. Defaults to 200 (or the inherited duration token). */
  get animationDuration(): number {
    const value = Number(this.getAttribute('animation-duration') ?? 200);
    return Number.isFinite(value) ? Math.max(0, Math.min(10_000, value)) : 200;
  }
  set animationDuration(value: number) { this.setAttribute('animation-duration', String(Number.isFinite(value) ? Math.max(0, Math.min(10_000, value)) : 200)); }

  toggle(key: HYCollapseKey, expanded?: boolean): void {
    const normalized = String(key); const panel = this._panels.get(normalized); if (!panel || panel.item.disabled || this.collapsible === 'disabled') return;
    const wasExpanded = this._activeKeys.includes(normalized); const nextExpanded = expanded ?? !wasExpanded; if (wasExpanded === nextExpanded) return;
    this._activeKeys = nextExpanded ? (this.accordion ? [normalized] : [...this._activeKeys, normalized]) : this._activeKeys.filter(activeKey => activeKey !== normalized);
    this._reflectActiveKeys(); this._syncExpanded();
    this.dispatchEvent(new CustomEvent<HYCollapseChangeDetail>('collapse-change', { bubbles: true, composed: true, detail: { activeKeys: [...this._activeKeys], changedKey: normalized, expanded: nextExpanded } }));
  }

  private _readItemsAttribute(): void {
    try {
      const parsed: unknown = JSON.parse(this.getAttribute('items') ?? '[]');
      this._items = Array.isArray(parsed) ? parsed.flatMap(value => {
        if (!value || typeof value !== 'object') return []; const item = value as Record<string, unknown>; if (item.key == null || item.title == null) return [];
        return [{ key: String(item.key), title: String(item.title), ...(item.content != null ? { content: String(item.content) } : {}), ...(item.extra != null ? { extra: String(item.extra) } : {}), ...(typeof item.disabled === 'boolean' ? { disabled: item.disabled } : {}), ...(typeof item.showArrow === 'boolean' ? { showArrow: item.showArrow } : {}) }];
      }) : [];
    } catch { this._items = []; }
  }

  private _syncItems(): void {
    if (!this.isConnected) return;
    this._resizeObserver.disconnect();
    for (const panel of this._panels.values()) this._finishTransition(panel);
    this._panels.clear(); const sections: HTMLElement[] = [];
    this._items.forEach((item, index) => {
      const section = document.createElement('section'); const header = document.createElement('div'); const button = document.createElement('button'); const arrow = document.createElement('span'); const title = document.createElement('span'); const extra = document.createElement('span'); const region = document.createElement('div'); const body = document.createElement('div');
      const buttonId = `${this._uid}-button-${index}`; const regionId = `${this._uid}-panel-${index}`;
      section.className = 'panel'; section.part.add('panel'); header.className = 'header'; header.part.add('header');
      button.type = 'button'; button.className = 'trigger'; button.part.add('trigger'); button.id = buttonId; button.setAttribute('aria-controls', regionId);
      arrow.className = 'arrow'; arrow.part.add('arrow'); arrow.setAttribute('aria-hidden', 'true'); arrow.hidden = item.showArrow === false;
      title.className = 'title'; title.part.add('title'); title.textContent = item.title; button.append(arrow, title);
      extra.className = 'extra'; extra.part.add('extra'); extra.textContent = item.extra ?? ''; extra.hidden = !item.extra; header.append(button, extra);
      region.className = 'region'; region.part.add('region'); region.id = regionId; region.setAttribute('role', 'region'); region.setAttribute('aria-labelledby', buttonId);
      body.className = 'body'; body.part.add('body'); region.append(body); section.append(header, region);
      const record: PanelRecord = { item, section, button, arrow, region, body, rendered: false, expanded: null, animation: null, targetHeight: 0 }; this._panels.set(item.key, record); sections.push(section);
      this._resizeObserver.observe(body, { box: 'border-box' });
      button.addEventListener('click', event => { if (this.collapsible === 'icon' && event.detail !== 0 && !(event.composedPath()[0] as Element | null)?.closest?.('.arrow')) return; this.toggle(item.key); });
    });
    this._container.replaceChildren(...sections); this._syncExpanded();
  }

  private _syncExpanded(): void {
    if (!this.isConnected) return;
    const duration = this._duration();
    for (const [key, panel] of this._panels) {
      const expanded = this._activeKeys.includes(key); const disabled = Boolean(panel.item.disabled) || this.collapsible === 'disabled';
      panel.section.classList.toggle('expanded', expanded); panel.section.toggleAttribute('data-disabled', disabled); panel.button.disabled = disabled; panel.button.setAttribute('aria-expanded', String(expanded));
      panel.arrow.style.transitionDuration = `${duration}ms`;
      if (!expanded && panel.region.matches(':focus-within')) panel.button.focus({ preventScroll: true });
      panel.region.inert = !expanded;
      panel.region.setAttribute('aria-hidden', String(!expanded));
      if (expanded && !panel.rendered) this._renderContent(panel);
      if (panel.expanded !== expanded) {
        const from = panel.animation ? Number.parseFloat(getComputedStyle(panel.region).height) : expanded ? 0 : panel.region.offsetHeight;
        const animate = panel.expanded !== null && duration > 0;
        panel.expanded = expanded;
        if (animate) this._transition(panel, from, duration);
        else this._finishTransition(panel);
      } else if (!panel.animation || duration === 0) this._finishTransition(panel);
    }
  }

  private _duration(): number {
    if (!this.animated || this._motion.matches) return 0;
    if (this.hasAttribute('animation-duration')) return this.animationDuration;
    const token = getComputedStyle(this).getPropertyValue('--hy-collapse-animation-duration').trim();
    if (!token) return 200;
    const value = Number.parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
    return Number.isFinite(value) ? Math.max(0, Math.min(10_000, value)) : 200;
  }

  private _transition(panel: PanelRecord, from: number, duration: number): void {
    if (!Number.isFinite(from)) from = 0;
    panel.animation?.cancel(); panel.animation = null;
    panel.region.hidden = false;
    const to = panel.expanded ? panel.body.offsetHeight : 0;
    panel.targetHeight = to;
    if (!duration || from === to) { this._finishTransition(panel); return; }
    panel.region.style.overflow = 'hidden';
    const token = getComputedStyle(this).getPropertyValue('--hy-collapse-animation-easing').trim() || 'ease';
    const easing = CSS.supports('transition-timing-function', token) ? token : 'ease';
    const animation = panel.region.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration, easing, fill: 'both' });
    panel.animation = animation;
    void animation.finished.then(() => {
      if (panel.animation === animation) this._finishTransition(panel);
    }, () => { /* Reversal, replacement and disconnect cancel the previous transition. */ });
  }

  private _finishTransition(panel: PanelRecord): void {
    panel.animation?.cancel(); panel.animation = null;
    panel.region.style.removeProperty('overflow');
    panel.region.hidden = !panel.expanded;
    if (!panel.expanded && this.destroyOnHidden && panel.rendered) { panel.body.replaceChildren(); panel.rendered = false; }
  }

  private _onMotionChange = (): void => { this._syncExpanded(); };

  private _renderContent(panel: PanelRecord): void {
    const source = typeof panel.item.content === 'function' ? panel.item.content() : panel.item.content;
    if (source instanceof Node) panel.body.replaceChildren(source); else panel.body.textContent = source == null ? '' : String(source);
    panel.rendered = true;
  }

  private _normalizeActiveKeys(): void {
    if (this._items.length) { const valid = new Set(this._items.map(item => item.key)); this._activeKeys = this._activeKeys.filter(key => valid.has(key)); }
    if (this.accordion) this._activeKeys = this._activeKeys.slice(0, 1);
  }
  private _reflectActiveKeys(): void {
    const value = JSON.stringify(this._activeKeys); if (this.getAttribute('active-keys') !== value) this.setAttribute('active-keys', value);
  }
  private _syncLabel(): void {
    const label = this.getAttribute('aria-label'); if (label) this._container.setAttribute('aria-label', label); else this._container.removeAttribute('aria-label');
  }
}

export function defineCollapseComponents(): void {
  if (!customElements.get('hy-collapse')) customElements.define('hy-collapse', HYCollapse);
}
