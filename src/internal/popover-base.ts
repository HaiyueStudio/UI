export type HYPopoverPlacement = 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end';
export type HYPopoverTrigger = 'click' | 'hover' | 'focus' | 'manual';
export type HYPopoverCloseReason = 'api' | 'trigger' | 'outside' | 'escape' | 'blur' | 'confirm' | 'cancel' | 'disabled';
export interface HYPopoverOpenChangeDetail { open: boolean; reason: HYPopoverCloseReason; }
export interface HYPopconfirmActionDetail { source: 'button' | 'api'; }
let panelId = 0;

function deepestActive(document: Document): HTMLElement | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active instanceof HTMLElement ? active : null;
}

function composedContains(container: Node, node: Node | null): boolean {
  while (node) {
    if (node === container) return true;
    node = node instanceof Element && node.assignedSlot ? node.assignedSlot : node.parentNode ?? (node instanceof ShadowRoot ? node.host : null);
  }
  return false;
}

function firstFocusable(root: Element | ShadowRoot): HTMLElement | null {
  for (const element of root.children) {
    if (element instanceof HTMLElement && (element.hidden || element.inert || element.matches(':disabled'))) continue;
    if (element instanceof HTMLSlotElement) {
      for (const assigned of element.assignedElements({ flatten: true })) {
        if (assigned instanceof HTMLElement && assigned.tabIndex >= 0 && !assigned.matches(':disabled')) return assigned;
        const found = firstFocusable(assigned.shadowRoot ?? assigned); if (found) return found;
      }
    }
    if (element instanceof HTMLElement && element.tabIndex >= 0 && element.getClientRects().length) return element;
    const found = firstFocusable(element.shadowRoot ?? element); if (found) return found;
  }
  return null;
}

/** Shared implementation for two isolated public entries; importing never registers elements. */
export class HYPopoverBase extends HTMLElement {
  private readonly _triggerSlot = document.createElement('slot');
  private readonly _panel = document.createElement('div');
  private readonly _headingSlot = document.createElement('slot');
  private readonly _headingText = document.createElement('span');
  private readonly _contentSlot = document.createElement('slot');
  private readonly _description = document.createElement('p');
  private readonly _footer = document.createElement('div');
  private readonly _cancel = document.createElement('button');
  private readonly _confirm = document.createElement('button');
  private readonly _panelId = `hy-popover-${++panelId}`;
  private _listeners: AbortController | null = null;
  private _observer: ResizeObserver | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _focusTimer: ReturnType<typeof setTimeout> | null = null;
  private _shown = false;
  private _restoringFocus = false;
  private _focusInside = false;
  private _reflecting = false;
  private _returnFocus: HTMLElement | null = null;
  private _reason: HYPopoverCloseReason = 'api';
  private _triggerAttributes = new Map<HTMLElement, Map<string, string | null>>();

  static get observedAttributes(): string[] { return ['open', 'disabled', 'trigger', 'placement', 'heading', 'content', 'description', 'aria-label', 'show-delay', 'hide-delay', 'confirm-loading', 'confirm-disabled', 'ok-text', 'cancel-text']; }

