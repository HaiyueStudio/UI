import { GE_MENU_ITEM_STYLES, createMenuItemButton, createMenuSeparator } from './menu-shared.js';

export interface HYContextMenuItem {
  label?: string;
  value?: string;
  disabled?: boolean;
  separator?: boolean;
}

export interface HYContextMenuSelectDetail {
  value: string;
  item: HYContextMenuItem;
}

export class HYContextMenu extends HTMLElement {
  private readonly _root: ShadowRoot;
  private readonly _style = document.createElement('style');
  private readonly _menu = document.createElement('div');
  private _items: HYContextMenuItem[] = [];
  private _documentListenerAbort: AbortController | null = null;
  private _activeIndex = -1;

  static get observedAttributes(): string[] {
    return ['items', 'open'];
  }

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    this._style.textContent = `
      :host {
        position: fixed;
        z-index: 10000;
        display: none;
        min-width: 132px;
        color: var(--hy-text-color, #d8e2f2);
        font: 12px system-ui, sans-serif;
      }
      :host([open]) {
        display: block;
      }
      .menu {
        box-sizing: border-box;
        min-width: 132px;
        padding: 4px;
        border: 1px solid var(--hy-border-color, #303746);
        border-radius: 4px;
        background: var(--hy-menu-bg-color, var(--hy-surface-elevated-color, #1b2230));
        box-shadow: 0 10px 26px var(--hy-menu-shadow-color, rgba(0, 0, 0, 0.36));
      }
${GE_MENU_ITEM_STYLES}
    `;
    this._menu.className = 'menu';
    this._menu.setAttribute('role', 'menu');
    this._root.append(this._style, this._menu);
  }

  connectedCallback(): void {
    this._readItemsAttribute();
    this._render();
    this._syncDocumentListeners();
  }

  disconnectedCallback(): void {
    this._detachDocumentListeners();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'items') {
      this._readItemsAttribute();
      this._render();
    }
    if (name === 'open') this._syncDocumentListeners();
  }

  get items(): HYContextMenuItem[] {
    return this._items;
  }

  set items(value: HYContextMenuItem[]) {
    this._items = Array.isArray(value) ? value : [];
    this._render();
  }

  openAt(x: number, y: number): void {
    this.setAttribute('open', '');
    this.style.left = '0px';
    this.style.top = '0px';
    const rect = this._menu.getBoundingClientRect();
    const viewport = getVisualViewportRect();
    const left = Math.min(x, viewport.left + viewport.width - rect.width - 4);
    const top = Math.min(y, viewport.top + viewport.height - rect.height - 4);
    this.style.left = `${Math.max(viewport.left + 4, left)}px`;
    this.style.top = `${Math.max(viewport.top + 4, top)}px`;
    this._setActiveIndex(this._firstEnabledIndex(), false);
  }

  close(): void {
    this.removeAttribute('open');
    this._setActiveIndex(-1, false);
  }

  private _syncDocumentListeners(): void {
    if (this.hasAttribute('open') && this.isConnected) this._attachDocumentListeners();
    else this._detachDocumentListeners();
  }

  private _attachDocumentListeners(): void {
    if (this._documentListenerAbort) return;
    this._documentListenerAbort = new AbortController();
    const { signal } = this._documentListenerAbort;
    document.addEventListener('pointerdown', this._onDocumentPointerDown, { capture: true, signal });
    document.addEventListener('keydown', this._onDocumentKeyDown, { capture: true, signal });
  }

  private _detachDocumentListeners(): void {
    this._documentListenerAbort?.abort();
    this._documentListenerAbort = null;
  }

  private _readItemsAttribute(): void {
    const raw = this.getAttribute('items');
    if (!raw) {
      this._items = [];
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      this._items = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Invalid hy-context-menu items attribute.', error);
    }
  }

  private _render(): void {
    this._menu.replaceChildren();
    this._activeIndex = -1;
    for (const [index, item] of this._items.entries()) {
      if (item.separator) {
        this._menu.append(createMenuSeparator());
        continue;
      }
      const button = createMenuItemButton(item, { index, role: 'menuitem', tabIndex: -1 });
      button.addEventListener('click', () => {
        this._selectIndex(index);
      });
      this._menu.append(button);
    }
  }

  private _onDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.hasAttribute('open')) return;
    const path = event.composedPath();
    if (!path.includes(this)) this.close();
  };

  private _onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.hasAttribute('open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this._setActiveIndex(this._nextEnabledIndex(1), true);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this._setActiveIndex(this._nextEnabledIndex(-1), true);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      this._setActiveIndex(this._firstEnabledIndex(), true);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      this._setActiveIndex(this._lastEnabledIndex(), true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._selectIndex(this._activeIndex);
    }
  };

  private _selectIndex(index: number): void {
    const item = this._items[index];
    if (!item || item.disabled || item.separator || !item.value) return;
    this.dispatchEvent(new CustomEvent<HYContextMenuSelectDetail>('item-select', {
      detail: { value: item.value, item },
      bubbles: true,
      composed: true,
    }));
    this.close();
  }

  private _setActiveIndex(index: number, focus: boolean): void {
    this._activeIndex = index;
    for (const button of this._menu.querySelectorAll<HTMLButtonElement>('button')) {
      const active = Number(button.dataset.index) === index;
      button.classList.toggle('active', active);
      if (active && focus) button.focus();
    }
  }

  private _nextEnabledIndex(direction: 1 | -1): number {
    if (!this._items.length) return -1;
    const start = this._activeIndex >= 0 ? this._activeIndex : direction > 0 ? -1 : this._items.length;
    for (let step = 1; step <= this._items.length; step++) {
      const index = (start + direction * step + this._items.length) % this._items.length;
      if (this._isEnabledItem(index)) return index;
    }
    return -1;
  }

  private _firstEnabledIndex(): number {
    return this._items.findIndex((_, index) => this._isEnabledItem(index));
  }

  private _lastEnabledIndex(): number {
    for (let index = this._items.length - 1; index >= 0; index--) {
      if (this._isEnabledItem(index)) return index;
    }
    return -1;
  }

  private _isEnabledItem(index: number): boolean {
    const item = this._items[index];
    return Boolean(item && !item.separator && !item.disabled && item.value);
  }
}

function getVisualViewportRect(): { left: number; top: number; width: number; height: number } {
  const viewport = window.visualViewport;
  return viewport
    ? { left: viewport.offsetLeft, top: viewport.offsetTop, width: viewport.width, height: viewport.height }
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

export function defineContextMenuComponents(): void {
  if (!customElements.get('hy-context-menu')) {
    customElements.define('hy-context-menu', HYContextMenu);
  }
}
