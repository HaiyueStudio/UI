import type { GETreeNodeData } from './tree-types.js';

export class GETreeNode extends HTMLElement {
  private readonly _icon = document.createElement('span');
  private readonly _label = document.createElement('span');

  static get observedAttributes(): string[] {
    return ['label', 'icon', 'selected'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 6px;
        color: inherit;
        font: inherit;
      }
      .icon {
        width: 16px;
        flex: 0 0 16px;
        display: inline-grid;
        place-items: center;
        color: var(--ge-tree-icon-color, var(--ge-secondary-text-color, #8fa7c8));
        font-size: 12px;
      }
      .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      :host([selected]) .label {
        color: var(--ge-selected-text-color, #ffffff);
      }
    `;
    this._icon.className = 'icon';
    this._label.className = 'label';
    root.append(style, this._icon, this._label);
  }

  connectedCallback(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'treeitem');
    this._sync();
  }

  attributeChangedCallback(): void {
    this._sync();
  }

  set node(value: GETreeNodeData) {
    this.setAttribute('label', String(value.label ?? value.id));
    if (value.icon) this.setAttribute('icon', String(value.icon));
    else this.removeAttribute('icon');
  }

  private _sync(): void {
    this._icon.textContent = this.getAttribute('icon') ?? '';
    this._label.textContent = this.getAttribute('label') ?? '';
    this.setAttribute('aria-selected', this.hasAttribute('selected') ? 'true' : 'false');
  }
}
