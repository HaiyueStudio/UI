export type GEDialogCloseReason = 'action' | 'backdrop' | 'escape' | 'programmatic';

export interface GEDialogCloseDetail {
  readonly reason: GEDialogCloseReason | string;
}

/** Accessible modal surface with slotted body/footer content and reflected open state. */
export class GEDialog extends HTMLElement {
  private readonly _dialog = document.createElement('dialog');
  private readonly _title = document.createElement('h2');
  private readonly _closeButton = document.createElement('button');
  private _returnFocus: HTMLElement | null = null;
  private _closeReason: GEDialogCloseDetail['reason'] = 'programmatic';

  static get observedAttributes(): string[] {
    return ['open', 'heading', 'dismissible'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        color: var(--ge-text-color, #e6edf7);
        font: 13px system-ui, sans-serif;
      }
      dialog {
        width: min(var(--ge-dialog-width, 460px), calc(100vw - 32px));
        max-height: calc(100vh - 32px);
        margin: auto;
        padding: 0;
        overflow: hidden;
        border: 1px solid var(--ge-border-color, #303746);
        border-radius: var(--ge-dialog-radius, 8px);
        color: inherit;
        background: var(--ge-dialog-bg-color, var(--ge-surface-elevated-color, #171e2a));
        box-shadow: 0 22px 70px var(--ge-dialog-shadow-color, rgba(0, 0, 0, 0.52));
      }
      dialog::backdrop {
        background: var(--ge-dialog-backdrop-color, rgba(3, 7, 12, 0.66));
        backdrop-filter: blur(var(--ge-dialog-backdrop-blur, 2px));
      }
      .header {
        display: flex;
        align-items: center;
        min-height: 49px;
        padding: 0 12px 0 16px;
        border-bottom: 1px solid var(--ge-border-color, #303746);
      }
      h2 {
        flex: 1;
        min-width: 0;
        margin: 0;
        overflow: hidden;
        font-size: 14px;
        font-weight: 650;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .close {
        display: none;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 5px;
        color: var(--ge-secondary-text-color, #8b99ad);
        background: transparent;
        cursor: pointer;
        font: 20px/1 system-ui, sans-serif;
      }
      :host([dismissible]) .close { display: grid; place-items: center; }
      .close:hover { color: inherit; background: var(--ge-hover-bg-color, #242d3b); }
      .body {
        max-height: calc(100vh - 160px);
        overflow: auto;
        padding: var(--ge-dialog-body-padding, 16px);
        color: var(--ge-dialog-body-color, var(--ge-secondary-text-color, #a8b4c5));
        line-height: 1.55;
      }
      .footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        min-height: 54px;
        padding: 10px 14px;
        border-top: 1px solid var(--ge-border-color, #303746);
        background: var(--ge-dialog-footer-bg-color, rgba(9, 13, 19, 0.22));
      }
      slot[name="footer"]::slotted(*) { margin: 0; }
    `;
    const header = document.createElement('header');
    header.className = 'header';
    this._title.id = 'title';
    this._closeButton.className = 'close';
    this._closeButton.type = 'button';
    this._closeButton.setAttribute('aria-label', 'Close');
    this._closeButton.textContent = '×';
    header.append(this._title, this._closeButton);

    const body = document.createElement('div');
    body.className = 'body';
    body.append(document.createElement('slot'));
    const footer = document.createElement('footer');
    footer.className = 'footer';
    const footerSlot = document.createElement('slot');
    footerSlot.name = 'footer';
    footer.append(footerSlot);
    this._dialog.setAttribute('aria-labelledby', this._title.id);
    this._dialog.append(header, body, footer);
    root.append(style, this._dialog);

    this._closeButton.addEventListener('click', () => this.close('action'));
    this._dialog.addEventListener('cancel', this._onCancel);
    this._dialog.addEventListener('click', this._onDialogClick);
    this._dialog.addEventListener('close', this._onNativeClose);
  }

  connectedCallback(): void {
    this._syncHeading();
    this._syncOpen();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'heading') this._syncHeading();
    if (name === 'open' && this.isConnected) this._syncOpen();
  }

  get open(): boolean { return this.hasAttribute('open'); }
  set open(value: boolean) { this.toggleAttribute('open', value); }

  get dismissible(): boolean { return this.hasAttribute('dismissible'); }
  set dismissible(value: boolean) { this.toggleAttribute('dismissible', value); }

  get heading(): string { return this.getAttribute('heading') ?? ''; }
  set heading(value: string) { this.setAttribute('heading', value); }

  showModal(): void {
    if (this.open && this._dialog.open) return;
    this._returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this._closeReason = 'programmatic';
    this.open = true;
  }

  close(reason: GEDialogCloseDetail['reason'] = 'programmatic'): void {
    if (!this.open && !this._dialog.open) return;
    this._closeReason = reason;
    this.open = false;
  }

  private _syncHeading(): void {
    this._title.textContent = this.heading || 'Dialog';
  }

  private _syncOpen(): void {
    if (this.open && !this._dialog.open) {
      this._returnFocus ??= document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this._dialog.showModal();
      return;
    }
    if (!this.open && this._dialog.open) this._dialog.close();
  }

  private _onCancel = (event: Event): void => {
    event.preventDefault();
    if (!this.dismissible) return;
    const forwarded = new CustomEvent('dialog-cancel', { bubbles: true, composed: true, cancelable: true });
    if (this.dispatchEvent(forwarded)) this.close('escape');
  };

  private _onDialogClick = (event: MouseEvent): void => {
    if (!this.dismissible || event.target !== this._dialog) return;
    const rect = this._dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) this.close('backdrop');
  };

  private _onNativeClose = (): void => {
    this.removeAttribute('open');
    const reason = this._closeReason;
    this._closeReason = 'programmatic';
    this.dispatchEvent(new CustomEvent<GEDialogCloseDetail>('dialog-close', {
      detail: { reason },
      bubbles: true,
      composed: true,
    }));
    this._returnFocus?.focus();
    this._returnFocus = null;
  };
}

export function defineDialogComponents(): void {
  if (!customElements.get('ge-dialog')) customElements.define('ge-dialog', GEDialog);
}
