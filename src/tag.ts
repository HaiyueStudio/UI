export type HYTagVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';
export type HYTagSize = 'small' | 'medium' | 'large';

export interface HYTagCloseDetail {
  readonly value: string;
}

export interface HYTagCheckedChangeDetail {
  readonly checked: boolean;
  readonly value: string;
}

const VARIANTS: readonly HYTagVariant[] = ['default', 'primary', 'success', 'warning', 'error'];
const SIZES: readonly HYTagSize[] = ['small', 'medium', 'large'];

function isVariant(value: unknown): value is HYTagVariant {
  return typeof value === 'string' && VARIANTS.includes(value as HYTagVariant);
}

function isSize(value: unknown): value is HYTagSize {
  return typeof value === 'string' && SIZES.includes(value as HYTagSize);
}

/** Compact semantic label with optional close and checked interactions. */
export class HYTag extends HTMLElement {
  private readonly _tag = document.createElement('span');
  private readonly _icon = document.createElement('span');
  private readonly _iconSlot = document.createElement('slot');
  private readonly _iconText = document.createElement('span');
  private readonly _labelSlot = document.createElement('slot');
  private readonly _labelText = document.createElement('span');
  private readonly _label = document.createElement('span');
  private readonly _close = document.createElement('button');

  static get observedAttributes(): string[] {
    return ['variant', 'color', 'size', 'label', 'icon', 'closable', 'checkable', 'checked', 'disabled', 'value'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-flex; max-width: 100%; vertical-align: middle; }
      :host([hidden]) { display: none !important; }
      .tag {
        --_tone: var(--hy-secondary-text-color, #9aa8ba);
        --_surface: color-mix(in srgb, var(--_tone) 12%, var(--hy-surface-color, #121822));
        display: inline-flex;
        max-width: 100%;
        min-height: var(--hy-tag-height, 24px);
        box-sizing: border-box;
        align-items: center;
        gap: var(--hy-tag-gap, 5px);
        padding: 2px var(--hy-tag-padding-inline, 8px);
        border: 1px solid color-mix(in srgb, var(--_tone) 42%, var(--hy-border-color, #303746));
        border-radius: var(--hy-tag-radius, 5px);
        color: var(--_tone);
        background: var(--_surface);
        font: 600 var(--hy-tag-font-size, 11px)/1.35 system-ui, sans-serif;
        transition: border-color 120ms ease, box-shadow 120ms ease, color 120ms ease, background 120ms ease;
      }
      .tag[data-variant="primary"] { --_tone: var(--hy-accent-color, #79a8ff); }
      .tag[data-variant="success"] { --_tone: var(--hy-success-color, #55c98a); }
      .tag[data-variant="warning"] { --_tone: var(--hy-warning-color, #e7b75a); }
      .tag[data-variant="error"] { --_tone: var(--hy-error-color, #ef6b78); }
      :host([checkable]) .tag { cursor: pointer; user-select: none; }
      :host([checkable][checked]) .tag {
        color: var(--hy-selected-text-color, #fff);
        background: var(--_tone);
        border-color: var(--_tone);
      }
      :host(:focus-visible) { outline: none; }
      :host(:focus-visible) .tag { box-shadow: 0 0 0 2px var(--hy-focus-ring-color, rgba(61, 111, 168, .24)); }
      :host([disabled]) { pointer-events: none; opacity: .5; }
      :host([size="small"]) .tag { --hy-tag-height: 20px; --hy-tag-padding-inline: 6px; --hy-tag-font-size: 10px; }
      :host([size="large"]) .tag { --hy-tag-height: 30px; --hy-tag-padding-inline: 11px; --hy-tag-font-size: 12px; }
      .icon { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; }
      .icon[hidden] { display: none; }
      .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .close {
        display: none;
        width: 16px;
        height: 16px;
        margin-inline-end: -3px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        place-items: center;
        color: currentColor;
        background: transparent;
        cursor: pointer;
        font: 15px/1 system-ui, sans-serif;
      }
      :host([closable]) .close { display: grid; }
      .close:hover { background: color-mix(in srgb, currentColor 16%, transparent); }
      .close:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
      ::slotted([slot="icon"]) { width: 1em; height: 1em; }
      @media (prefers-reduced-motion: reduce) { .tag { transition: none; } }
    `;
    this._tag.className = 'tag';
    this._tag.part.add('tag');
    this._icon.className = 'icon';
    this._icon.part.add('icon');
    this._iconSlot.name = 'icon';
    this._iconText.className = 'icon-text';
    this._icon.append(this._iconSlot, this._iconText);
    this._label.className = 'label';
    this._label.part.add('label');
    this._labelText.className = 'label-text';
    this._label.append(this._labelSlot, this._labelText);
    this._close.className = 'close';
    this._close.part.add('close-button');
    this._close.type = 'button';
    this._close.textContent = '×';
    this._close.setAttribute('aria-label', 'Close tag');
    this._tag.append(this._icon, this._label, this._close);
    root.append(style, this._tag);
  }

  connectedCallback(): void {
    this._tag.addEventListener('click', this._onTagClick);
    this._close.addEventListener('click', this._onCloseClick);
    this.addEventListener('keydown', this._onKeydown);
    this._iconSlot.addEventListener('slotchange', this._syncIcon);
    this._labelSlot.addEventListener('slotchange', this._syncLabel);
    this._sync();
  }

  disconnectedCallback(): void {
    this._tag.removeEventListener('click', this._onTagClick);
    this._close.removeEventListener('click', this._onCloseClick);
    this.removeEventListener('keydown', this._onKeydown);
    this._iconSlot.removeEventListener('slotchange', this._syncIcon);
    this._labelSlot.removeEventListener('slotchange', this._syncLabel);
  }

  attributeChangedCallback(): void { this._sync(); }

  get variant(): HYTagVariant { return isVariant(this.getAttribute('variant')) ? this.getAttribute('variant') as HYTagVariant : 'default'; }
  set variant(value: HYTagVariant) { this.setAttribute('variant', isVariant(value) ? value : 'default'); }

  get color(): string { return this.getAttribute('color')?.trim() ?? ''; }
  set color(value: string) { this._setOptionalAttribute('color', value); }

  get size(): HYTagSize { return isSize(this.getAttribute('size')) ? this.getAttribute('size') as HYTagSize : 'medium'; }
  set size(value: HYTagSize) { this.setAttribute('size', isSize(value) ? value : 'medium'); }

  get label(): string { return this.getAttribute('label') ?? ''; }
  set label(value: string) { this._setOptionalAttribute('label', value); }

  get icon(): string { return this.getAttribute('icon') ?? ''; }
  set icon(value: string) { this._setOptionalAttribute('icon', value); }

  get value(): string { return this.getAttribute('value') ?? ''; }
  set value(value: string) { this.setAttribute('value', String(value ?? '')); }

  get closable(): boolean { return this.hasAttribute('closable'); }
  set closable(value: boolean) { this.toggleAttribute('closable', Boolean(value)); }

  get checkable(): boolean { return this.hasAttribute('checkable'); }
  set checkable(value: boolean) { this.toggleAttribute('checkable', Boolean(value)); }

  get checked(): boolean { return this.hasAttribute('checked'); }
  set checked(value: boolean) { this.toggleAttribute('checked', Boolean(value)); }

  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }

  close(): boolean {
    if (!this.closable || this.disabled) return false;
    const accepted = this.dispatchEvent(new CustomEvent<HYTagCloseDetail>('tag-close', {
      detail: { value: this.value },
      bubbles: true,
      composed: true,
      cancelable: true,
    }));
    if (accepted) this.hidden = true;
    return accepted;
  }

  private _toggleChecked(): void {
    if (!this.checkable || this.disabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent<HYTagCheckedChangeDetail>('checked-change', {
      detail: { checked: this.checked, value: this.value },
      bubbles: true,
      composed: true,
    }));
  }

  private _sync(): void {
    this._tag.dataset.variant = this.variant;
    const color = this.color;
    if (color) this._tag.style.setProperty('--_tone', color);
    else this._tag.style.removeProperty('--_tone');
    this._close.disabled = this.disabled;
    this._close.tabIndex = this.closable ? 0 : -1;
    if (this.checkable) {
      this.setAttribute('role', 'checkbox');
      this.setAttribute('aria-checked', String(this.checked));
      this.setAttribute('aria-disabled', String(this.disabled));
      if (!this.hasAttribute('tabindex')) this.tabIndex = this.disabled ? -1 : 0;
    } else {
      this.removeAttribute('role');
      this.removeAttribute('aria-checked');
      this.removeAttribute('aria-disabled');
      if (this.getAttribute('tabindex') === '0' || this.getAttribute('tabindex') === '-1') this.removeAttribute('tabindex');
    }
    this._syncIcon();
    this._syncLabel();
  }

  private _syncIcon = (): void => {
    const assigned = this._iconSlot.assignedNodes({ flatten: true }).some(node => node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()));
    this._iconText.textContent = assigned ? '' : this.icon;
    this._icon.hidden = !assigned && !this.icon;
  };

  private _syncLabel = (): void => {
    const assigned = this._labelSlot.assignedNodes({ flatten: true }).some(node => node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()));
    this._labelText.textContent = assigned ? '' : this.label;
    this._labelText.hidden = assigned || !this.label;
  };

  private _setOptionalAttribute(name: string, value: string): void {
    const normalized = String(value ?? '').trim();
    if (normalized) this.setAttribute(name, normalized);
    else this.removeAttribute(name);
  }

  private _onTagClick = (event: MouseEvent): void => {
    if (event.composedPath().includes(this._close)) return;
    this._toggleChecked();
  };

  private _onCloseClick = (event: MouseEvent): void => {
    event.stopPropagation();
    this.close();
  };

  private _onKeydown = (event: KeyboardEvent): void => {
    if (!this.checkable || this.disabled || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    this._toggleChecked();
  };
}

export function defineTagComponents(): void {
  if (!customElements.get('hy-tag')) customElements.define('hy-tag', HYTag);
}
