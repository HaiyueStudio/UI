export type HYCascaderValue = string | number;

export interface HYCascaderOption {
  readonly label: string;
  readonly value: HYCascaderValue;
  readonly disabled?: boolean;
  readonly children?: readonly HYCascaderOption[];
}

export interface HYCascaderChangeDetail {
  readonly value: readonly HYCascaderValue[];
  readonly options: readonly HYCascaderOption[];
}

export interface HYCascaderOpenChangeDetail {
  readonly open: boolean;
}

const PANEL_ID_PREFIX = 'hy-cascader-panel';

function sameValue(left: HYCascaderValue, right: HYCascaderValue): boolean {
  return left === right;
}

function normalizeOptions(value: unknown): HYCascaderOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (record.value == null || (typeof record.value !== 'string' && typeof record.value !== 'number')) return [];
    const children = normalizeOptions(record.children);
    return [{
      label: String(record.label ?? record.value),
      value: record.value,
      disabled: Boolean(record.disabled),
      ...(children.length ? { children } : {}),
    }];
  });
}

/** Tree-backed cascading dropdown that commits a complete value path. */
export class HYCascader extends HTMLElement {
  private readonly _control = document.createElement('div');
  private readonly _trigger = document.createElement('button');
  private readonly _label = document.createElement('span');
  private readonly _arrow = document.createElement('span');
  private readonly _clear = document.createElement('button');
  private readonly _panel = document.createElement('div');
  private readonly _panelId = `${PANEL_ID_PREFIX}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  private _options: readonly HYCascaderOption[] = [];
  private _value: readonly HYCascaderValue[] = [];
  private _activePath: readonly HYCascaderValue[] = [];
  private _reflecting = false;
  private _outsideAbort: AbortController | null = null;

  static get observedAttributes(): string[] {
    return ['options', 'value', 'placeholder', 'display-separator', 'disabled', 'clearable', 'change-on-select', 'open', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: relative;
        display: inline-block;
        min-width: 180px;
        color: var(--hy-text-color, #eef3ff);
        font: 12px/1.4 system-ui, sans-serif;
      }
      .control {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        min-width: 0;
        height: var(--hy-cascader-height, 34px);
        box-sizing: border-box;
        border: 1px solid var(--hy-border-color, #3d4654);
        border-radius: var(--hy-cascader-radius, 6px);
        background: var(--hy-input-bg-color, #111722);
      }
      :host(:not([disabled])) .control:hover { border-color: var(--hy-hover-border-color, #596779); }
      :host(:focus-within) .control, :host([open]) .control {
        border-color: var(--hy-focus-border-color, #79a8ff);
        box-shadow: 0 0 0 2px var(--hy-focus-ring-color, rgba(121, 168, 255, 0.22));
      }
      .trigger {
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 8px;
        padding: 0 8px 0 10px;
        overflow: hidden;
        border: 0;
        color: inherit;
        background: transparent;
        cursor: pointer;
        font: inherit;
        text-align: left;
      }
      .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .label.placeholder { color: var(--hy-muted-color, #788697); }
      .arrow { flex: 0 0 auto; color: var(--hy-muted-color, #788697); transition: transform 140ms ease; }
      :host([open]) .arrow { transform: rotate(180deg); }
      .clear {
        width: 28px;
        padding: 0;
        border: 0;
        color: var(--hy-muted-color, #788697);
        background: transparent;
        cursor: pointer;
        font: 15px/1 system-ui, sans-serif;
      }
      .clear:hover { color: var(--hy-text-color, #eef3ff); }
      .clear[hidden] { display: none; }
      .trigger:focus-visible, .clear:focus-visible { outline: none; }
      :host([disabled]) { opacity: 0.52; }
      :host([disabled]) .trigger, :host([disabled]) .clear { cursor: not-allowed; }
      .panel {
        position: absolute;
        z-index: var(--hy-cascader-z-index, 50);
        top: calc(100% + 6px);
        left: 0;
        display: flex;
        max-width: min(720px, 90vw);
        overflow: auto;
        border: 1px solid var(--hy-border-color, #3d4654);
        border-radius: var(--hy-cascader-panel-radius, 7px);
        background: var(--hy-menu-bg-color, var(--hy-surface-elevated-color, #171d27));
        box-shadow: 0 12px 32px var(--hy-menu-shadow-color, rgba(0, 0, 0, 0.36));
      }
      .panel[hidden] { display: none; }
      .column {
        flex: 0 0 var(--hy-cascader-column-width, 184px);
        min-width: 130px;
        max-height: var(--hy-cascader-panel-height, 260px);
        box-sizing: border-box;
        margin: 0;
        padding: 5px;
        overflow-y: auto;
        list-style: none;
        scrollbar-color: var(--hy-border-strong-color, #596779) transparent;
        scrollbar-width: thin;
      }
      .column + .column { border-left: 1px solid var(--hy-border-color, #3d4654); }
      .option {
        display: flex;
        width: 100%;
        min-height: 32px;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        overflow: hidden;
        border: 0;
        border-radius: 4px;
        color: var(--hy-secondary-text-color, #aebbd0);
        background: transparent;
        cursor: pointer;
        font: inherit;
        text-align: left;
      }
      .option-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .option-arrow { flex: 0 0 auto; color: var(--hy-muted-color, #788697); }
      .option:hover:not(:disabled), .option:focus-visible, .option[aria-selected="true"] {
        outline: none;
        color: var(--hy-text-color, #eef3ff);
        background: var(--hy-hover-bg-color, #273241);
      }
      .option[aria-selected="true"] { color: var(--hy-accent-color, #79a8ff); }
      .option:disabled { cursor: not-allowed; opacity: 0.46; }
      .empty { min-width: 184px; padding: 28px 18px; color: var(--hy-muted-color, #788697); text-align: center; }
    `;
    this._control.className = 'control';
    this._control.part.add('control');
    this._trigger.type = 'button';
    this._trigger.className = 'trigger';
    this._trigger.part.add('trigger');
    this._trigger.setAttribute('aria-haspopup', 'listbox');
    this._trigger.setAttribute('aria-controls', this._panelId);
    this._label.className = 'label';
    this._label.part.add('label');
    this._arrow.className = 'arrow';
    this._arrow.part.add('arrow');
    this._arrow.setAttribute('aria-hidden', 'true');
    this._arrow.textContent = '⌄';
    this._trigger.append(this._label, this._arrow);
    this._clear.type = 'button';
    this._clear.className = 'clear';
    this._clear.part.add('clear');
    this._clear.setAttribute('aria-label', 'Clear selection');
    this._clear.textContent = '×';
    this._panel.id = this._panelId;
    this._panel.className = 'panel';
    this._panel.part.add('panel');
    this._control.append(this._trigger, this._clear);
    root.append(style, this._control, this._panel);
    this._trigger.addEventListener('click', () => { if (!this.disabled) this.open = !this.open; });
    this._trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' && !this.disabled) {
        event.preventDefault();
        this.open = true;
        queueMicrotask(() => this._panel.querySelector<HTMLButtonElement>('.option:not(:disabled)')?.focus());
      } else if (event.key === 'Escape' && this.open) {
        event.preventDefault();
        this.open = false;
      }
    });
    this._clear.addEventListener('click', event => {
      event.stopPropagation();
      if (!this.disabled) this._commit([], true);
    });
  }

  connectedCallback(): void {
    this._syncAttributes();
    this._render();
    this._syncOutsideListener();
  }

  disconnectedCallback(): void {
    this._outsideAbort?.abort();
    this._outsideAbort = null;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || this._reflecting) return;
    if (name === 'options') this._readOptionsAttribute();
    if (name === 'value') this._readValueAttribute();
    if (name === 'open' && this.open) this._activePath = [...this._value];
    this._render();
    if (name === 'open') {
      this._syncOutsideListener();
      this._dispatchOpenChange();
    }
  }

  get options(): readonly HYCascaderOption[] { return this._options; }
  set options(value: readonly HYCascaderOption[]) {
    this._options = normalizeOptions(value);
    this._value = this._normalizePath(this._value);
    this._activePath = this.open ? [...this._value] : [];
    this._reflectValue();
    this._render();
  }

  get value(): readonly HYCascaderValue[] { return [...this._value]; }
  set value(value: readonly HYCascaderValue[]) {
    this._value = this._normalizePath(Array.isArray(value) ? value : []);
    this._activePath = this.open ? [...this._value] : [];
    this._reflectValue();
    this._render();
  }

  get open(): boolean { return this.hasAttribute('open'); }
  set open(value: boolean) { this.toggleAttribute('open', Boolean(value)); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }
  get clearable(): boolean { return this.getAttribute('clearable') !== 'false'; }
  set clearable(value: boolean) { this.setAttribute('clearable', String(Boolean(value))); }
  get changeOnSelect(): boolean { return this.hasAttribute('change-on-select') && this.getAttribute('change-on-select') !== 'false'; }
  set changeOnSelect(value: boolean) { this.toggleAttribute('change-on-select', Boolean(value)); }
  get placeholder(): string { return this.getAttribute('placeholder') ?? 'Please select'; }
  set placeholder(value: string) { this.setAttribute('placeholder', String(value)); }
  get displaySeparator(): string { return this.getAttribute('display-separator') ?? ' / '; }
  set displaySeparator(value: string) { this.setAttribute('display-separator', String(value)); }

  private _syncAttributes(): void {
    if (this.hasAttribute('options')) this._readOptionsAttribute();
    if (this.hasAttribute('value')) this._readValueAttribute();
    if (this.open) this._activePath = [...this._value];
  }

  private _readOptionsAttribute(): void {
    const raw = this.getAttribute('options');
    if (!raw) { this._options = []; return; }
    try { this._options = normalizeOptions(JSON.parse(raw)); }
    catch (error) { console.warn('Invalid hy-cascader options attribute.', error); }
  }

  private _readValueAttribute(): void {
    const raw = this.getAttribute('value');
    if (!raw) { this._value = []; return; }
    try { this._value = this._normalizePath(JSON.parse(raw)); }
    catch (error) { console.warn('Invalid hy-cascader value attribute.', error); }
  }

  private _reflectValue(): void {
    const serialized = JSON.stringify(this._value);
    if (this.getAttribute('value') === serialized) return;
    this._reflecting = true;
    if (this._value.length) this.setAttribute('value', serialized); else this.removeAttribute('value');
    this._reflecting = false;
  }

  private _normalizePath(value: readonly HYCascaderValue[]): HYCascaderValue[] {
    const normalized: HYCascaderValue[] = [];
    let options = this._options;
    for (const segment of value) {
      const option = options.find(item => sameValue(item.value, segment));
      if (!option || option.disabled) break;
      normalized.push(option.value);
      options = option.children ? [...option.children] : [];
    }
    return normalized;
  }

  private _resolveOptions(value: readonly HYCascaderValue[]): HYCascaderOption[] {
    const resolved: HYCascaderOption[] = [];
    let options = this._options;
    for (const segment of value) {
      const option = options.find(item => sameValue(item.value, segment));
      if (!option) break;
      resolved.push(option);
      options = option.children ? [...option.children] : [];
    }
    return resolved;
  }

  private _render(): void {
    const selected = this._resolveOptions(this._value);
    const text = selected.map(option => option.label).join(this.displaySeparator);
    this._label.textContent = text || this.placeholder;
    this._label.classList.toggle('placeholder', !text);
    this._trigger.disabled = this.disabled;
    this._trigger.setAttribute('aria-expanded', String(this.open));
    const accessibleName = this.getAttribute('aria-label');
    if (accessibleName) this._trigger.setAttribute('aria-label', accessibleName);
    else this._trigger.removeAttribute('aria-label');
    this._clear.hidden = !this.clearable || !this._value.length;
    this._clear.disabled = this.disabled;
    this._panel.hidden = !this.open;
    if (this.open) this._renderPanel(); else this._panel.replaceChildren();
  }

  private _renderPanel(): void {
    if (!this._options.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.part.add('empty');
      empty.textContent = 'No options';
      this._panel.replaceChildren(empty);
      return;
    }
    const columns: HTMLUListElement[] = [];
    let options = this._options;
    let depth = 0;
    while (options.length) {
      const column = document.createElement('ul');
      column.className = 'column';
      column.part.add('column');
      column.dataset.depth = String(depth);
      column.setAttribute('role', 'listbox');
      column.setAttribute('aria-label', `Level ${depth + 1}`);
      const activeValue = this._activePath[depth];
      for (const option of options) column.append(this._createOption(option, depth, activeValue));
      columns.push(column);
      const active = options.find(option => activeValue !== undefined && sameValue(option.value, activeValue));
      if (!active?.children?.length) break;
      options = active.children;
      depth += 1;
    }
    this._panel.replaceChildren(...columns);
  }

  private _createOption(option: HYCascaderOption, depth: number, activeValue: HYCascaderValue | undefined): HTMLLIElement {
    const row = document.createElement('li');
    row.part.add('option-item');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option';
    button.part.add('option');
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(activeValue !== undefined && sameValue(option.value, activeValue)));
    button.disabled = Boolean(option.disabled);
    const label = document.createElement('span');
    label.className = 'option-label';
    label.textContent = option.label;
    button.append(label);
    if (option.children?.length) {
      button.setAttribute('aria-haspopup', 'listbox');
      const arrow = document.createElement('span');
      arrow.className = 'option-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '›';
      button.append(arrow);
    }
    button.addEventListener('click', () => this._activateOption(option, depth));
    button.addEventListener('keydown', event => this._handleOptionKeydown(event, option, depth, button));
    row.append(button);
    return row;
  }

  private _activateOption(option: HYCascaderOption, depth: number, focusNext = false): void {
    if (option.disabled) return;
    const next = [...this._activePath.slice(0, depth), option.value];
    this._activePath = next;
    if (option.children?.length) {
      if (this.changeOnSelect) this._commit(next, false);
      else this._renderPanel();
      if (focusNext) queueMicrotask(() => this._panel.querySelector<HTMLUListElement>(`.column[data-depth="${depth + 1}"]`)?.querySelector<HTMLButtonElement>('.option:not(:disabled)')?.focus());
      return;
    }
    this._commit(next, true);
  }

  private _commit(value: readonly HYCascaderValue[], close: boolean): void {
    this._value = this._normalizePath(value);
    this._activePath = [...this._value];
    this._reflectValue();
    if (close && this.open) this.open = false;
    else this._render();
    this.dispatchEvent(new CustomEvent<HYCascaderChangeDetail>('value-change', {
      bubbles: true,
      composed: true,
      detail: { value: [...this._value], options: this._resolveOptions(this._value) },
    }));
  }

  private _handleOptionKeydown(event: KeyboardEvent, option: HYCascaderOption, depth: number, button: HTMLButtonElement): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.open = false;
      this._trigger.focus();
      return;
    }
    if (event.key === 'ArrowRight' && option.children?.length) {
      event.preventDefault();
      this._activateOption(option, depth, true);
      return;
    }
    if (event.key === 'ArrowLeft' && depth > 0) {
      event.preventDefault();
      const previous = this._panel.querySelector<HTMLUListElement>(`.column[data-depth="${depth - 1}"]`);
      (previous?.querySelector<HTMLButtonElement>('.option[aria-selected="true"]') ?? previous?.querySelector<HTMLButtonElement>('.option:not(:disabled)'))?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...button.closest('.column')!.querySelectorAll<HTMLButtonElement>('.option:not(:disabled)')];
    const current = buttons.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  private _syncOutsideListener(): void {
    this._outsideAbort?.abort();
    this._outsideAbort = null;
    if (!this.open || !this.isConnected) return;
    const abort = new AbortController();
    this._outsideAbort = abort;
    queueMicrotask(() => {
      if (abort.signal.aborted) return;
      document.addEventListener('pointerdown', event => {
        if (!event.composedPath().includes(this)) this.open = false;
      }, { capture: true, signal: abort.signal });
    });
  }

  private _dispatchOpenChange(): void {
    this.dispatchEvent(new CustomEvent<HYCascaderOpenChangeDetail>('open-change', {
      bubbles: true,
      composed: true,
      detail: { open: this.open },
    }));
  }
}

export function defineCascaderComponents(): void {
  if (!customElements.get('hy-cascader')) customElements.define('hy-cascader', HYCascader);
}
