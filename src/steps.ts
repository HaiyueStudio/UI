export type HYStepsDirection = 'horizontal' | 'vertical';
export type HYStepsSize = 'medium' | 'small';
export type HYStepStatus = 'wait' | 'process' | 'finish' | 'error';

export interface HYStepItem {
  readonly key?: string | number;
  readonly title: string;
  readonly description?: string;
  readonly subtitle?: string;
  readonly status?: HYStepStatus;
  readonly icon?: string;
  readonly disabled?: boolean;
}

export interface HYStepsChangeDetail {
  readonly current: number;
  readonly previous: number;
  readonly item: HYStepItem;
}

function finiteInteger(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const number = Math.floor(Number(value)); return Number.isFinite(number) ? number : fallback;
}

function normalizeItems(value: unknown): HYStepItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>; if (record.title == null) return [];
    const status = ['wait', 'process', 'finish', 'error'].includes(String(record.status)) ? String(record.status) as HYStepStatus : undefined;
    return [{
      title: String(record.title),
      ...(record.key != null && (typeof record.key === 'string' || typeof record.key === 'number') ? { key: record.key } : {}),
      ...(record.description != null ? { description: String(record.description) } : {}),
      ...(record.subtitle != null ? { subtitle: String(record.subtitle) } : {}),
      ...(record.icon != null ? { icon: String(record.icon) } : {}),
      ...(status ? { status } : {}),
      disabled: Boolean(record.disabled),
    }];
  });
}

/** Responsive horizontal or vertical progress steps with optional navigation. */
export class HYSteps extends HTMLElement {
  private readonly _list = document.createElement('ol');
  private _items: readonly HYStepItem[] = [];
  private _itemsAssigned = false;
  private _current = 0;

