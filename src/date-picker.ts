export interface HYDatePickerChangeDetail {
  readonly value: string;
  readonly date: Date | null;
}

export interface HYDatePickerOpenChangeDetail {
  readonly open: boolean;
}

function parseISODate(value: unknown): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(value ?? ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function toISODate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addCalendarMonths(date: Date, amount: number): Date {
  const first = addMonths(date, amount);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Accessible calendar date picker with stable ISO values. */
export class HYDatePicker extends HTMLElement {
  private readonly _control = document.createElement('div');
  private readonly _trigger = document.createElement('button');
  private readonly _label = document.createElement('span');
  private readonly _arrow = document.createElement('span');
  private readonly _clear = document.createElement('button');
  private readonly _panel = document.createElement('div');
  private readonly _panelId = `hy-date-picker-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  private _value = '';
  private _viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  private _reflecting = false;
  private _outsideAbort: AbortController | null = null;

  static get observedAttributes(): string[] {
    return ['value', 'min', 'max', 'placeholder', 'disabled', 'clearable', 'open', 'locale', 'week-start', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { position: relative; display: inline-block; min-width: 180px; color: var(--hy-text-color, #eef3ff); font: 12px/1.4 system-ui, sans-serif; }
      .control { display: grid; grid-template-columns: minmax(0, 1fr) auto; height: var(--hy-date-picker-height, 34px); box-sizing: border-box; border: 1px solid var(--hy-border-color, #3d4654); border-radius: var(--hy-date-picker-radius, 6px); background: var(--hy-input-bg-color, #111722); }
      :host(:not([disabled])) .control:hover { border-color: var(--hy-hover-border-color, #596779); }
      :host(:focus-within) .control, :host([open]) .control { border-color: var(--hy-focus-border-color, #79a8ff); box-shadow: 0 0 0 2px var(--hy-focus-ring-color, rgba(121, 168, 255, 0.22)); }
      .trigger { display: flex; align-items: center; min-width: 0; gap: 8px; padding: 0 8px 0 10px; overflow: hidden; border: 0; color: inherit; background: transparent; cursor: pointer; font: inherit; text-align: left; }
      .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .label.placeholder { color: var(--hy-muted-color, #788697); }
      .arrow { flex: 0 0 auto; color: var(--hy-muted-color, #788697); font-size: 14px; }
      .clear { width: 28px; padding: 0; border: 0; color: var(--hy-muted-color, #788697); background: transparent; cursor: pointer; font: 15px/1 system-ui, sans-serif; }
      .clear:hover { color: var(--hy-text-color, #eef3ff); }
      .clear[hidden] { display: none; }
      .trigger:focus-visible, .clear:focus-visible { outline: none; }
      :host([disabled]) { opacity: 0.52; }
      :host([disabled]) .trigger, :host([disabled]) .clear { cursor: not-allowed; }
      .panel { position: absolute; z-index: var(--hy-date-picker-z-index, 50); top: calc(100% + 6px); left: 0; width: var(--hy-date-picker-panel-width, 286px); box-sizing: border-box; padding: 10px; border: 1px solid var(--hy-border-color, #3d4654); border-radius: var(--hy-date-picker-panel-radius, 8px); background: var(--hy-menu-bg-color, var(--hy-surface-elevated-color, #171d27)); box-shadow: 0 12px 32px var(--hy-menu-shadow-color, rgba(0, 0, 0, 0.36)); }
      .panel[hidden] { display: none; }
      .calendar-header { display: grid; grid-template-columns: 30px 1fr 30px; align-items: center; margin-bottom: 7px; }
      .month-label { color: var(--hy-text-color, #eef3ff); font-weight: 650; text-align: center; }
      .month-button, .footer button { height: 28px; border: 1px solid transparent; border-radius: 4px; color: var(--hy-secondary-text-color, #aebbd0); background: transparent; cursor: pointer; font: inherit; }
      .month-button:hover:not(:disabled), .footer button:hover:not(:disabled) { color: var(--hy-accent-color, #79a8ff); background: var(--hy-hover-bg-color, #273241); }
      .month-button:focus-visible, .footer button:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 1px; }
      .month-button:disabled, .footer button:disabled { cursor: not-allowed; opacity: 0.35; }
      .weekdays, .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
      .weekday { padding: 4px 0; color: var(--hy-muted-color, #788697); font-size: 10px; text-align: center; }
      .day { position: relative; width: 100%; aspect-ratio: 1; min-height: 31px; padding: 0; border: 1px solid transparent; border-radius: var(--hy-date-picker-day-radius, 50%); color: var(--hy-secondary-text-color, #aebbd0); background: transparent; cursor: pointer; font: inherit; }
      .day:hover:not(:disabled), .day:focus-visible { outline: none; color: var(--hy-text-color, #eef3ff); border-color: var(--hy-hover-border-color, #596779); background: var(--hy-hover-bg-color, #273241); }
      .day.outside { color: var(--hy-muted-color, #788697); opacity: 0.6; }
      .day.today::after { position: absolute; right: 50%; bottom: 3px; width: 3px; height: 3px; border-radius: 50%; background: var(--hy-accent-color, #79a8ff); content: ''; transform: translateX(50%); }
      .day[aria-selected="true"] { color: var(--hy-selected-text-color, #fff); border-color: var(--hy-selected-bg-color, #554cc6); background: var(--hy-selected-bg-color, #554cc6); }
      .day:disabled { cursor: not-allowed; opacity: 0.24; }
      .footer { display: flex; justify-content: flex-end; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--hy-border-color, #3d4654); }
      .footer button { padding: 0 9px; color: var(--hy-accent-color, #79a8ff); }
    `;
    this._control.className = 'control'; this._control.part.add('control');
    this._trigger.type = 'button'; this._trigger.className = 'trigger'; this._trigger.part.add('trigger');
    this._trigger.setAttribute('aria-haspopup', 'dialog'); this._trigger.setAttribute('aria-controls', this._panelId);
    this._label.className = 'label'; this._label.part.add('label');
    this._arrow.className = 'arrow'; this._arrow.part.add('arrow'); this._arrow.setAttribute('aria-hidden', 'true'); this._arrow.textContent = '▣';
    this._trigger.append(this._label, this._arrow);
    this._clear.type = 'button'; this._clear.className = 'clear'; this._clear.part.add('clear'); this._clear.setAttribute('aria-label', 'Clear date'); this._clear.textContent = '×';
    this._panel.id = this._panelId; this._panel.className = 'panel'; this._panel.part.add('panel'); this._panel.setAttribute('role', 'dialog');
    this._control.append(this._trigger, this._clear);
    root.append(style, this._control, this._panel);
    this._trigger.addEventListener('click', () => { if (!this.disabled) this.open = !this.open; });
    this._trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' && !this.disabled) {
        event.preventDefault(); this.open = true; queueMicrotask(() => this._focusPreferredDate());
      } else if (event.key === 'Escape' && this.open) { event.preventDefault(); this.open = false; }
    });
    this._clear.addEventListener('click', event => { event.stopPropagation(); if (!this.disabled) this._commit(''); });
  }

  connectedCallback(): void { this._syncAttributes(); this._render(); this._syncOutsideListener(); }
  disconnectedCallback(): void { this._outsideAbort?.abort(); this._outsideAbort = null; }
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || this._reflecting) return;
    if (name === 'value' || name === 'min' || name === 'max') { this._value = this._normalizeValue(this.getAttribute('value') ?? ''); this._reflectValue(); }
    if (name === 'open' && this.open) this._setViewFromValue();
    this._render();
    if (name === 'open') { this._syncOutsideListener(); this._dispatchOpenChange(); }
  }

  get value(): string { return this._value; }
  set value(value: string) { this._value = this._normalizeValue(value); this._reflectValue(); this._render(); }
  get open(): boolean { return this.hasAttribute('open'); }
  set open(value: boolean) { this.toggleAttribute('open', Boolean(value)); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }
  get clearable(): boolean { return this.getAttribute('clearable') !== 'false'; }
  set clearable(value: boolean) { this.setAttribute('clearable', String(Boolean(value))); }
  get placeholder(): string { return this.getAttribute('placeholder') ?? 'Select date'; }
  set placeholder(value: string) { this.setAttribute('placeholder', String(value)); }
  get min(): string { return parseISODate(this.getAttribute('min')) ? this.getAttribute('min')! : ''; }
  set min(value: string) { if (parseISODate(value)) this.setAttribute('min', value); else this.removeAttribute('min'); }
  get max(): string { return parseISODate(this.getAttribute('max')) ? this.getAttribute('max')! : ''; }
  set max(value: string) { if (parseISODate(value)) this.setAttribute('max', value); else this.removeAttribute('max'); }
  get locale(): string { return this.getAttribute('locale') || document.documentElement.lang || navigator.language; }
  set locale(value: string) { this.setAttribute('locale', String(value)); }
  get weekStart(): 0 | 1 { return this.getAttribute('week-start') === '0' ? 0 : 1; }
  set weekStart(value: 0 | 1) { this.setAttribute('week-start', value === 0 ? '0' : '1'); }

  private _syncAttributes(): void { this._value = this._normalizeValue(this.getAttribute('value') ?? ''); this._reflectValue(); if (this.open) this._setViewFromValue(); }
  private _normalizeValue(value: unknown): string {
    const date = parseISODate(value); if (!date) return '';
    const iso = toISODate(date); return this._isAllowed(iso) ? iso : '';
  }
  private _reflectValue(): void {
    if (this.getAttribute('value') === this._value) return;
    this._reflecting = true; if (this._value) this.setAttribute('value', this._value); else this.removeAttribute('value'); this._reflecting = false;
  }
  private _isAllowed(value: string): boolean { return (!this.min || value >= this.min) && (!this.max || value <= this.max); }
  private _setViewFromValue(): void {
    const selected = parseISODate(this._value); const today = new Date(); const source = selected ?? today;
    this._viewDate = new Date(source.getFullYear(), source.getMonth(), 1);
  }
  private _formatDate(value: string): string {
    const date = parseISODate(value); if (!date) return '';
    return new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }
  private _render(): void {
    const text = this._formatDate(this._value); this._label.textContent = text || this.placeholder; this._label.classList.toggle('placeholder', !text);
    this._trigger.disabled = this.disabled; this._trigger.setAttribute('aria-expanded', String(this.open));
    const name = this.getAttribute('aria-label'); if (name) this._trigger.setAttribute('aria-label', name); else this._trigger.removeAttribute('aria-label');
    this._clear.hidden = !this.clearable || !this._value; this._clear.disabled = this.disabled; this._panel.hidden = !this.open;
    if (this.open) this._renderPanel(); else this._panel.replaceChildren();
  }
  private _renderPanel(): void {
    const header = document.createElement('div'); header.className = 'calendar-header'; header.part.add('header');
    const previous = this._monthButton('‹', 'Previous month', -1); const next = this._monthButton('›', 'Next month', 1);
    const month = document.createElement('div'); month.className = 'month-label'; month.part.add('month-label'); month.setAttribute('aria-live', 'polite');
    month.textContent = new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'long' }).format(this._viewDate);
    header.append(previous, month, next);
    const weekdays = document.createElement('div'); weekdays.className = 'weekdays'; weekdays.part.add('weekdays');
    const sunday = new Date(2024, 0, 7);
    for (let index = 0; index < 7; index += 1) {
      const element = document.createElement('span'); element.className = 'weekday'; element.part.add('weekday');
      element.textContent = new Intl.DateTimeFormat(this.locale, { weekday: 'short' }).format(addDays(sunday, (index + this.weekStart) % 7)); weekdays.append(element);
    }
    const days = document.createElement('div'); days.className = 'days'; days.part.add('days'); days.setAttribute('role', 'grid');
    const first = new Date(this._viewDate.getFullYear(), this._viewDate.getMonth(), 1);
    const offset = (first.getDay() - this.weekStart + 7) % 7; const start = addDays(first, -offset); const today = toISODate(new Date());
    for (let index = 0; index < 42; index += 1) {
      const date = addDays(start, index); const iso = toISODate(date); const button = document.createElement('button');
      button.type = 'button'; button.className = 'day'; button.part.add('day'); button.dataset.date = iso; button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', new Intl.DateTimeFormat(this.locale, { dateStyle: 'full' }).format(date)); button.setAttribute('aria-selected', String(iso === this._value));
      button.textContent = String(date.getDate()); button.disabled = !this._isAllowed(iso); button.classList.toggle('outside', date.getMonth() !== this._viewDate.getMonth()); button.classList.toggle('today', iso === today);
      button.addEventListener('click', () => this._commit(iso)); button.addEventListener('keydown', event => this._handleDayKeydown(event, date)); days.append(button);
    }
    const footer = document.createElement('div'); footer.className = 'footer'; footer.part.add('footer'); const todayButton = document.createElement('button');
    todayButton.type = 'button'; todayButton.textContent = 'Today'; todayButton.disabled = !this._isAllowed(today); todayButton.addEventListener('click', () => this._commit(today)); footer.append(todayButton);
    this._panel.replaceChildren(header, weekdays, days, footer);
  }
  private _monthButton(text: string, label: string, direction: -1 | 1): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'month-button'; button.part.add(direction < 0 ? 'previous' : 'next'); button.textContent = text; button.setAttribute('aria-label', label);
    const candidate = addMonths(this._viewDate, direction); const first = toISODate(candidate); const last = toISODate(new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0)); button.disabled = Boolean((this.min && last < this.min) || (this.max && first > this.max));
    button.addEventListener('click', () => { this._viewDate = candidate; this._renderPanel(); }); return button;
  }
  private _handleDayKeydown(event: KeyboardEvent, date: Date): void {
    let target: Date | null = null;
    if (event.key === 'ArrowLeft') target = addDays(date, -1); else if (event.key === 'ArrowRight') target = addDays(date, 1); else if (event.key === 'ArrowUp') target = addDays(date, -7); else if (event.key === 'ArrowDown') target = addDays(date, 7);
    else if (event.key === 'Home') target = addDays(date, -(date.getDay() - this.weekStart + 7) % 7); else if (event.key === 'End') target = addDays(date, 6 - (date.getDay() - this.weekStart + 7) % 7);
    else if (event.key === 'PageUp') target = addCalendarMonths(date, -1); else if (event.key === 'PageDown') target = addCalendarMonths(date, 1); else if (event.key === 'Escape') { event.preventDefault(); this.open = false; this._trigger.focus(); return; }
    if (!target) return; event.preventDefault(); if (!this._isAllowed(toISODate(target))) return; this._focusDate(target);
  }
  private _focusDate(date: Date): void {
    if (date.getMonth() !== this._viewDate.getMonth() || date.getFullYear() !== this._viewDate.getFullYear()) { this._viewDate = new Date(date.getFullYear(), date.getMonth(), 1); this._renderPanel(); }
    queueMicrotask(() => this._panel.querySelector<HTMLButtonElement>(`.day[data-date="${toISODate(date)}"]`)?.focus());
  }
  private _focusPreferredDate(): void { const preferred = parseISODate(this._value) ?? new Date(); if (this._isAllowed(toISODate(preferred))) this._focusDate(preferred); else this._panel.querySelector<HTMLButtonElement>('.day:not(:disabled)')?.focus(); }
  private _commit(value: string): void {
    this._value = this._normalizeValue(value); this._reflectValue(); if (this.open) this.open = false; else this._render();
    this.dispatchEvent(new CustomEvent<HYDatePickerChangeDetail>('value-change', { bubbles: true, composed: true, detail: { value: this._value, date: parseISODate(this._value) } }));
  }
  private _syncOutsideListener(): void {
    this._outsideAbort?.abort(); this._outsideAbort = null; if (!this.open || !this.isConnected) return; const abort = new AbortController(); this._outsideAbort = abort;
    queueMicrotask(() => { if (!abort.signal.aborted) document.addEventListener('pointerdown', event => { if (!event.composedPath().includes(this)) this.open = false; }, { capture: true, signal: abort.signal }); });
  }
  private _dispatchOpenChange(): void { this.dispatchEvent(new CustomEvent<HYDatePickerOpenChangeDetail>('open-change', { bubbles: true, composed: true, detail: { open: this.open } })); }
}

export function defineDatePickerComponents(): void {
  if (!customElements.get('hy-date-picker')) customElements.define('hy-date-picker', HYDatePicker);
}
