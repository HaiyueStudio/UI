import { HYAnchoredPopup } from './internal/anchored-popup.js';
export type HYMenuMode = 'inline' | 'vertical' | 'horizontal';
export interface HYMenuItem { key: string; label?: string; icon?: string; href?: string; disabled?: boolean; type?: 'item' | 'group' | 'divider'; children?: HYMenuItem[]; }
export interface HYMenuSelectDetail { key: string; item: HYMenuItem; selectedKeys: string[]; }
export interface HYMenuOpenChangeDetail { openKeys: string[]; }
let menuId = 0;
interface MenuEntry { item: HYMenuItem; parent: string | null; disabled: boolean; button: HTMLElement; list: HTMLUListElement; }

export class HYMenu extends HTMLElement {
  private readonly _menu = document.createElement('ul');
  private readonly _id = `hy-menu-${++menuId}`;
  private _items: HYMenuItem[] = [];
  private _entries = new Map<string, MenuEntry>();
  private _popups: HYAnchoredPopup[] = [];
  private _pendingPopups: HYAnchoredPopup[] = [];
  private _listeners: AbortController | null = null;
  private _active = '';
  private _typeahead = '';
  private _typeTimer: ReturnType<typeof setTimeout> | null = null;
  static get observedAttributes(): string[] { return ['items', 'mode', 'collapsed', 'disabled', 'multiple', 'selected-keys', 'open-keys', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; width: var(--hy-menu-width, 220px); max-width: 100%; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      :host([mode="horizontal"]) { width: auto; } :host([collapsed]) { width: var(--hy-menu-collapsed-width, 48px); }
      ul { list-style: none; margin: 0; padding: var(--hy-space-2, 4px); box-sizing: border-box; background: var(--hy-menu-bg-color, var(--hy-surface-color, #121822)); }
      .root { border: 1px solid var(--hy-border-color, #303746); border-radius: var(--hy-radius-sm, 4px); }
      .root.horizontal { display: flex; flex-wrap: wrap; } li { margin: 0; padding: 0; }
      .item { display: flex; align-items: center; gap: var(--hy-space-4, 8px); box-sizing: border-box; width: 100%; min-height: var(--hy-control-height-sm, 28px); padding: var(--hy-space-3, 6px) var(--hy-space-4, 8px); border: 0; border-radius: var(--hy-radius-sm, 4px); color: inherit; background: transparent; text-align: start; text-decoration: none; font: inherit; cursor: pointer; }
      .item:hover:not([aria-disabled="true"]) { background: var(--hy-hover-bg-color, #273241); } .item.selected { color: var(--hy-selected-text-color, #fff); background: var(--hy-selected-bg-color, #255a91); }
      .item:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: -2px; } .item[aria-disabled="true"] { color: var(--hy-disabled-text-color, #65738a); cursor: not-allowed; }
      .label { flex: 1; min-width: 0; overflow-wrap: anywhere; } .icon { min-width: 16px; text-align: center; } .arrow { margin-inline-start: auto; }
      .group { padding: var(--hy-space-3, 6px) var(--hy-space-4, 8px); color: var(--hy-muted-text-color, #8290a3); } .divider { margin: var(--hy-space-2, 4px) 0; border-top: 1px solid var(--hy-border-color, #303746); }
      .submenu.inline { padding-inline-start: var(--hy-space-6, 12px); } .submenu.popup { position: fixed; inset: auto; margin: 0; min-width: var(--hy-menu-popup-width, 180px); max-width: calc(100vw - 16px); max-height: min(360px, calc(100dvh - 16px)); overflow: auto; border: 1px solid var(--hy-border-color, #303746); border-radius: var(--hy-radius-sm, 4px); color: var(--hy-text-color, #d8e2f2); font: inherit; box-shadow: var(--hy-popup-shadow, 0 8px 24px rgba(0,0,0,.24)); }
      .horizontal > li > .item { width: auto; } :host([collapsed]) .root > li > .item .label, :host([collapsed]) .root > li > .item .arrow { display: none; }
      [hidden] { display: none !important; }
    `;
    this._menu.className = 'root'; this._menu.part.add('menu'); root.append(style, this._menu);
  }
  connectedCallback(): void {
    this._listeners?.abort(); this._listeners = new AbortController(); const { signal } = this._listeners;
    this._menu.addEventListener('click', this._onClick, { signal }); this._menu.addEventListener('keydown', this._onKeydown, { signal });
    this._menu.addEventListener('focusin', event => { const button = this._button(event); if (button) { this._active = button.dataset.key!; this._syncTabStops(); } }, { signal });
    this.ownerDocument.addEventListener('pointerdown', event => { if (!this._inline && !event.composedPath().includes(this) && this.openKeys.length) this._setOpenKeys([], true); }, { capture: true, signal });
    this._render();
  }
  disconnectedCallback(): void { this._listeners?.abort(); this._listeners = null; this._disposePopups(); if (this._typeTimer !== null) clearTimeout(this._typeTimer); this._typeTimer = null; this._typeahead = ''; }
  attributeChangedCallback(name: string, previous: string | null, next: string | null): void { if (previous === next) return; if (name === 'items') { let items: unknown = []; try { items = JSON.parse(next ?? '[]'); } catch { /* Empty invalid input. */ } this._items = normalizeMenu(items); } this._render(); }
  get items(): HYMenuItem[] { return this._items.map(cloneMenuItem); }
  set items(value: HYMenuItem[]) { this._items = normalizeMenu(value); this._render(); }
  get mode(): HYMenuMode { const value = this.getAttribute('mode'); return value === 'vertical' || value === 'horizontal' ? value : 'inline'; }
  set mode(value: HYMenuMode) { this.setAttribute('mode', value); }
  get collapsed(): boolean { return this.hasAttribute('collapsed'); }
  set collapsed(value: boolean) { this.toggleAttribute('collapsed', value); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', value); }
  get multiple(): boolean { return this.hasAttribute('multiple'); }
  set multiple(value: boolean) { this.toggleAttribute('multiple', value); }
  get selectedKeys(): string[] { const keys = readKeys(this.getAttribute('selected-keys')); return this.multiple ? keys : keys.slice(0, 1); }
  set selectedKeys(value: string[]) { this.setAttribute('selected-keys', JSON.stringify(value)); }
  get openKeys(): string[] { return readKeys(this.getAttribute('open-keys')); }
  set openKeys(value: string[]) { this._setOpenKeys(value, false); }
  override focus(options?: FocusOptions): void { (this._entries.get(this._active)?.button ?? this._allVisible()[0]?.button)?.focus(options); }
  private get _inline(): boolean { return this.mode === 'inline' && !this.collapsed; }
  private _disposePopups(): void { for (const popup of this._popups) popup.dispose(); this._popups = []; }
  private _render(): void {
    const focused = this.shadowRoot?.activeElement instanceof HTMLElement ? this.shadowRoot.activeElement.dataset.key : undefined;
    this._disposePopups(); this._pendingPopups = []; this._entries.clear(); this._menu.className = `root ${this.mode}`;
    this._menu.setAttribute('role', this.mode === 'horizontal' ? 'menubar' : 'menu'); this._menu.setAttribute('aria-label', this.getAttribute('aria-label') || 'Menu'); this._menu.setAttribute('aria-orientation', this.mode === 'horizontal' ? 'horizontal' : 'vertical');
    this._menu.replaceChildren(...this._build(this._items, this._menu, null, this.disabled));
    for (const popup of this._pendingPopups.reverse()) { popup.connect(); popup.show(); }
    const visible = this._allVisible(); if (!visible.some(entry => entry.item.key === this._active)) this._active = visible.find(entry => this.selectedKeys.includes(entry.item.key))?.item.key ?? visible[0]?.item.key ?? '';
    this._syncTabStops(); if (focused) (visible.find(entry => entry.item.key === focused) ?? this._entries.get(this._active))?.button.focus({ preventScroll: true });
  }
  private _build(items: HYMenuItem[], list: HTMLUListElement, parent: string | null, disabled: boolean): HTMLLIElement[] {
    return items.map(item => {
      const li = document.createElement('li'); li.setAttribute('role', 'none');
      if (item.type === 'divider') { li.className = 'divider'; li.setAttribute('role', 'separator'); return li; }
      if (item.type === 'group') { const title = document.createElement('div'); title.className = 'group'; title.textContent = item.label ?? item.key; const children = document.createElement('ul'); children.setAttribute('role', 'group'); children.setAttribute('aria-label', item.label ?? item.key); children.append(...this._build(item.children ?? [], children, parent, disabled || Boolean(item.disabled))); li.append(title, children); return li; }
      const isDisabled = disabled || Boolean(item.disabled); const hasChildren = Boolean(item.children?.length); const href = !hasChildren ? safeHref(item.href, this.ownerDocument.baseURI) : null;
      const button = href ? document.createElement('a') : document.createElement('button'); if (button instanceof HTMLAnchorElement) button.href = href!; else { button.type = 'button'; button.disabled = isDisabled; }
      button.className = 'item'; button.part.add('item'); button.dataset.key = item.key; button.id = `${this._id}-${this._entries.size}`; button.setAttribute('role', this.multiple && !hasChildren ? 'menuitemcheckbox' : 'menuitem'); button.setAttribute('aria-disabled', String(isDisabled)); button.setAttribute('aria-label', item.label ?? item.key); button.tabIndex = -1;
      const selected = this.selectedKeys.includes(item.key); button.classList.toggle('selected', selected); if (this.multiple && !hasChildren) button.setAttribute('aria-checked', String(selected)); else if (selected) button.setAttribute('aria-current', 'page');
      const icon = document.createElement('span'); icon.className = 'icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = item.icon ?? (this.collapsed && parent === null ? (item.label ?? item.key).slice(0, 1) : ''); icon.hidden = !icon.textContent;
      const label = document.createElement('span'); label.className = 'label'; label.textContent = item.label ?? item.key; button.append(icon, label); li.append(button);
      this._entries.set(item.key, { item, parent, disabled: isDisabled, button, list });
      if (hasChildren) {
        const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = this._inline ? '⌄' : '›'; arrow.setAttribute('aria-hidden', 'true'); button.append(arrow);
        const children = document.createElement('ul'); children.className = `submenu ${this._inline ? 'inline' : 'popup'}`; children.part.add('submenu'); children.id = `${button.id}-children`; children.setAttribute('role', 'menu'); children.setAttribute('aria-label', item.label ?? item.key); button.setAttribute('aria-controls', children.id); button.setAttribute('aria-haspopup', 'menu');
        const open = this.openKeys.includes(item.key) && !isDisabled && this._ancestorsOpen(parent); button.setAttribute('aria-expanded', String(open));
        children.append(...this._build(item.children!, children, item.key, isDisabled)); li.append(children);
        if (this._inline) children.hidden = !open;
        else { const popup = new HYAnchoredPopup(this, button, children, () => this._setOpenKeys([], true), this.mode === 'horizontal' && parent === null ? 'bottom' : 'right'); this._popups.push(popup); if (open && this.isConnected) this._pendingPopups.push(popup); }
      }
      return li;
    });
  }
  private _ancestorsOpen(key: string | null): boolean { while (key) { if (!this.openKeys.includes(key)) return false; key = this._entries.get(key)?.parent ?? null; } return true; }
  private _allVisible(): MenuEntry[] { return [...this._entries.values()].filter(entry => !entry.disabled && this._ancestorsOpen(entry.parent)); }
  private _syncTabStops(): void { for (const entry of this._entries.values()) entry.button.tabIndex = !entry.disabled && entry.item.key === this._active && this._ancestorsOpen(entry.parent) ? 0 : -1; }
  private _setOpenKeys(keys: string[], user: boolean): void { const next = [...new Set(keys.filter(key => typeof key === 'string'))]; if (JSON.stringify(next) === JSON.stringify(this.openKeys)) return; this.setAttribute('open-keys', JSON.stringify(next)); if (user) this.dispatchEvent(new CustomEvent<HYMenuOpenChangeDetail>('open-change', { detail: { openKeys: this.openKeys }, bubbles: true, composed: true })); }
  private _toggle(key: string, force?: boolean): void {
    const entry = this._entries.get(key); if (!entry || entry.disabled || !entry.item.children?.length) return;
    const open = force ?? !this.openKeys.includes(key); let keys = this.openKeys;
    if (open) { if (!this._inline) keys = keys.filter(value => this._entries.get(value)?.parent !== entry.parent); keys.push(key); }
    else keys = keys.filter(value => { let current: string | null = value; while (current) { if (current === key) return false; current = this._entries.get(current)?.parent ?? null; } return true; });
    this._setOpenKeys(keys, true);
  }
  private _button(event: Event): HTMLElement | null { return event.target instanceof Element ? event.target.closest<HTMLElement>('.item[data-key]') : null; }
  private _onClick = (event: MouseEvent): void => {
    const button = this._button(event); if (!button) return; const entry = this._entries.get(button.dataset.key!); if (!entry) return;
    if (entry.disabled) { event.preventDefault(); return; } this._active = entry.item.key;
    if (entry.item.children?.length) { event.preventDefault(); this._toggle(entry.item.key); return; }
    const selected = this.multiple ? this.selectedKeys.includes(entry.item.key) ? this.selectedKeys.filter(key => key !== entry.item.key) : [...this.selectedKeys, entry.item.key] : [entry.item.key];
    if (!this.dispatchEvent(new CustomEvent<HYMenuSelectDetail>('menu-select', { detail: { key: entry.item.key, item: cloneMenuItem(entry.item), selectedKeys: selected }, bubbles: true, composed: true, cancelable: true }))) { event.preventDefault(); return; }
    let root = entry; while (root.parent) root = this._entries.get(root.parent) ?? root;
    const returnKey = root.item.key;
    this.selectedKeys = selected; if (!this._inline) { this._setOpenKeys([], true); this._entries.get(returnKey)?.button.focus({ preventScroll: true }); }
  };
  private _onKeydown = (event: KeyboardEvent): void => {
    const button = this._button(event); const entry = button ? this._entries.get(button.dataset.key!) : undefined; if (!entry || entry.disabled || event.isComposing) return;
    if (event.key === ' ' && button instanceof HTMLAnchorElement) { event.preventDefault(); button.click(); return; }
    const rootHorizontal = this.mode === 'horizontal' && entry.parent === null; const forward = getComputedStyle(this).direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'; const backward = forward === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft'; const siblings = this._allVisible().filter(item => item.list === entry.list); const index = siblings.indexOf(entry); let target: MenuEntry | undefined;
    if (event.key === 'Home') target = siblings[0]; else if (event.key === 'End') target = siblings.at(-1);
    else if (event.key === (rootHorizontal ? forward : 'ArrowDown')) target = siblings[(index + 1) % siblings.length];
    else if (event.key === (rootHorizontal ? backward : 'ArrowUp')) target = siblings[(index - 1 + siblings.length) % siblings.length];
    else if (event.key === (rootHorizontal ? 'ArrowDown' : 'ArrowRight') && entry.item.children?.length) { event.preventDefault(); this._toggle(entry.item.key, true); target = this._allVisible().find(item => item.parent === entry.item.key); }
    else if ((event.key === 'ArrowLeft' || event.key === 'Escape') && entry.parent) { event.preventDefault(); event.stopPropagation(); const parent = entry.parent; this._toggle(parent, false); target = this._entries.get(parent); }
    else if (event.key === 'Escape' && this.openKeys.length) { event.preventDefault(); event.stopPropagation(); this._setOpenKeys([], true); target = this._entries.get(entry.item.key); }
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
      this._typeahead += event.key.toLocaleLowerCase(); if (this._typeTimer !== null) clearTimeout(this._typeTimer); this._typeTimer = setTimeout(() => { this._typeahead = ''; this._typeTimer = null; }, 500);
      target = [...siblings.slice(index + 1), ...siblings.slice(0, index + 1)].find(item => (item.item.label ?? item.item.key).toLocaleLowerCase().startsWith(this._typeahead));
    }
    if (target) { event.preventDefault(); this._active = target.item.key; this._syncTabStops(); target.button.focus(); }
  };
}
function readKeys(raw: string | null): string[] { try { const value: unknown = JSON.parse(raw ?? '[]'); return Array.isArray(value) ? [...new Set(value.filter((key): key is string => typeof key === 'string'))] : []; } catch { return []; } }
function cloneMenuItem(item: HYMenuItem): HYMenuItem { return { ...item, ...(item.children ? { children: item.children.map(cloneMenuItem) } : {}) }; }
function normalizeMenu(value: unknown): HYMenuItem[] {
  const keys = new Set<string>(); const visiting = new Set<unknown>();
  const visit = (items: unknown, depth: number): HYMenuItem[] => !Array.isArray(items) || depth > 64 ? [] : items.flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.key !== 'string' || !item.key || keys.has(item.key) || visiting.has(item)) return [];
    keys.add(item.key); visiting.add(item); const children = visit(item.children, depth + 1); visiting.delete(item);
    return [{ key: item.key, ...(typeof item.label === 'string' ? { label: item.label } : {}), ...(typeof item.icon === 'string' ? { icon: item.icon } : {}), ...(typeof item.href === 'string' ? { href: item.href } : {}), ...(item.disabled ? { disabled: true } : {}), ...(item.type === 'group' || item.type === 'divider' ? { type: item.type } : {}), ...(children.length ? { children } : {}) } as HYMenuItem];
  }); return visit(value, 0);
}
function safeHref(value: string | undefined, base: string): string | null { if (!value) return null; try { const url = new URL(value, base); return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? value : null; } catch { return null; } }
export function defineMenuComponents(): void { if (!customElements.get('hy-menu')) customElements.define('hy-menu', HYMenu); }