  static get observedAttributes(): string[] { return ['items', 'current', 'direction', 'size', 'clickable', 'aria-label']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #eef3ff); font: 12px/1.45 system-ui, sans-serif; }
      .steps { display: flex; width: 100%; margin: 0; padding: 0; list-style: none; }
      .item { position: relative; flex: 1 1 0; min-width: 0; text-align: center; }
      .step { display: flex; width: 100%; min-width: 0; flex-direction: column; align-items: center; padding: 0 10px; border: 0; color: inherit; background: transparent; font: inherit; text-align: center; }
      button.step { cursor: pointer; }
      button.step:hover .icon { transform: scale(1.08); }
      button.step:focus-visible { outline: none; }
      button.step:focus-visible .icon { box-shadow: 0 0 0 3px var(--hy-focus-ring-color, rgba(121, 168, 255, .22)); }
      button.step:disabled { cursor: not-allowed; opacity: .45; }
      .head { position: relative; z-index: 1; display: grid; place-items: center; }
      .icon { display: grid; width: var(--hy-steps-icon-size, 30px); height: var(--hy-steps-icon-size, 30px); box-sizing: border-box; place-items: center; border: 1px solid var(--_step-color, var(--hy-muted-color, #788697)); border-radius: 50%; color: var(--_step-color, var(--hy-muted-color, #788697)); background: var(--hy-surface-color, #111722); font-weight: 650; transition: transform 120ms ease, box-shadow 120ms ease; }
      .tail { position: absolute; z-index: 0; top: calc(var(--hy-steps-icon-size, 30px) / 2); right: calc(-50% + var(--hy-steps-icon-size, 30px) / 2 + 10px); left: calc(50% + var(--hy-steps-icon-size, 30px) / 2 + 10px); height: var(--hy-steps-line-width, 1px); background: var(--hy-steps-line-color, var(--hy-border-color, #3d4654)); }
      .item:last-child .tail { display: none; }
      .body { min-width: 0; margin-top: 9px; }
      .title-row { display: flex; min-width: 0; justify-content: center; gap: 6px; }
      .title { overflow: hidden; color: var(--hy-secondary-text-color, #aebbd0); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
      .subtitle { flex: 0 0 auto; color: var(--hy-muted-color, #788697); font-size: 10px; }
      .description { max-width: 30ch; margin: 4px auto 0; color: var(--hy-muted-color, #788697); font-size: 11px; }
      .status-finish { --_step-color: var(--hy-success-color, #4ade80); }
      .status-process { --_step-color: var(--hy-accent-color, #79a8ff); }
      .status-error { --_step-color: var(--hy-error-color, #fb7185); }
      .status-finish .tail { background: var(--hy-success-color, #4ade80); }
      .status-process .icon { color: var(--hy-selected-text-color, #fff); background: var(--_step-color); }
      .status-error .icon { color: var(--hy-selected-text-color, #fff); background: var(--_step-color); }
      .status-process .title, .status-finish .title, .status-error .title { color: var(--hy-text-color, #eef3ff); }
      :host([size="small"]) { --hy-steps-icon-size: 22px; }
      :host([size="small"]) .step { padding-inline: 7px; }
      :host([size="small"]) .body { margin-top: 6px; }
      :host([direction="vertical"]) .steps { flex-direction: column; }
      :host([direction="vertical"]) .item { flex: none; min-height: var(--hy-steps-vertical-item-height, 78px); text-align: left; }
      :host([direction="vertical"]) .step { display: grid; grid-template-columns: var(--hy-steps-icon-size, 30px) minmax(0, 1fr); align-items: start; gap: 12px; padding: 0 0 20px; text-align: left; }
      :host([direction="vertical"]) .head { grid-column: 1; grid-row: 1; }
      :host([direction="vertical"]) .body { grid-column: 2; grid-row: 1; margin-top: 4px; }
      :host([direction="vertical"]) .title-row { justify-content: flex-start; }
      :host([direction="vertical"]) .description { margin: 4px 0 0; }
      :host([direction="vertical"]) .tail { top: calc(var(--hy-steps-icon-size, 30px) + 5px); bottom: 5px; left: calc(var(--hy-steps-icon-size, 30px) / 2); width: var(--hy-steps-line-width, 1px); height: auto; }
      @media (prefers-reduced-motion: reduce) { .icon { transition: none; } }
    `;
    this._list.className = 'steps'; this._list.part.add('list'); root.append(style, this._list);
  }

  connectedCallback(): void {
    if (!this._itemsAssigned && this.hasAttribute('items')) this._readItemsAttribute();
    this._current = Math.max(0, finiteInteger(this.getAttribute('current'), 0)); this._render();
  }
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === 'items' && !this._itemsAssigned) this._readItemsAttribute();
    if (name === 'current') this._current = Math.max(0, finiteInteger(newValue, 0)); this._render();
  }

  get items(): readonly HYStepItem[] { return this._items; }
  set items(value: readonly HYStepItem[]) { this._itemsAssigned = true; this._items = normalizeItems(value); this._render(); }
  get current(): number { return this._resolvedCurrent(); }
  set current(value: number) { this._current = Math.max(0, finiteInteger(value, 0)); this.setAttribute('current', String(this._current)); this._render(); }
  get direction(): HYStepsDirection { return this.getAttribute('direction') === 'vertical' ? 'vertical' : 'horizontal'; }
  set direction(value: HYStepsDirection) { this.setAttribute('direction', value === 'vertical' ? 'vertical' : 'horizontal'); }
  get size(): HYStepsSize { return this.getAttribute('size') === 'small' ? 'small' : 'medium'; }
  set size(value: HYStepsSize) { this.setAttribute('size', value === 'small' ? 'small' : 'medium'); }
  get clickable(): boolean { return this.hasAttribute('clickable'); }
  set clickable(value: boolean) { this.toggleAttribute('clickable', Boolean(value)); }

  private _readItemsAttribute(): void {
    try { this._items = normalizeItems(JSON.parse(this.getAttribute('items') ?? '[]')); } catch { this._items = []; }
  }
  private _resolvedCurrent(): number { return this._items.length ? Math.min(this._items.length - 1, this._current) : 0; }
  private _status(item: HYStepItem, index: number): HYStepStatus {
    if (item.status) return item.status; const current = this._resolvedCurrent(); return index < current ? 'finish' : index === current ? 'process' : 'wait';
  }
  private _render(): void {
    if (!this.isConnected) return;
    const name = this.getAttribute('aria-label'); if (name) this._list.setAttribute('aria-label', name); else this._list.removeAttribute('aria-label');
    this._list.replaceChildren(...this._items.map((item, index) => this._createStep(item, index)));
  }
  private _createStep(item: HYStepItem, index: number): HTMLLIElement {
    const status = this._status(item, index); const listItem = document.createElement('li'); listItem.className = `item status-${status}`; listItem.part.add('item', `status-${status}`);
    const step = document.createElement(this.clickable ? 'button' : 'div'); step.className = 'step'; step.part.add('step');
    if (step instanceof HTMLButtonElement) { step.type = 'button'; step.disabled = Boolean(item.disabled); step.addEventListener('click', () => this._select(index, item)); }
    if (index === this._resolvedCurrent()) step.setAttribute('aria-current', 'step');
    const head = document.createElement('span'); head.className = 'head'; head.part.add('head'); const icon = document.createElement('span'); icon.className = 'icon'; icon.part.add('icon'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = item.icon || (status === 'finish' ? '✓' : status === 'error' ? '!' : String(index + 1)); head.append(icon);
    const tail = document.createElement('span'); tail.className = 'tail'; tail.part.add('tail'); tail.setAttribute('aria-hidden', 'true');
    const body = document.createElement('span'); body.className = 'body'; body.part.add('content'); const titleRow = document.createElement('span'); titleRow.className = 'title-row';
    const title = document.createElement('span'); title.className = 'title'; title.part.add('title'); title.textContent = item.title; titleRow.append(title);
    if (item.subtitle) { const subtitle = document.createElement('span'); subtitle.className = 'subtitle'; subtitle.part.add('subtitle'); subtitle.textContent = item.subtitle; titleRow.append(subtitle); }
    body.append(titleRow); if (item.description) { const description = document.createElement('span'); description.className = 'description'; description.part.add('description'); description.textContent = item.description; body.append(description); }
    step.append(head, body); listItem.append(step, tail); return listItem;
  }
  private _select(index: number, item: HYStepItem): void {
    if (!this.clickable || item.disabled) return; const previous = this._resolvedCurrent(); if (index === previous) return; this.current = index;
    this.dispatchEvent(new CustomEvent<HYStepsChangeDetail>('step-change', { bubbles: true, composed: true, detail: { current: index, previous, item } }));
  }
}

export function defineStepsComponents(): void {
  if (!customElements.get('hy-steps')) customElements.define('hy-steps', HYSteps);
}
