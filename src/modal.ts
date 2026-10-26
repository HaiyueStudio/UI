export type HYModalCloseReason = 'ok' | 'cancel' | 'close-button' | 'mask' | 'escape' | 'programmatic';
export interface HYModalActionDetail { readonly reason: Exclude<HYModalCloseReason, 'programmatic'>; }
export interface HYModalCloseDetail { readonly reason: HYModalCloseReason | string; }

const scrollLocks = new WeakMap<Document, { count: number; value: string; priority: string }>();

function focusedElement(document: Document): HTMLElement | null {
  let element: Element | null = document.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element instanceof HTMLElement ? element : null;
}

function focusableElements(root: Element | ShadowRoot): HTMLElement[] {
  const result: HTMLElement[] = [];
  const visit = (element: Element): void => {
    if (element instanceof HTMLElement && (element.hidden || element.inert || element.matches(':disabled'))) return;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    if (element instanceof HTMLSlotElement) {
      const assigned = element.assignedElements({ flatten: true });
      for (const child of assigned.length ? assigned : element.children) visit(child);
      return;
    }
    if (element instanceof HTMLElement && element.getClientRects().length &&
      (element.tabIndex >= 0 || (element.isContentEditable && !element.hasAttribute('tabindex')))) result.push(element);
    for (const child of element.shadowRoot?.children ?? element.children) visit(child);
  };
  for (const child of root.children) visit(child);
  return result.sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
}

/** A native modal with default actions, async confirmation support and slotted content. */
export class HYModal extends HTMLElement {
  private readonly _dialog = document.createElement('dialog');
  private readonly _headingSlot = document.createElement('slot');
  private readonly _titleText = document.createElement('span');
  private readonly _closeButton = document.createElement('button');
  private readonly _footer = document.createElement('footer');
  private readonly _cancelButton = document.createElement('button');
  private readonly _okButton = document.createElement('button');
  private readonly _okLabel = document.createElement('span');
  private readonly _spinner = document.createElement('span');
  private readonly _detachedContent = document.createDocumentFragment();
  private readonly _contentObserver = new MutationObserver(() => {
    if (this.isConnected && !this._shown && this.destroyOnHidden) this._stashContent();
  });
  private _returnFocus: HTMLElement | null = null;
  private _shown = false;
  private _scrollDocument: Document | null = null;
  private _session = 0;
  private _closeReason: HYModalCloseDetail['reason'] = 'programmatic';
  private _pointerDownOutside = false;

