export interface HYTimePickerChangeDetail {
  readonly value: string;
  readonly hour: number | null;
  readonly minute: number | null;
  readonly second: number | null;
}

export interface HYTimePickerOpenChangeDetail {
  readonly open: boolean;
}

interface TimeParts { hour: number; minute: number; second: number; }

function parseTime(value: unknown): TimeParts | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(String(value ?? ''));
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]); const second = Number(match[3] ?? 0);
  return hour < 24 && minute < 60 && second < 60 ? { hour, minute, second } : null;
}

function pad(value: number): string { return String(value).padStart(2, '0'); }

function formatTime(parts: TimeParts, showSeconds: boolean): string {
  return `${pad(parts.hour)}:${pad(parts.minute)}${showSeconds ? `:${pad(parts.second)}` : ''}`;
}

function timeNumber(parts: TimeParts): number { return parts.hour * 3600 + parts.minute * 60 + parts.second; }

function normalizeStep(value: unknown): number {
  const number = Math.floor(Number(value)); return Number.isFinite(number) && number > 0 && number < 60 ? number : 1;
}

/** Accessible column-based time picker with stable 24-hour values. */
export class HYTimePicker extends HTMLElement {
  private readonly _control = document.createElement('div');
  private readonly _trigger = document.createElement('button');
  private readonly _label = document.createElement('span');
  private readonly _arrow = document.createElement('span');
  private readonly _clear = document.createElement('button');
  private readonly _panel = document.createElement('div');
  private readonly _panelId = `hy-time-picker-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  private _value = '';
  private _draft: TimeParts = { hour: 0, minute: 0, second: 0 };
  private _reflecting = false;
  private _outsideAbort: AbortController | null = null;

  static get observedAttributes(): string[] {
    return ['value', 'min', 'max', 'placeholder', 'disabled', 'clearable', 'open', 'show-seconds', 'minute-step', 'second-step', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { position: relative; display: inline-block; min-width: 150px; color: var(--hy-text-color, #eef3ff); font: 12px/1.4 system-ui, sans-serif; }
      .control { display: grid; grid-template-columns: minmax(0, 1fr) auto; height: var(--hy-time-picker-height, 34px); box-sizing: border-box; border: 1px solid var(--hy-border-color, #3d4654); border-radius: var(--hy-time-picker-radius, 6px); background: var(--hy-input-bg-color, #111722); }
      :host(:not([disabled])) .control:hover { border-color: var(--hy-hover-border-color, #596779); }
      :host(:focus-within) .control, :host([open]) .control { border-color: var(--hy-focus-border-color, #79a8ff); box-shadow: 0 0 0 2px var(--hy-focus-ring-color, rgba(121, 168, 255, .22)); }
      .trigger { display: flex; min-width: 0; align-items: center; gap: 8px; padding: 0 8px 0 10px; overflow: hidden; border: 0; color: inherit; background: transparent; cursor: pointer; font: inherit; text-align: left; }
      .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .label.placeholder { color: var(--hy-muted-color, #788697); }
      .arrow { color: var(--hy-muted-color, #788697); font-size: 14px; }
      .clear { width: 28px; padding: 0; border: 0; color: var(--hy-muted-color, #788697); background: transparent; cursor: pointer; font: 15px/1 system-ui, sans-serif; }
      .clear:hover { color: var(--hy-text-color, #eef3ff); } .clear[hidden], .panel[hidden] { display: none; }
      .trigger:focus-visible, .clear:focus-visible { outline: none; }
      :host([disabled]) { opacity: .52; } :host([disabled]) .trigger, :host([disabled]) .clear { cursor: not-allowed; }
      .panel { position: absolute; z-index: var(--hy-time-picker-z-index, 50); top: calc(100% + 6px); left: 0; width: max-content; min-width: 100%; box-sizing: border-box; border: 1px solid var(--hy-border-color, #3d4654); border-radius: var(--hy-time-picker-panel-radius, 8px); background: var(--hy-menu-bg-color, var(--hy-surface-elevated-color, #171d27)); box-shadow: 0 12px 32px var(--hy-menu-shadow-color, rgba(0, 0, 0, .36)); }
      .columns { display: flex; height: var(--hy-time-picker-panel-height, 196px); overflow: hidden; }
      .column { width: var(--hy-time-picker-column-width, 58px); margin: 0; padding: 4px; overflow-y: auto; list-style: none; scrollbar-color: var(--hy-border-strong-color, #596779) transparent; scrollbar-width: thin; }
      .column + .column { border-left: 1px solid var(--hy-border-color, #3d4654); }
      .option { width: 100%; height: 30px; padding: 0; border: 0; border-radius: 4px; color: var(--hy-secondary-text-color, #aebbd0); background: transparent; cursor: pointer; font: inherit; }
      .option:hover, .option:focus-visible { outline: none; color: var(--hy-text-color, #eef3ff); background: var(--hy-hover-bg-color, #273241); }
      .option[aria-selected="true"] { color: var(--hy-selected-text-color, #fff); background: var(--hy-selected-bg-color, #554cc6); }
      .footer { display: flex; justify-content: space-between; gap: 8px; padding: 7px 8px; border-top: 1px solid var(--hy-border-color, #3d4654); }
      .footer button { min-width: 42px; height: 27px; padding: 0 8px; border: 1px solid transparent; border-radius: 4px; color: var(--hy-accent-color, #79a8ff); background: transparent; cursor: pointer; font: inherit; }
      .footer button:hover:not(:disabled) { background: var(--hy-hover-bg-color, #273241); }
      .footer .confirm { color: var(--hy-selected-text-color, #fff); background: var(--hy-selected-bg-color, #554cc6); }
      .footer button:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 1px; }
      .footer button:disabled { cursor: not-allowed; opacity: .35; }
    `;
    this._control.className = 'control'; this._control.part.add('control');
    this._trigger.type = 'button'; this._trigger.className = 'trigger'; this._trigger.part.add('trigger'); this._trigger.setAttribute('aria-haspopup', 'dialog'); this._trigger.setAttribute('aria-controls', this._panelId);
    this._label.className = 'label'; this._label.part.add('label'); this._arrow.className = 'arrow'; this._arrow.part.add('arrow'); this._arrow.setAttribute('aria-hidden', 'true'); this._arrow.textContent = '◷'; this._trigger.append(this._label, this._arrow);
    this._clear.type = 'button'; this._clear.className = 'clear'; this._clear.part.add('clear'); this._clear.setAttribute('aria-label', 'Clear time'); this._clear.textContent = '×';
    this._panel.id = this._panelId; this._panel.className = 'panel'; this._panel.part.add('panel'); this._panel.setAttribute('role', 'dialog'); this._control.append(this._trigger, this._clear); root.append(style, this._control, this._panel);
    this._trigger.addEventListener('click', () => { if (!this.disabled) this.open = !this.open; });
    this._trigger.addEventListener('keydown', event => { if (event.key === 'ArrowDown' && !this.disabled) { event.preventDefault(); this.open = true; queueMicrotask(() => this._focusSelected(0)); } else if (event.key === 'Escape' && this.open) { event.preventDefault(); this.open = false; } });
    this._clear.addEventListener('click', event => { event.stopPropagation(); if (!this.disabled) this._commit(''); });
  }

  connectedCallback(): void { this._syncAttributes(); this._render(); this._syncOutsideListener(); }
  disconnectedCallback(): void { this._outsideAbort?.abort(); this._outsideAbort = null; }
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || this._reflecting) return;
    if (['value', 'min', 'max', 'show-seconds', 'minute-step', 'second-step'].includes(name)) { this._value = this._normalizeValue(this.getAttribute('value') ?? ''); this._reflectValue(); }
    if (name === 'open' && this.open) this._setDraft(); this._render();
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
  get placeholder(): string { return this.getAttribute('placeholder') ?? 'Select time'; }
  set placeholder(value: string) { this.setAttribute('placeholder', String(value)); }
  get showSeconds(): boolean { return this.hasAttribute('show-seconds'); }
  set showSeconds(value: boolean) { this.toggleAttribute('show-seconds', Boolean(value)); }
  get minuteStep(): number { return normalizeStep(this.getAttribute('minute-step')); }
  set minuteStep(value: number) { this.setAttribute('minute-step', String(normalizeStep(value))); }
  get secondStep(): number { return normalizeStep(this.getAttribute('second-step')); }
  set secondStep(value: number) { this.setAttribute('second-step', String(normalizeStep(value))); }
  get min(): string { return parseTime(this.getAttribute('min')) ? this.getAttribute('min')! : ''; }
  set min(value: string) { if (parseTime(value)) this.setAttribute('min', value); else this.removeAttribute('min'); }
  get max(): string { return parseTime(this.getAttribute('max')) ? this.getAttribute('max')! : ''; }
  set max(value: string) { if (parseTime(value)) this.setAttribute('max', value); else this.removeAttribute('max'); }

  private _syncAttributes(): void { this._value = this._normalizeValue(this.getAttribute('value') ?? ''); this._reflectValue(); this._setDraft(); }
  private _normalizeValue(value: unknown): string {
    const parts = parseTime(value); if (!parts) return ''; const normalized = formatTime(parts, this.showSeconds); return this._isAllowed(parts) ? normalized : '';
  }
  private _reflectValue(): void { if (this.getAttribute('value') === this._value) return; this._reflecting = true; if (this._value) this.setAttribute('value', this._value); else this.removeAttribute('value'); this._reflecting = false; }
  private _isAllowed(parts: TimeParts): boolean { const value = timeNumber(parts); const min = parseTime(this.min); const max = parseTime(this.max); return (!min || value >= timeNumber(min)) && (!max || value <= timeNumber(max)); }
  private _setDraft(): void {
    const selected = parseTime(this._value); if (selected) { this._draft = selected; return; }
    const now = new Date(); this._draft = { hour: now.getHours(), minute: Math.floor(now.getMinutes() / this.minuteStep) * this.minuteStep, second: Math.floor(now.getSeconds() / this.secondStep) * this.secondStep };
  }
  private _render(): void {
    this._label.textContent = this._value || this.placeholder; this._label.classList.toggle('placeholder', !this._value); this._trigger.disabled = this.disabled; this._trigger.setAttribute('aria-expanded', String(this.open));
    const name = this.getAttribute('aria-label'); if (name) this._trigger.setAttribute('aria-label', name); else this._trigger.removeAttribute('aria-label');
    this._clear.hidden = !this.clearable || !this._value; this._clear.disabled = this.disabled; this._panel.hidden = !this.open; if (this.open) this._renderPanel(); else this._panel.replaceChildren();
  }
  private _renderPanel(): void {
    const columns = document.createElement('div'); columns.className = 'columns'; columns.part.add('columns');
    columns.append(this._createColumn('hour', 24, 1, this._draft.hour, 0), this._createColumn('minute', 60, this.minuteStep, this._draft.minute, 1));
    if (this.showSeconds) columns.append(this._createColumn('second', 60, this.secondStep, this._draft.second, 2));
    const footer = document.createElement('div'); footer.className = 'footer'; footer.part.add('footer'); const now = document.createElement('button'); const confirm = document.createElement('button');
    now.type = confirm.type = 'button'; now.textContent = 'Now'; confirm.textContent = 'OK'; confirm.className = 'confirm'; confirm.part.add('confirm'); confirm.disabled = !this._isAllowed(this._draft);
    now.addEventListener('click', () => { const date = new Date(); const parts = { hour: date.getHours(), minute: Math.floor(date.getMinutes() / this.minuteStep) * this.minuteStep, second: Math.floor(date.getSeconds() / this.secondStep) * this.secondStep }; if (this._isAllowed(parts)) this._commit(formatTime(parts, this.showSeconds)); });
    now.disabled = !this._isAllowed({ hour: new Date().getHours(), minute: new Date().getMinutes(), second: new Date().getSeconds() }); confirm.addEventListener('click', () => this._commit(formatTime(this._draft, this.showSeconds))); footer.append(now, confirm); this._panel.replaceChildren(columns, footer);
  }
  private _createColumn(part: keyof TimeParts, limit: number, step: number, selected: number, columnIndex: number): HTMLUListElement {
    const list = document.createElement('ul'); list.className = 'column'; list.part.add('column'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', part);
    for (let value = 0; value < limit; value += step) { const item = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.className = 'option'; button.part.add('option'); button.textContent = pad(value); button.dataset.column = String(columnIndex); button.dataset.value = String(value); button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(value === selected)); button.tabIndex = value === selected ? 0 : -1; button.addEventListener('click', () => { this._draft = { ...this._draft, [part]: value }; this._renderPanel(); queueMicrotask(() => this._focusSelected(columnIndex)); }); button.addEventListener('keydown', event => this._handleOptionKeydown(event, columnIndex)); item.append(button); list.append(item); }
    queueMicrotask(() => list.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })); return list;
  }
  private _handleOptionKeydown(event: KeyboardEvent, columnIndex: number): void {
    const columns = [...this._panel.querySelectorAll<HTMLElement>('.column')]; const column = columns[columnIndex]; if (!column) return; const options = [...column.querySelectorAll<HTMLButtonElement>('.option')]; const current = options.indexOf(event.currentTarget as HTMLButtonElement); let target: HTMLButtonElement | undefined;
    if (event.key === 'ArrowDown') target = options[(current + 1) % options.length]; else if (event.key === 'ArrowUp') target = options[(current - 1 + options.length) % options.length]; else if (event.key === 'Home') target = options[0]; else if (event.key === 'End') target = options.at(-1); else if (event.key === 'ArrowRight') { event.preventDefault(); this._focusSelected(Math.min(columnIndex + 1, columns.length - 1)); return; } else if (event.key === 'ArrowLeft') { event.preventDefault(); this._focusSelected(Math.max(columnIndex - 1, 0)); return; } else if (event.key === 'Escape') { event.preventDefault(); this.open = false; this._trigger.focus(); return; }
    if (target) { event.preventDefault(); target.focus(); }
  }
  private _focusSelected(columnIndex: number): void { this._panel.querySelectorAll<HTMLElement>('.column')[columnIndex]?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus(); }
  private _commit(value: string): void {
    this._value = this._normalizeValue(value); this._reflectValue(); if (this.open) this.open = false; else this._render(); const parts = parseTime(this._value);
    this.dispatchEvent(new CustomEvent<HYTimePickerChangeDetail>('value-change', { bubbles: true, composed: true, detail: { value: this._value, hour: parts?.hour ?? null, minute: parts?.minute ?? null, second: parts && this.showSeconds ? parts.second : null } }));
  }
  private _syncOutsideListener(): void { this._outsideAbort?.abort(); this._outsideAbort = null; if (!this.open || !this.isConnected) return; const abort = new AbortController(); this._outsideAbort = abort; queueMicrotask(() => { if (!abort.signal.aborted) document.addEventListener('pointerdown', event => { if (!event.composedPath().includes(this)) this.open = false; }, { capture: true, signal: abort.signal }); }); }
  private _dispatchOpenChange(): void { this.dispatchEvent(new CustomEvent<HYTimePickerOpenChangeDetail>('open-change', { bubbles: true, composed: true, detail: { open: this.open } })); }
}

export function defineTimePickerComponents(): void {
  if (!customElements.get('hy-time-picker')) customElements.define('hy-time-picker', HYTimePicker);
}
