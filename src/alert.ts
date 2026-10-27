export type HYAlertType = 'success' | 'info' | 'warning' | 'error';

export interface HYAlertCloseDetail {
  readonly type: HYAlertType;
  readonly message: string;
}

const ALERT_ICONS: Record<HYAlertType, string> = {
  success: '✓',
  info: 'i',
  warning: '!',
  error: '×',
};

/** A semantic, optionally dismissible status message. */
export class HYAlert extends HTMLElement {
  private readonly _surface = document.createElement('div');
  private readonly _icon = document.createElement('span');
  private readonly _content = document.createElement('div');
  private readonly _messageSlot = document.createElement('slot');
  private readonly _descriptionSlot = document.createElement('slot');
  private readonly _actionSlot = document.createElement('slot');
  private readonly _close = document.createElement('button');

  static get observedAttributes(): string[] {
    return ['type', 'message', 'description', 'show-icon', 'closable', 'close-text', 'banner'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #d8e2f2); font: 12px/1.5 system-ui, sans-serif; }
      :host([hidden]) { display: none; }
      .alert { --_tone: var(--hy-info-color, #4ba3d3); --_tone-bg: var(--hy-alert-info-bg, color-mix(in srgb, var(--_tone) 13%, var(--hy-surface-color, #121822))); display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 10px; align-items: start; box-sizing: border-box; min-height: 42px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--_tone) 42%, var(--hy-border-color, #303746)); border-radius: var(--hy-alert-radius, 6px); background: var(--_tone-bg); }
      .alert.success { --_tone: var(--hy-success-color, #45b883); --_tone-bg: var(--hy-alert-success-bg, color-mix(in srgb, var(--_tone) 13%, var(--hy-surface-color, #121822))); }
      .alert.warning { --_tone: var(--hy-warning-color, #d5a642); --_tone-bg: var(--hy-alert-warning-bg, color-mix(in srgb, var(--_tone) 14%, var(--hy-surface-color, #121822))); }
      .alert.error { --_tone: var(--hy-error-color, #e06b72); --_tone-bg: var(--hy-alert-error-bg, color-mix(in srgb, var(--_tone) 13%, var(--hy-surface-color, #121822))); }
      :host([banner]) .alert { border-inline: 0; border-radius: 0; }
      .icon { display: none; width: 18px; height: 18px; place-items: center; margin-top: 1px; border-radius: 50%; color: var(--hy-alert-icon-text-color, #fff); background: var(--_tone); font-size: 11px; font-weight: 800; line-height: 1; }
      .icon.visible { display: grid; }
      .content { min-width: 0; }
      .message { display: block; color: var(--hy-alert-message-color, var(--hy-text-color, #d8e2f2)); font-weight: 600; overflow-wrap: anywhere; }
      .description { display: block; margin-top: 2px; color: var(--hy-alert-description-color, var(--hy-secondary-text-color, #8fa7c8)); overflow-wrap: anywhere; }
      .description.empty { display: none; }
      .action { align-self: center; }
      .action.empty { display: none; }
      button { min-width: 24px; height: 24px; margin: -2px -4px -2px 0; padding: 0 5px; border: 0; border-radius: 4px; color: var(--hy-alert-close-color, var(--hy-secondary-text-color, #8fa7c8)); background: transparent; font: inherit; cursor: pointer; }
      button:hover { color: var(--hy-alert-close-hover-color, var(--hy-text-color, #d8e2f2)); background: color-mix(in srgb, var(--_tone) 14%, transparent); }
      button:focus-visible { outline: 2px solid var(--hy-focus-border-color, #3d6fa8); outline-offset: 1px; }
      button[hidden] { display: none; }
      ::slotted([slot="icon"]) { color: var(--_tone); }
    `;
    this._surface.className = 'alert info';
    this._surface.part.add('alert');
    this._surface.setAttribute('role', 'alert');
    this._icon.className = 'icon';
    this._icon.part.add('icon');
    const iconSlot = document.createElement('slot');
    iconSlot.name = 'icon';
    this._icon.append(iconSlot);
    this._content.className = 'content';
    this._content.part.add('content');
    this._messageSlot.name = 'message';
    this._messageSlot.className = 'message';
    this._messageSlot.part.add('message');
    this._descriptionSlot.className = 'description';
    this._descriptionSlot.part.add('description');
    this._actionSlot.name = 'action';
    this._actionSlot.className = 'action';
    this._actionSlot.part.add('action');
    this._content.append(this._messageSlot, this._descriptionSlot);
    this._close.type = 'button';
    this._close.part.add('close-button');
    this._surface.append(this._icon, this._content, this._actionSlot, this._close);
    root.append(style, this._surface);
  }

  connectedCallback(): void {
    this._close.addEventListener('click', this._onClose);
    this._descriptionSlot.addEventListener('slotchange', this._syncSlotState);
    this._actionSlot.addEventListener('slotchange', this._syncSlotState);
    this._render();
  }

  disconnectedCallback(): void {
    this._close.removeEventListener('click', this._onClose);
    this._descriptionSlot.removeEventListener('slotchange', this._syncSlotState);
    this._actionSlot.removeEventListener('slotchange', this._syncSlotState);
  }

  attributeChangedCallback(): void { this._render(); }

  get type(): HYAlertType {
    const value = this.getAttribute('type');
    return value === 'success' || value === 'warning' || value === 'error' ? value : 'info';
  }
  set type(value: HYAlertType) { this.setAttribute('type', value); }
  get message(): string { return this.getAttribute('message') ?? ''; }
  set message(value: string) { if (value) this.setAttribute('message', value); else this.removeAttribute('message'); }
  get description(): string { return this.getAttribute('description') ?? ''; }
  set description(value: string) { if (value) this.setAttribute('description', value); else this.removeAttribute('description'); }
  get showIcon(): boolean { return this.hasAttribute('show-icon'); }
  set showIcon(value: boolean) { this.toggleAttribute('show-icon', Boolean(value)); }
  get closable(): boolean { return this.hasAttribute('closable'); }
  set closable(value: boolean) { this.toggleAttribute('closable', Boolean(value)); }
  get closeText(): string { return this.getAttribute('close-text') ?? ''; }
  set closeText(value: string) { if (value) this.setAttribute('close-text', value); else this.removeAttribute('close-text'); }
  get banner(): boolean { return this.hasAttribute('banner'); }
  set banner(value: boolean) { this.toggleAttribute('banner', Boolean(value)); }

  close(): boolean {
    const event = new CustomEvent<HYAlertCloseDetail>('alert-close', {
      detail: { type: this.type, message: this.message },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (!this.dispatchEvent(event)) return false;
    this.hidden = true;
    return true;
  }

  private readonly _onClose = (): void => { this.close(); };
  private readonly _syncSlotState = (): void => {
    const hasDescription = Boolean(this.description) || this._descriptionSlot.assignedNodes({ flatten: true }).some(node => node.textContent?.trim());
    const hasAction = this._actionSlot.assignedNodes({ flatten: true }).some(node => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim());
    this._descriptionSlot.classList.toggle('empty', !hasDescription);
    this._actionSlot.classList.toggle('empty', !hasAction);
  };

  private _render(): void {
    this._surface.className = `alert ${this.type}`;
    this._messageSlot.textContent = this.message;
    this._descriptionSlot.textContent = this.description;
    this._icon.classList.toggle('visible', this.showIcon || this.banner);
    const iconSlot = this._icon.querySelector('slot');
    if (iconSlot) iconSlot.textContent = ALERT_ICONS[this.type];
    this._close.hidden = !this.closable;
    this._close.textContent = this.closeText || '×';
    this._close.setAttribute('aria-label', this.closeText || 'Close alert');
    this._syncSlotState();
  }
}

export function defineAlertComponents(): void {
  if (!customElements.get('hy-alert')) customElements.define('hy-alert', HYAlert);
}
