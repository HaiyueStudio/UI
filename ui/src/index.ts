import { defineTreeComponents } from './tree.js';
import { defineSplitComponents } from './split.js';
import { defineSelectComponents } from './select.js';
import { defineTabsComponents } from './tabs.js';
import { defineContextMenuComponents } from './context-menu.js';
import { defineDropdownComponents } from './dropdown.js';
import { defineTooltipComponents } from './tooltip.js';
import { defineCheckboxComponents } from './checkbox.js';
import { defineRadioComponents } from './radio.js';
import { defineDialogComponents } from './dialog.js';
import { defineInputComponents } from './input.js';

export {
  defineTreeComponents,
  GETree,
  GETreeNode,
} from './tree.js';
export {
  defineSplitComponents,
  GESplit,
} from './split.js';
export {
  defineSelectComponents,
  GESelect,
} from './select.js';
export {
  defineTabsComponents,
  GETabs,
} from './tabs.js';
export {
  defineContextMenuComponents,
  GEContextMenu,
} from './context-menu.js';
export {
  defineDropdownComponents,
  GEDropdown,
} from './dropdown.js';
export {
  defineTooltipComponents,
  GETooltip,
} from './tooltip.js';
export {
  defineCheckboxComponents,
  GECheckbox,
} from './checkbox.js';
export {
  defineRadioComponents,
  GERadio,
} from './radio.js';
export {
  defineDialogComponents,
  GEDialog,
} from './dialog.js';
export {
  defineInputComponents,
  GEInput,
} from './input.js';
export type {
  GESplitDirection,
  GESplitRatioChangeDetail,
} from './split.js';
export type {
  GESelectChangeDetail,
  GESelectOption,
} from './select.js';
export type {
  GETabChangeDetail,
  GETabOption,
} from './tabs.js';
export type {
  GEContextMenuItem,
  GEContextMenuSelectDetail,
} from './context-menu.js';
export type {
  GEDropdownItem,
  GEDropdownPlacement,
  GEDropdownSelectDetail,
} from './dropdown.js';
export type {
  GETooltipPlacement,
} from './tooltip.js';
export type {
  GECheckboxChangeDetail,
} from './checkbox.js';
export type {
  GERadioChangeDetail,
} from './radio.js';
export type {
  GEDialogCloseDetail,
  GEDialogCloseReason,
} from './dialog.js';
export type {
  GEInputChangeDetail,
  GEInputType,
} from './input.js';
export type {
  GETreeDataChangeDetail,
  GETreeDropPosition,
  GETreeNodeContextMenuDetail,
  GETreeNodeData,
  GETreeSelectionChangeDetail,
} from './tree.js';

export class GEButton extends HTMLElement {
  private readonly _button = document.createElement('button');
  private readonly _slot = document.createElement('slot');

  static get observedAttributes(): string[] {
    return ['label', 'disabled', 'aria-label', 'title', 'icon-only'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; }
      button {
        min-height: 28px;
        padding: 0 10px;
        border: 1px solid #3d4654;
        border-radius: 4px;
        background: #202733;
        color: #eef3ff;
        font: 12px system-ui, sans-serif;
        cursor: pointer;
      }
      button.icon-only {
        width: 28px;
        padding: 0;
        display: inline-grid;
        place-items: center;
      }
      ::slotted(svg) {
        width: 16px;
        height: 16px;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `;
    root.append(style, this._button);
  }

  connectedCallback(): void {
    this._sync();
  }

  attributeChangedCallback(): void {
    this._sync();
  }

  private _sync(): void {
    const label = this.getAttribute('label');
    if (label !== null) {
      this._button.textContent = label;
      this._button.classList.remove('icon-only');
      this._button.removeAttribute('aria-label');
    } else {
      if (this._button.firstChild !== this._slot) this._button.replaceChildren(this._slot);
      this._button.classList.toggle('icon-only', this.hasAttribute('icon-only'));
      const accessibleLabel = this.getAttribute('aria-label') ?? this.getAttribute('title') ?? '';
      if (accessibleLabel) this._button.setAttribute('aria-label', accessibleLabel);
      else this._button.removeAttribute('aria-label');
    }
    this._button.disabled = this.hasAttribute('disabled');
  }
}

export function defineHaiyueUI(): void {
  if (!customElements.get('ge-button')) {
    customElements.define('ge-button', GEButton);
  }
  defineTreeComponents();
  defineSplitComponents();
  defineSelectComponents();
  defineTabsComponents();
  defineContextMenuComponents();
  defineDropdownComponents();
  defineTooltipComponents();
  defineCheckboxComponents();
  defineRadioComponents();
  defineDialogComponents();
  defineInputComponents();
}
