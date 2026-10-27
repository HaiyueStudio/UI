export type HYSegmentedSize = 'small' | 'medium' | 'large';

export interface HYSegmentedOption {
  readonly label: string;
  readonly value: string;
  readonly icon?: string;
  readonly disabled?: boolean;
}

export type HYSegmentedOptionInput = HYSegmentedOption | string | number;

export interface HYSegmentedChangeDetail {
  readonly value: string;
  readonly option: HYSegmentedOption | null;
}

/** A compact single-choice control with roving keyboard focus. */
export class HYSegmented extends HTMLElement {
  private readonly _group = document.createElement('div');
  private _options: HYSegmentedOption[] = [];
  private _pendingFocus: string | null = null;

  static get observedAttributes(): string[] {
    return ['options', 'value', 'size', 'block', 'disabled', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; max-width: 100%; color: var(--hy-text-color, #d8e2f2); font: 12px system-ui, sans-serif; }
      :host([block]) { display: block; width: 100%; }
      .group { display: inline-flex; box-sizing: border-box; max-width: 100%; gap: 2px; padding: 3px; border: 1px solid var(--hy-segmented-border-color, transparent); border-radius: var(--hy-segmented-radius, 7px); background: var(--hy-segmented-bg-color, var(--hy-input-bg-color, #121822)); }
      :host([block]) .group { display: flex; width: 100%; }
      button { display: inline-flex; min-width: 0; height: 28px; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; border: 0; border-radius: calc(var(--hy-segmented-radius, 7px) - 2px); color: var(--hy-segmented-text-color, var(--hy-secondary-text-color, #8fa7c8)); background: transparent; font: inherit; white-space: nowrap; cursor: pointer; transition: color 120ms ease, background 120ms ease, box-shadow 120ms ease; }
      :host([block]) button { flex: 1 1 0; }
      :host([size="small"]) button { height: 22px; padding-inline: 8px; font-size: 11px; }
      :host([size="large"]) button { height: 34px; padding-inline: 16px; font-size: 13px; }
      button:hover:not(:disabled):not(.selected) { color: var(--hy-text-color, #d8e2f2); background: var(--hy-hover-bg-color, #222b3a); }
      button.selected { color: var(--hy-segmented-selected-text-color, var(--hy-active-text-color, #eef3ff)); background: var(--hy-segmented-selected-bg-color, var(--hy-surface-elevated-color, #1b2230)); box-shadow: var(--hy-segmented-selected-shadow, 0 1px 3px rgba(0, 0, 0, 0.24)); }
      button:focus-visible { outline: 2px solid var(--hy-focus-border-color, #3d6fa8); outline-offset: 1px; }
      button:disabled { opacity: 0.42; cursor: default; }
      .icon { flex: none; line-height: 1; }
      .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      @media (prefers-reduced-motion: reduce) { button { transition: none; } }
    `;
    this._group.className = 'group';
    this._group.part.add('group');
    this._group.setAttribute('role', 'radiogroup');
    root.append(style, this._group);
  }

  connectedCallback(): void {
    if (this.hasAttribute('options')) this._readOptionsAttribute();
    this._normalizeValue();
    this._render();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === 'options') this._readOptionsAttribute();
    if ((name === 'options' || name === 'value') && this.isConnected) this._normalizeValue();
    this._render();
  }

  get options(): HYSegmentedOption[] { return this._options; }
  set options(value: readonly HYSegmentedOptionInput[]) {
    this._options = Array.isArray(value) ? value.map(item => {
      if (typeof item === 'string' || typeof item === 'number') return { label: String(item), value: String(item) };
      const normalized: HYSegmentedOption = {
        label: String(item.label ?? item.value ?? ''),
        value: String(item.value ?? item.label ?? ''),
        disabled: Boolean(item.disabled),
      };
      return item.icon == null ? normalized : { ...normalized, icon: String(item.icon) };
    }) : [];
    this._normalizeValue();
    this._render();
  }
  get value(): string { return this.getAttribute('value') ?? ''; }
  set value(value: string) { if (value) this.setAttribute('value', value); else this.removeAttribute('value'); }
  get size(): HYSegmentedSize {
    const value = this.getAttribute('size');
    return value === 'small' || value === 'large' ? value : 'medium';
  }
  set size(value: HYSegmentedSize) { this.setAttribute('size', value); }
  get block(): boolean { return this.hasAttribute('block'); }
  set block(value: boolean) { this.toggleAttribute('block', Boolean(value)); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }

  select(value: string): boolean {
    const option = this._options.find(item => item.value === value && !item.disabled) ?? null;
    if (!option || this.disabled || value === this.value) return false;
    this.value = value;
    this.dispatchEvent(new CustomEvent<HYSegmentedChangeDetail>('value-change', {
      detail: { value, option }, bubbles: true, composed: true,
    }));
    return true;
  }

  private _readOptionsAttribute(): void {
    const raw = this.getAttribute('options');
    if (!raw) { this._options = []; return; }
    try {
      const parsed: unknown = JSON.parse(raw);
      this._options = Array.isArray(parsed) ? parsed.map(item => {
        if (typeof item === 'string' || typeof item === 'number') return { label: String(item), value: String(item) };
        const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        const normalized: HYSegmentedOption = {
          label: String(record.label ?? record.value ?? ''), value: String(record.value ?? record.label ?? ''),
          disabled: Boolean(record.disabled),
        };
        return record.icon == null ? normalized : { ...normalized, icon: String(record.icon) };
      }) : [];
    } catch (error) {
      console.warn('Invalid hy-segmented options attribute.', error);
      this._options = [];
    }
  }

  private _normalizeValue(): void {
    if (this._options.some(item => item.value === this.value && !item.disabled)) return;
    const value = this._options.find(item => !item.disabled)?.value ?? '';
    if (value === this.value) return;
    if (value) this.setAttribute('value', value); else this.removeAttribute('value');
  }

  private _render(): void {
    if (!this._group) return;
    const focused = this._pendingFocus ?? [...this._group.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button === this.shadowRoot?.activeElement)?.dataset.value ?? null;
    this._pendingFocus = null;
    this._group.replaceChildren();
    this._group.setAttribute('aria-label', this.getAttribute('aria-label') ?? 'Segmented control');
    this._group.setAttribute('aria-disabled', String(this.disabled));
    const enabled = this._options.filter(item => !item.disabled);
    const tabValue = enabled.some(item => item.value === this.value) ? this.value : enabled[0]?.value;
    for (const option of this._options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.part.add('item');
      button.dataset.value = option.value;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(option.value === this.value));
      button.classList.toggle('selected', option.value === this.value);
      button.disabled = this.disabled || Boolean(option.disabled);
      button.tabIndex = !button.disabled && option.value === tabValue ? 0 : -1;
      if (option.icon) {
        const icon = document.createElement('span'); icon.className = 'icon'; icon.part.add('icon'); icon.textContent = option.icon; button.append(icon);
      }
      const label = document.createElement('span'); label.className = 'label'; label.part.add('label'); label.textContent = option.label; button.append(label);
      button.addEventListener('click', () => this.select(option.value));
      button.addEventListener('keydown', event => this._onKeyDown(event, option, enabled));
      this._group.append(button);
    }
    if (focused) queueMicrotask(() => this._focus(enabled.some(item => item.value === focused) ? focused : tabValue ?? ''));
  }

  private _onKeyDown(event: KeyboardEvent, option: HYSegmentedOption, enabled: HYSegmentedOption[]): void {
    if (!enabled.length || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const position = Math.max(0, enabled.findIndex(item => item.value === option.value));
    const direction = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
    let next = position;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    else {
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      const delta = (forward ? 1 : -1) * (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? direction : 1);
      next = (position + delta + enabled.length) % enabled.length;
    }
    this._pendingFocus = enabled[next]!.value;
    if (!this.select(enabled[next]!.value)) this._render();
  }

  private _focus(value: string): void {
    [...this._group.querySelectorAll<HTMLButtonElement>('button')].find(button => button.dataset.value === value)?.focus();
  }
}

export function defineSegmentedComponents(): void {
  if (!customElements.get('hy-segmented')) customElements.define('hy-segmented', HYSegmented);
}