  static get observedAttributes(): string[] {
    return ['open', 'heading', 'width', 'centered', 'closable', 'mask-closable', 'keyboard', 'confirm-loading', 'confirm-disabled', 'ok-text', 'cancel-text', 'show-footer', 'controlled', 'destroy-on-hidden', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { color: var(--hy-text-color, #eef0ff); font: 13px/1.5 system-ui, sans-serif; }
      dialog { box-sizing: border-box; flex-direction: column; width: min(var(--_hy-modal-width, var(--hy-modal-width, 520px)), calc(100vw - 32px)); max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); max-height: calc(100dvh - 32px); margin: auto; padding: 0; overflow: hidden; border: 1px solid var(--hy-border-color, #343765); border-radius: var(--hy-modal-radius, 12px); color: inherit; background: var(--hy-modal-bg-color, var(--hy-surface-elevated-color, #181a40)); box-shadow: 0 24px 80px var(--hy-modal-shadow-color, rgba(0,0,0,.45)); }
      dialog:not([open]), [hidden] { display: none !important; }
      dialog[open] { display: flex; animation: hy-modal-enter var(--hy-modal-duration, 160ms) ease-out; }
      dialog::backdrop { background: var(--hy-modal-mask-color, var(--hy-dialog-backdrop-color, rgba(3,7,12,.66))); backdrop-filter: blur(var(--hy-modal-mask-blur, 2px)); }
      :host([centered="false"]) dialog { margin: min(64px, 10vh) auto auto; max-height: calc(100vh - 96px); max-height: calc(100dvh - 96px); }
      .header { display: flex; flex: 0 0 auto; align-items: center; gap: 12px; min-height: 56px; padding: 12px 16px 12px 20px; box-sizing: border-box; border-bottom: 1px solid var(--hy-border-color, #343765); }
      h2 { flex: 1; min-width: 0; margin: 0; font-size: 16px; font-weight: 650; overflow-wrap: anywhere; }
      .body { flex: 1 1 auto; min-height: 0; padding: var(--hy-modal-body-padding, 20px); overflow: auto; color: var(--hy-secondary-text-color, #a9add4); }
      .footer { flex: 0 0 auto; padding: 12px 20px; border-top: 1px solid var(--hy-border-color, #343765); background: var(--hy-modal-footer-bg-color, var(--hy-surface-color, #10132f)); }
      .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
      button { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 32px; padding: 6px 14px; border: 1px solid var(--hy-border-strong-color, #484b84); border-radius: var(--hy-modal-button-radius, 6px); color: var(--hy-text-color, #eef0ff); background: var(--hy-surface-elevated-color, #181a40); font: inherit; cursor: pointer; }
      button:hover:not(:disabled) { background: var(--hy-hover-bg-color, #242752); }
      button:disabled { opacity: .5; cursor: default; }
      button:focus-visible, dialog:focus-visible { outline: 2px solid var(--hy-focus-border-color, #9c8fff); outline-offset: -3px; }
      .close { flex: 0 0 auto; width: 30px; height: 30px; min-height: 0; padding: 0; border: 0; background: transparent; color: var(--hy-secondary-text-color, #a9add4); font-size: 22px; }
      .ok { border-color: transparent; color: var(--hy-selected-text-color, #fff); background: var(--hy-accent-strong-color, #554cc6); }
      .ok:hover:not(:disabled) { background: var(--hy-accent-color, #8177f2); }
      .spinner { width: 12px; height: 12px; border: 2px solid currentColor; border-inline-end-color: transparent; border-radius: 50%; animation: hy-modal-spin .7s linear infinite; }
      ::slotted([slot="footer"]) { margin: 0; }
      @keyframes hy-modal-enter { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
      @keyframes hy-modal-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { dialog[open], .spinner { animation: none; } }
    `;
    this._dialog.part.add('panel'); this._dialog.tabIndex = -1; this._dialog.setAttribute('aria-modal', 'true');
    const header = document.createElement('header'); header.className = 'header'; header.part.add('header');
    const title = document.createElement('h2'); title.id = 'modal-heading'; title.part.add('heading');
    this._headingSlot.name = 'heading'; this._headingSlot.append(this._titleText); title.append(this._headingSlot);
    this._closeButton.className = 'close'; this._closeButton.type = 'button'; this._closeButton.part.add('close-button'); this._closeButton.setAttribute('aria-label', 'Close modal'); this._closeButton.textContent = '×';
    header.append(title, this._closeButton);
    const body = document.createElement('div'); body.className = 'body'; body.part.add('body'); body.append(document.createElement('slot'));
    this._footer.className = 'footer'; this._footer.part.add('footer');
    const footerSlot = document.createElement('slot'); footerSlot.name = 'footer';
    const actions = document.createElement('div'); actions.className = 'actions'; actions.part.add('actions');
    this._cancelButton.type = this._okButton.type = 'button';
    this._cancelButton.part.add('cancel-button'); this._okButton.part.add('ok-button'); this._okButton.className = 'ok';
    this._spinner.className = 'spinner'; this._spinner.part.add('spinner'); this._spinner.setAttribute('aria-hidden', 'true');
    this._okButton.append(this._spinner, this._okLabel); actions.append(this._cancelButton, this._okButton); footerSlot.append(actions); this._footer.append(footerSlot);
    this._dialog.append(header, body, this._footer); root.append(style, this._dialog);
    this._closeButton.addEventListener('click', () => this._requestAction('close-button'));
    this._cancelButton.addEventListener('click', () => this._requestAction('cancel'));
    this._okButton.addEventListener('click', () => this._requestAction('ok'));
    this._dialog.addEventListener('cancel', event => { event.preventDefault(); if (this.keyboard) this._requestAction('escape'); });
    this._dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || event.defaultPrevented || event.composedPath().find(node => node instanceof HTMLDialogElement) !== this._dialog) return;
      const elements = focusableElements(this._dialog); const active = focusedElement(this.ownerDocument);
      const first = elements[0]; const last = elements.at(-1);
      if (!first || !active || !elements.includes(active) || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault(); (event.shiftKey ? last ?? this._dialog : first ?? this._dialog).focus();
      }
    });
    this._dialog.addEventListener('pointerdown', event => { this._pointerDownOutside = event.target === this._dialog && this._outside(event); });
    this._dialog.addEventListener('pointercancel', () => { this._pointerDownOutside = false; });
    this._dialog.addEventListener('click', event => {
      const outside = this._pointerDownOutside && event.target === this._dialog && this._outside(event); this._pointerDownOutside = false;
      if (outside && this.maskClosable) this._requestAction('mask');
    });
    this._dialog.addEventListener('close', () => {
      // Native close is queued; an old event must not close a newly opened session.
      if (!this.isConnected || this._dialog.open || !this._shown) return;
      this._finalizeClose(this._dialog.returnValue || 'programmatic');
    });
  }

  connectedCallback(): void {
    this._contentObserver.observe(this, { childList: true });
    this._syncView(); this._syncOpen();
    if (!this._shown && this.destroyOnHidden) this._stashContent();
  }

  disconnectedCallback(): void {
    this._contentObserver.disconnect(); this._shown = false; this._session++; this._pointerDownOutside = false;
    if (this._dialog.open) this._dialog.close();
    this._unlockScroll(); this._restoreFocus();
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (oldValue === value || !this.isConnected) return;
    this._syncView();
    if (name === 'open') this._syncOpen();
    if (name === 'destroy-on-hidden' && !this._shown) {
      if (this.destroyOnHidden) this._stashContent(); else this._restoreContent();
    }
  }

  get open(): boolean { return this.hasAttribute('open'); }
  set open(value: boolean) { this.toggleAttribute('open', Boolean(value)); }
  get heading(): string { return this.getAttribute('heading') ?? ''; }
  set heading(value: string) { this.setAttribute('heading', value); }
  get width(): number { const number = Number(this.getAttribute('width') ?? 520); return Number.isFinite(number) ? Math.max(240, Math.min(2000, number)) : 520; }
  set width(value: number) { this.setAttribute('width', String(Number.isFinite(value) ? Math.max(240, Math.min(2000, value)) : 520)); }
  get centered(): boolean { return this.getAttribute('centered') !== 'false'; }
  set centered(value: boolean) { this.setAttribute('centered', String(Boolean(value))); }
  get closable(): boolean { return this.getAttribute('closable') !== 'false'; }
  set closable(value: boolean) { this.setAttribute('closable', String(Boolean(value))); }
  get maskClosable(): boolean { return this.getAttribute('mask-closable') !== 'false'; }
  set maskClosable(value: boolean) { this.setAttribute('mask-closable', String(Boolean(value))); }
  get keyboard(): boolean { return this.getAttribute('keyboard') !== 'false'; }
  set keyboard(value: boolean) { this.setAttribute('keyboard', String(Boolean(value))); }
  get confirmLoading(): boolean { return this.hasAttribute('confirm-loading') && this.getAttribute('confirm-loading') !== 'false'; }
  set confirmLoading(value: boolean) { if (value) this.setAttribute('confirm-loading', ''); else this.removeAttribute('confirm-loading'); }
  get confirmDisabled(): boolean { return this.hasAttribute('confirm-disabled') && this.getAttribute('confirm-disabled') !== 'false'; }
  set confirmDisabled(value: boolean) { if (value) this.setAttribute('confirm-disabled', ''); else this.removeAttribute('confirm-disabled'); }
  get okText(): string { return this.getAttribute('ok-text') ?? 'OK'; }
  set okText(value: string) { this.setAttribute('ok-text', value); }
  get cancelText(): string { return this.getAttribute('cancel-text') ?? 'Cancel'; }
  set cancelText(value: string) { this.setAttribute('cancel-text', value); }
  get showFooter(): boolean { return this.getAttribute('show-footer') !== 'false'; }
  set showFooter(value: boolean) { this.setAttribute('show-footer', String(Boolean(value))); }
  get controlled(): boolean { return this.hasAttribute('controlled'); }
  set controlled(value: boolean) { this.toggleAttribute('controlled', Boolean(value)); }
  get destroyOnHidden(): boolean { return this.hasAttribute('destroy-on-hidden'); }
  set destroyOnHidden(value: boolean) { this.toggleAttribute('destroy-on-hidden', Boolean(value)); }

  showModal(): void { this.open = true; if (this.isConnected) this._syncOpen(); }
  close(reason: HYModalCloseDetail['reason'] = 'programmatic'): void {
    this._closeReason = reason;
    this.open = false;
    if (this.isConnected) this._syncOpen();
  }

  private _syncView(): void {
    this._titleText.textContent = this.heading || 'Modal';
    const label = this.getAttribute('aria-label');
    if (label) { this._dialog.setAttribute('aria-label', label); this._dialog.removeAttribute('aria-labelledby'); }
    else { this._dialog.removeAttribute('aria-label'); this._dialog.setAttribute('aria-labelledby', 'modal-heading'); }
    if (this.hasAttribute('width')) this._dialog.style.setProperty('--_hy-modal-width', `${this.width}px`); else this._dialog.style.removeProperty('--_hy-modal-width');
    this._closeButton.hidden = !this.closable; this._closeButton.disabled = this.confirmLoading;
    this._footer.hidden = !this.showFooter;
    this._cancelButton.textContent = this.cancelText; this._okLabel.textContent = this.okText;
    this._okButton.disabled = this.confirmLoading || this.confirmDisabled; this._cancelButton.disabled = this.confirmLoading;
    this._okButton.setAttribute('aria-busy', String(this.confirmLoading)); this._dialog.setAttribute('aria-busy', String(this.confirmLoading));
    this._spinner.hidden = !this.confirmLoading;
  }

  private _syncOpen(): void {
    if (this.open && !this._shown) {
      this._restoreContent(); this._syncView();
      this._returnFocus = focusedElement(this.ownerDocument);
      this._dialog.returnValue = ''; this._shown = true; const session = ++this._session; this._closeReason = 'programmatic';
      this._lockScroll();
      try { this._dialog.showModal(); }
      catch (error) { this._shown = false; this._unlockScroll(); throw error; }
      if (this._shown && session === this._session) this.dispatchEvent(new CustomEvent('modal-open', { bubbles: true, composed: true }));
    } else if (!this.open && this._shown) {
      const reason = this._closeReason; const session = this._session; this._shown = false;
      if (this._dialog.open) this._dialog.close();
      if (session === this._session) this._finalizeClose(reason);
      else this.dispatchEvent(new CustomEvent<HYModalCloseDetail>('modal-close', { detail: { reason }, bubbles: true, composed: true }));
    }
  }

  private _finalizeClose(reason: HYModalCloseDetail['reason']): void {
    this._shown = false; this._closeReason = 'programmatic'; this._pointerDownOutside = false;
    this.removeAttribute('open'); this._unlockScroll();
    if (this.destroyOnHidden) this._stashContent();
    this._restoreFocus();
    this.dispatchEvent(new CustomEvent<HYModalCloseDetail>('modal-close', { detail: { reason }, bubbles: true, composed: true }));
  }

  private _requestAction(reason: HYModalActionDetail['reason']): void {
    if (!this._shown || this.confirmLoading || (reason === 'ok' && this.confirmDisabled)) return;
    const session = this._session;
    const accepted = this.dispatchEvent(new CustomEvent<HYModalActionDetail>(reason === 'ok' ? 'modal-ok' : 'modal-cancel', {
      detail: { reason }, bubbles: true, composed: true, cancelable: true,
    }));
    if (accepted && !this.controlled && !this.confirmLoading && this._shown && session === this._session) this.close(reason);
  }

  private _outside(event: MouseEvent): boolean {
    const rect = this._dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  private _stashContent(): void { if (this.childNodes.length) this._detachedContent.append(...this.childNodes); }
  private _restoreContent(): void { if (this._detachedContent.childNodes.length) this.prepend(this._detachedContent); }
  private _restoreFocus(): void {
    const element = this._returnFocus; this._returnFocus = null;
    if (element?.isConnected) element.focus({ preventScroll: true });
  }
  private _lockScroll(): void {
    if (this._scrollDocument) return;
    const document = this.ownerDocument; const style = document.documentElement.style;
    const state = scrollLocks.get(document) ?? { count: 0, value: style.getPropertyValue('overflow'), priority: style.getPropertyPriority('overflow') };
    state.count++; scrollLocks.set(document, state); style.setProperty('overflow', 'hidden'); this._scrollDocument = document;
  }
  private _unlockScroll(): void {
    const document = this._scrollDocument; if (!document) return;
    this._scrollDocument = null; const state = scrollLocks.get(document); if (!state) return;
    if (--state.count > 0) return;
    scrollLocks.delete(document); const style = document.documentElement.style;
    if (style.getPropertyValue('overflow') !== 'hidden' || style.getPropertyPriority('overflow')) return;
    if (state.value) style.setProperty('overflow', state.value, state.priority); else style.removeProperty('overflow');
  }
}

export function defineModalComponents(): void {
  if (!customElements.get('hy-modal')) customElements.define('hy-modal', HYModal);
}
