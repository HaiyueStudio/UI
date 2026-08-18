export interface GEMenuItemLike {
  label?: string;
  value?: string;
  disabled?: boolean;
  separator?: boolean;
}

export interface GEMenuButtonOptions {
  index?: number;
  role?: string;
  tabIndex?: number;
}

export const GE_MENU_ITEM_STYLES = `
      button {
        box-sizing: border-box;
        width: 100%;
        height: 26px;
        display: flex;
        align-items: center;
        padding: 0 8px;
        border: 0;
        border-radius: 3px;
        color: var(--ge-text-color, #d8e2f2);
        background: transparent;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      button:hover,
      button:focus,
      button.active {
        background: var(--ge-menu-item-hover-bg-color, var(--ge-accent-strong-color, #255a91));
        outline: none;
      }
      button:disabled {
        color: var(--ge-muted-color, #66758b);
        cursor: default;
      }
      button:disabled:hover {
        background: transparent;
      }
      .separator {
        height: 1px;
        margin: 4px 2px;
        background: var(--ge-border-color, #303746);
      }
`;

export function createMenuSeparator(): HTMLDivElement {
  const separator = document.createElement('div');
  separator.className = 'separator';
  return separator;
}

export function createMenuItemButton(item: GEMenuItemLike, options: GEMenuButtonOptions = {}): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = item.label ?? item.value ?? '';
  button.disabled = Boolean(item.disabled);
  if (options.index !== undefined) button.dataset.index = String(options.index);
  if (options.role) button.setAttribute('role', options.role);
  if (options.tabIndex !== undefined) button.tabIndex = options.tabIndex;
  return button;
}