  protected constructor(private readonly _confirmation: boolean) {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; min-width: 0; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      .panel { position: fixed; inset: auto; margin: 0; box-sizing: border-box; width: var(--hy-popover-width, 280px); max-width: calc(100vw - 16px); max-height: calc(100dvh - 16px); overflow: auto; padding: var(--hy-space-6, 12px); border: 1px solid var(--hy-border-color, #303746); border-radius: var(--hy-radius-md, 6px); color: var(--hy-text-color, #d8e2f2); background: var(--hy-surface-elevated-color, #1b2230); box-shadow: var(--hy-popover-shadow, 0 8px 28px rgba(0,0,0,.25)); z-index: var(--hy-popover-z-index, 1050); }
      .panel:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: -2px; }
      .heading { display: block; margin-bottom: var(--hy-space-3, 6px); font-weight: 600; overflow-wrap: anywhere; }
      p { margin: 0 0 var(--hy-space-3, 6px); color: var(--hy-secondary-text-color, #aebbd0); overflow-wrap: anywhere; }
      .footer { display: flex; justify-content: flex-end; gap: var(--hy-space-4, 8px); margin-top: var(--hy-space-6, 12px); }
      button { min-height: var(--hy-control-height-sm, 28px); padding: 0 var(--hy-space-5, 10px); border: 1px solid var(--hy-border-color, #303746); border-radius: var(--hy-radius-sm, 4px); color: inherit; background: var(--hy-surface-color, #121822); cursor: pointer; font: inherit; }
      button:hover:not(:disabled) { background: var(--hy-hover-bg-color, #273241); } button:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 2px; }
      .confirm { color: var(--hy-selected-text-color, #fff); background: var(--hy-accent-strong-color, #554cc6); border-color: transparent; }
      button:disabled { opacity: .55; cursor: not-allowed; } [hidden] { display: none !important; }
    `;
    this._triggerSlot.name = 'trigger'; this._triggerSlot.part.add('trigger');
    this._panel.id = this._panelId; this._panel.className = 'panel'; this._panel.part.add('panel'); this._panel.hidden = true;
    this._panel.setAttribute('popover', 'manual'); this._panel.setAttribute('role', 'dialog'); this._panel.tabIndex = -1;
    this._headingSlot.name = 'heading'; this._headingSlot.className = 'heading'; this._headingSlot.part.add('heading'); this._headingSlot.append(this._headingText);
    this._description.part.add('description'); this._contentSlot.part.add('content');
    this._footer.className = 'footer'; this._footer.part.add('footer'); this._footer.hidden = !_confirmation;
    this._cancel.type = this._confirm.type = 'button'; this._confirm.className = 'confirm'; this._confirm.part.add('confirm'); this._cancel.part.add('cancel');
    this._footer.append(this._cancel, this._confirm); this._panel.append(this._headingSlot, this._description, this._contentSlot, this._footer); root.append(style, this._triggerSlot, this._panel);
  }

  connectedCallback(): void {
    this._listeners?.abort(); this._listeners = new AbortController(); const { signal } = this._listeners;
    this.addEventListener('click', this._onTriggerClick, { signal }); this.addEventListener('keydown', this._onKeydown, { signal });
    this.addEventListener('pointerenter', this._onEnter, { signal }); this.addEventListener('pointerleave', this._onLeave, { signal });
    this._panel.addEventListener('pointerenter', this._onEnter, { signal }); this._panel.addEventListener('pointerleave', this._onLeave, { signal });
    this.addEventListener('focusin', this._onFocusIn, { signal }); this.addEventListener('focusout', this._onFocusOut, { signal });
    this._triggerSlot.addEventListener('slotchange', this._syncTrigger, { signal }); this._headingSlot.addEventListener('slotchange', this._sync, { signal });
    this._confirm.addEventListener('click', () => this._act('confirm', 'button'), { signal }); this._cancel.addEventListener('click', () => this._act('cancel', 'button'), { signal });
    this.ownerDocument.addEventListener('pointerdown', this._onOutside, { capture: true, signal });
    this.ownerDocument.addEventListener('scroll', this._onScroll, { capture: true, signal });
    this.ownerDocument.defaultView?.addEventListener('resize', this._position, { signal });
    this._observer = new ResizeObserver(this._position); this._observer.observe(this._panel); this._observer.observe(this);
    this._sync(); this._syncTrigger();
  }
  disconnectedCallback(): void {
    this._clearTimer(); this._clearFocusTimer(); this._listeners?.abort(); this._listeners = null; this._observer?.disconnect(); this._observer = null;
    this._hidePanel(false); this._restoreTrigger();
  }
  attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
    if (previous === next || this._reflecting) return;
    if (name === 'disabled' && this.disabled && this.open) { this._setOpen(false, 'disabled'); return; }
    this._sync();
  }
  get open(): boolean { return this.hasAttribute('open'); }
  set open(value: boolean) { this._setOpen(Boolean(value), 'api'); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }
  get trigger(): HYPopoverTrigger { const value = this.getAttribute('trigger'); return value === 'hover' || value === 'focus' || value === 'manual' ? value : 'click'; }
  set trigger(value: HYPopoverTrigger) { this.setAttribute('trigger', value); }
  get placement(): HYPopoverPlacement { const value = this.getAttribute('placement') ?? 'bottom'; return /^(top|bottom|left|right)(-start|-end)?$/u.test(value) ? value as HYPopoverPlacement : 'bottom'; }
  set placement(value: HYPopoverPlacement) { this.setAttribute('placement', value); }
  get heading(): string { return this.getAttribute('heading') ?? ''; }
  set heading(value: string) { this.setAttribute('heading', value); }
  get content(): string { return this.getAttribute('content') ?? ''; }
  set content(value: string) { this.setAttribute('content', value); }
  get description(): string { return this.getAttribute('description') ?? ''; }
  set description(value: string) { this.setAttribute('description', value); }
  get confirmLoading(): boolean { return this.hasAttribute('confirm-loading'); }
  set confirmLoading(value: boolean) { this.toggleAttribute('confirm-loading', value); }
  get confirmDisabled(): boolean { return this.hasAttribute('confirm-disabled'); }
  set confirmDisabled(value: boolean) { this.toggleAttribute('confirm-disabled', value); }
  get okText(): string { return this.getAttribute('ok-text') ?? 'Confirm'; }
  set okText(value: string) { this.setAttribute('ok-text', value); }
  get cancelText(): string { return this.getAttribute('cancel-text') ?? 'Cancel'; }
  set cancelText(value: string) { this.setAttribute('cancel-text', value); }
  show(): void { this.open = true; }
  hide(): void { this.open = false; }
  confirm(): boolean { return this._act('confirm', 'api'); }
  cancel(): boolean { return this._act('cancel', 'api'); }

  private _setOpen(open: boolean, reason: HYPopoverCloseReason): void {
    if ((open && this.disabled) || this.open === open) return;
    this._clearTimer(); this._reason = reason; this.toggleAttribute('open', open);
  }
  private _sync = (): void => {
    if (this.disabled && this.open) { this._reflecting = true; this.removeAttribute('open'); this._reflecting = false; }
    this._headingText.textContent = this.heading;
    this._headingSlot.hidden = !this.heading && !this._headingSlot.assignedNodes().length;
    this._description.textContent = this.description; this._description.hidden = !this.description;
    this._contentSlot.textContent = this.content;
    this._panel.setAttribute('aria-label', this.getAttribute('aria-label') || this.heading || (this._confirmation ? 'Confirmation' : 'Popover'));
    this._confirm.textContent = this.confirmLoading ? `${this.okText}…` : this.okText;
    this._confirm.disabled = this.confirmLoading || this.confirmDisabled; this._cancel.textContent = this.cancelText; this._cancel.disabled = this.confirmLoading;
    this._panel.setAttribute('aria-busy', String(this.confirmLoading));
    if (this.isConnected && this.open && !this.disabled) this._showPanel(); else this._hidePanel(this.isConnected);
    this._syncTrigger();
  };
  private _showPanel(): void {
    if (!this._shown) {
      this._shown = true; this._returnFocus = deepestActive(this.ownerDocument); this._panel.hidden = false;
      if (this._panel.showPopover) this._panel.showPopover();
      this._emitOpen();
      if (this.trigger === 'click' || this.trigger === 'manual') queueMicrotask(() => {
        if (this._shown && this.isConnected) (this._confirmation ? this._cancel : firstFocusable(this._panel) ?? this._panel).focus({ preventScroll: true });
      });
    }
    this._position();
  }
  private _hidePanel(restoreFocus: boolean): void {
    if (!this._shown) return;
    const active = deepestActive(this.ownerDocument);
    const hadFocus = composedContains(this._panel, active) || this._focusInside && (!active || active === this.ownerDocument.body);
    this._shown = false; this._clearFocusTimer(); this._restoringFocus = true;
    try {
      if (this._panel.hidePopover && this._panel.matches(':popover-open')) this._panel.hidePopover(); this._panel.hidden = true;
      if (restoreFocus && hadFocus && this._returnFocus?.isConnected) this._returnFocus.focus({ preventScroll: true });
    } finally { this._restoringFocus = false; this._focusInside = false; }
    this._returnFocus = null;
    if (this.isConnected) this._emitOpen();
  }
  private _emitOpen(): void {
    const reason = this._reason; this._reason = 'api';
    this.dispatchEvent(new CustomEvent<HYPopoverOpenChangeDetail>('open-change', { detail: { open: this._shown, reason }, bubbles: true, composed: true }));
  }
  private _syncTrigger = (): void => {
    if (!this.isConnected) return;
    const nodes = this._triggerSlot.assignedElements({ flatten: true }).map(element => element.shadowRoot?.querySelector<HTMLElement>('button,input,[tabindex]') ?? element).filter((element): element is HTMLElement => element instanceof HTMLElement);
    for (const [node, attributes] of this._triggerAttributes) if (!nodes.includes(node)) { for (const [name, value] of attributes) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value); } this._triggerAttributes.delete(node); }
    for (const node of nodes) {
      if (!this._triggerAttributes.has(node)) this._triggerAttributes.set(node, new Map(['aria-expanded', 'aria-haspopup'].map(name => [name, node.getAttribute(name)])));
      node.setAttribute('aria-haspopup', 'dialog'); node.setAttribute('aria-expanded', String(this._shown));
    }
  };
  private _restoreTrigger(): void { for (const [node, attributes] of this._triggerAttributes) for (const [name, value] of attributes) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value); } this._triggerAttributes.clear(); }
  private _isTrigger(event: Event): boolean { return this._triggerSlot.assignedElements({ flatten: true }).some(element => event.composedPath().includes(element)); }
  private _onTriggerClick = (event: MouseEvent): void => { if (this.trigger === 'click' && this._isTrigger(event) && !event.defaultPrevented && !this.confirmLoading) this._setOpen(!this.open, 'trigger'); };
  private _onKeydown = (event: KeyboardEvent): void => { if (event.key === 'Escape' && this._shown && !event.defaultPrevented && !this.confirmLoading) { event.preventDefault(); event.stopPropagation(); this._setOpen(false, 'escape'); } };
  private _onOutside = (event: PointerEvent): void => { if (this._shown && !event.composedPath().includes(this) && !this.confirmLoading) this._setOpen(false, 'outside'); };
  private _onScroll = (event: Event): void => { if (!event.composedPath().includes(this._panel)) this._position(); };
  private _onFocusIn = (event: FocusEvent): void => {
    this._clearFocusTimer();
    if (composedContains(this._panel, event.composedPath()[0] as Node)) this._focusInside = true;
    if (!this._restoringFocus && this._isTrigger(event) && (this.trigger === 'focus' || this.trigger === 'hover')) this._setOpen(true, 'trigger');
  };
  private _onFocusOut = (event: FocusEvent): void => {
    if (!this._shown || event.relatedTarget instanceof Node && composedContains(this, event.relatedTarget)) return;
    this._clearFocusTimer();
    // Native focus transitions can perform a microtask checkpoint between blur and focus.
    this._focusTimer = setTimeout(() => { this._focusTimer = null; if (this.isConnected && this._shown && !composedContains(this, deepestActive(this.ownerDocument)) && !this.confirmLoading) this._setOpen(false, 'blur'); }, 0);
  };
  private _onEnter = (): void => { if (this.trigger === 'hover') this._schedule(true); };
  private _onLeave = (): void => { if (this.trigger === 'hover' && !composedContains(this, deepestActive(this.ownerDocument))) this._schedule(false); };
  private _schedule(open: boolean): void { this._clearTimer(); const raw = Number(this.getAttribute(open ? 'show-delay' : 'hide-delay') ?? (open ? 100 : 150)); const delay = Number.isFinite(raw) ? Math.max(0, Math.min(raw, 60000)) : 0; this._timer = setTimeout(() => { this._timer = null; if (this.isConnected) this._setOpen(open, 'trigger'); }, delay); }
  private _clearTimer(): void { if (this._timer !== null) clearTimeout(this._timer); this._timer = null; }
  private _clearFocusTimer(): void { if (this._focusTimer !== null) clearTimeout(this._focusTimer); this._focusTimer = null; }
  private _act(action: 'confirm' | 'cancel', source: 'button' | 'api'): boolean {
    if (!this._confirmation || !this._shown || this.disabled || this.confirmLoading || (action === 'confirm' && this.confirmDisabled)) return false;
    if (!this.dispatchEvent(new CustomEvent<HYPopconfirmActionDetail>(action, { detail: { source }, bubbles: true, composed: true, cancelable: true }))) return false;
    this._setOpen(false, action); return true;
  }
  private _position = (): void => {
    if (!this._shown || !this.isConnected) return;
    const anchor = this._triggerSlot.assignedElements({ flatten: true })[0]; const view = this.ownerDocument.defaultView; if (!anchor || !view) return;
    const rect = anchor.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > view.innerHeight || rect.right < 0 || rect.left > view.innerWidth) { this._setOpen(false, 'outside'); return; }
    const panel = this._panel.getBoundingClientRect(); const [preferred, alignment] = this.placement.split('-'); let side = preferred;
    if (side === 'top' && rect.top < panel.height + 16 && view.innerHeight - rect.bottom > rect.top) side = 'bottom';
    else if (side === 'bottom' && view.innerHeight - rect.bottom < panel.height + 16 && rect.top > view.innerHeight - rect.bottom) side = 'top';
    else if (side === 'left' && rect.left < panel.width + 16 && view.innerWidth - rect.right > rect.left) side = 'right';
    else if (side === 'right' && view.innerWidth - rect.right < panel.width + 16 && rect.left > view.innerWidth - rect.right) side = 'left';
    let left = rect.left + (rect.width - panel.width) / 2; let top = rect.top + (rect.height - panel.height) / 2;
    if (side === 'top' || side === 'bottom') { top = side === 'top' ? rect.top - panel.height - 8 : rect.bottom + 8; if (alignment === 'start') left = rect.left; else if (alignment === 'end') left = rect.right - panel.width; }
    else { left = side === 'left' ? rect.left - panel.width - 8 : rect.right + 8; if (alignment === 'start') top = rect.top; else if (alignment === 'end') top = rect.bottom - panel.height; }
    this._panel.style.left = `${Math.max(8, Math.min(left, view.innerWidth - panel.width - 8))}px`;
    this._panel.style.top = `${Math.max(8, Math.min(top, view.innerHeight - panel.height - 8))}px`;
  };
}
