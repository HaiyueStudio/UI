import { GE_MENU_ITEM_STYLES, createMenuItemButton, createMenuSeparator } from './menu-shared.js';

export interface HYDropdownItem {
  label?: string;
  value?: string;
  disabled?: boolean;
  separator?: boolean;
}

export interface HYDropdownSelectDetail {
  value: string;
  item: HYDropdownItem;
}

export type HYDropdownPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export class HYDropdown extends HTMLElement {
  private readonly _root: ShadowRoot;
  private readonly _style = document.createElement('style');
  private readonly _triggerSlot = document.createElement('slot');
  private readonly _menu = document.createElement('div');
  private _items: HYDropdownItem[] = [];
  private _documentListenerAbort: AbortController | null = null;

  static get observedAttributes(): string[] {
    return ['items', 'open', 'disabled', 'placement'];
  }

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    this._style.textContent = `
      :host {
        display: inline-block;
        width: max-content;
        min-width: 0;
        color: var(--hy-text-color, #d8e2f2);
        font: 12px system-ui, sans-serif;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.55;
      }
      .menu {
        position: fixed;
        z-index: 10000;
        box-sizing: border-box;
        min-width: 148px;
        max-height: min(320px, calc(100vh - 12px));
        overflow: auto;
        display: none;
        padding: 4px;
        border: 1px solid var(--hy-border-color, #303746);
        border-radius: 4px;
        color: var(--hy-text-color, #d8e2f2);
        background: var(--hy-menu-bg-color, var(--hy-surface-elevated-color, #1b2230));
        box-shadow: 0 10px 26px var(--hy-menu-shadow-color, rgba(0, 0, 0, 0.36));
      }
      :host([open]) .menu {
        display: block;
      }
${GE_MENU_ITEM_STYLES}
    `;
    this._triggerSlot.name = 'trigger';
    this._menu.className = 'menu';
    this._root.append(this._style, this._triggerSlot, this._menu);
  }

  connectedCallback(): void {
    this._readItemsAttribute();
    this._render();
    this.addEventListener('click', this._onHostClick);
    this._syncDocumentListeners();
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onHostClick);
    this._detachDocumentListeners();
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'items') {
      this._readItemsAttribute();
      this._render();
    }
    if (name === 'open') {
      this._syncDocumentListeners();
      if (newValue !== null) this._syncPosition();
    }
    if (name === 'placement' && this.open) this._syncPosition();
  }

  get items(): HYDropdownItem[] {
    return this._items;
  }

  set items(value: HYDropdownItem[]) {
    this._items = Array.isArray(value) ? value : [];
    this._render();
  }

  get open(): boolean {
    return this.hasAttribute('open');
  }

  set open(value: boolean) {
    if (value) this.setAttribute('open', '');
    else this.removeAttribute('open');
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }

  set disabled(value: boolean) {
    if (value) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get placement(): HYDropdownPlacement {
    return (this.getAttribute('placement') as HYDropdownPlacement | null) ?? 'bottom-start';
  }

  set placement(value: HYDropdownPlacement) {
    this.setAttribute('placement', value);
  }

  show(): void {
    if (this.disabled) return;
    this.open = true;
    this._syncPosition();
  }

  close(): void {
    this.open = false;
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  private _readItemsAttribute(): void {
    const raw = this.getAttribute('items');
    if (!raw) {
      this._items = [];
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      this._items = Array.isArray(parsed)
        ? parsed.map(item => ({
            ...(item.separator ? {} : {
              label: String(item.label ?? item.value ?? ''),
              value: String(item.value ?? item.label ?? ''),
            }),
            disabled: Boolean(item.disabled),
            separator: Boolean(item.separator),
          }))
        : [];
    } catch (error) {
      console.warn('Invalid hy-dropdown items attribute.', error);
    }
  }

  private _render(): void {
    this._menu.replaceChildren();
    for (const item of this._items) {
      if (item.separator) {
        this._menu.append(createMenuSeparator());
        continue;
      }
      const button = createMenuItemButton(item);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!item.value || item.disabled) return;
        this.dispatchEvent(new CustomEvent<HYDropdownSelectDetail>('item-select', {
          detail: { value: item.value, item },
          bubbles: true,
          composed: true,
        }));
        this.close();
      });
      this._menu.append(button);
    }
    if (this.open) this._syncPosition();
  }

  private _syncPosition(): void {
    if (!this.open) return;
    const hostRect = this.getBoundingClientRect();
    this._menu.style.left = '0px';
    this._menu.style.top = '0px';
    this._menu.style.minWidth = `${Math.max(148, hostRect.width)}px`;
    const menuRect = this._menu.getBoundingClientRect();
    const placement = this.placement;
    const left = placement.endsWith('end') ? hostRect.right - menuRect.width : hostRect.left;
    const top = placement.startsWith('top') ? hostRect.top - menuRect.height - 4 : hostRect.bottom + 4;
    const viewport = getVisualViewportRect();
    this._menu.style.left = `${Math.max(viewport.left + 4, Math.min(left, viewport.left + viewport.width - menuRect.width - 4))}px`;
    this._menu.style.top = `${Math.max(viewport.top + 4, Math.min(top, viewport.top + viewport.height - menuRect.height - 4))}px`;
  }

  private _syncDocumentListeners(): void {
    if (this.open && this.isConnected) this._attachDocumentListeners();
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

  private _onHostClick = (event: MouseEvent): void => {
    if (event.composedPath().includes(this._menu)) return;
    this.toggle();
  };

  private _onDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.open) return;
    const path = event.composedPath();
    if (!path.includes(this)) this.close();
  };

  private _onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
  };
}

function getVisualViewportRect(): { left: number; top: number; width: number; height: number } {
  const viewport = window.visualViewport;
  return viewport
    ? { left: viewport.offsetLeft, top: viewport.offsetTop, width: viewport.width, height: viewport.height }
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

export function defineDropdownComponents(): void {
  if (!customElements.get('hy-dropdown')) {
    customElements.define('hy-dropdown', HYDropdown);
  }
}
