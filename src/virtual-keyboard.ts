export type HYVirtualKeyboardSource = 'pointer' | 'keyboard' | 'physical' | 'api';
export type HYVirtualKeyboardMode = 'qwerty' | 'numeric';
export type HYVirtualKeyboardAction =
  | 'character' | 'backspace' | 'delete' | 'enter' | 'tab' | 'space'
  | 'shift' | 'caps-lock' | 'escape' | 'arrow-left' | 'arrow-right'
  | 'arrow-up' | 'arrow-down' | 'home' | 'end';

export interface HYVirtualKeyboardKey {
  readonly code: string;
  readonly label: string;
  readonly value?: string;
  readonly shiftLabel?: string;
  readonly shiftValue?: string;
  readonly action?: HYVirtualKeyboardAction;
  readonly width?: number;
  readonly disabled?: boolean;
}

export type HYVirtualKeyboardLayout = readonly (readonly HYVirtualKeyboardKey[])[];

export interface HYVirtualKeyboardKeyDetail {
  readonly code: string;
  readonly key: string;
  readonly action: HYVirtualKeyboardAction;
  readonly source: HYVirtualKeyboardSource;
  readonly pressedKeys: readonly string[];
  readonly shiftKey: boolean;
  readonly capsLock: boolean;
}

export interface HYVirtualKeyboardInputDetail extends HYVirtualKeyboardKeyDetail {
  readonly value: string;
  readonly inputType: string;
}

export interface HYVirtualKeyboardTapOptions { readonly holdDuration?: number; }
export interface HYVirtualKeyboardTypeOptions { readonly interval?: number; }

const LETTERS = 'QWERTYUIOPASDFGHJKLZXCVBNM';
const DIGITS = [
  ['Digit1', '1', '!'], ['Digit2', '2', '@'], ['Digit3', '3', '#'], ['Digit4', '4', '$'], ['Digit5', '5', '%'],
  ['Digit6', '6', '^'], ['Digit7', '7', '&'], ['Digit8', '8', '*'], ['Digit9', '9', '('], ['Digit0', '0', ')'],
] as const;

const letter = (value: string): HYVirtualKeyboardKey => ({ code: `Key${value}`, label: value, value: value.toLowerCase(), shiftValue: value });
const action = (code: string, label: string, actionName: HYVirtualKeyboardAction, width = 1): HYVirtualKeyboardKey => ({ code, label, action: actionName, width });

export const HY_VIRTUAL_KEYBOARD_QWERTY_LAYOUT: HYVirtualKeyboardLayout = [
  [
    ...DIGITS.map(([code, value, shifted]) => ({ code, label: value, value, shiftLabel: shifted, shiftValue: shifted })),
    action('Backspace', 'Backspace', 'backspace', 1.8),
  ],
  [action('Tab', 'Tab', 'tab', 1.4), ...'QWERTYUIOP'.split('').map(letter)],
  [action('CapsLock', 'Caps', 'caps-lock', 1.7), ...'ASDFGHJKL'.split('').map(letter), action('Enter', 'Enter', 'enter', 1.7)],
  [action('ShiftLeft', 'Shift', 'shift', 2.1), ...'ZXCVBNM'.split('').map(letter), action('Delete', 'Delete', 'delete', 1.35)],
  [action('Escape', 'Esc', 'escape', 1.1), action('Space', 'Space', 'space', 5), action('Home', 'Home', 'home', 1.1), action('ArrowLeft', '←', 'arrow-left'), action('ArrowUp', '↑', 'arrow-up'), action('ArrowDown', '↓', 'arrow-down'), action('ArrowRight', '→', 'arrow-right'), action('End', 'End', 'end', 1.1)],
];

const numeric = (value: string): HYVirtualKeyboardKey => ({ code: `Numpad${value}`, label: value, value });

export const HY_VIRTUAL_KEYBOARD_NUMERIC_LAYOUT: HYVirtualKeyboardLayout = [
  [numeric('7'), numeric('8'), numeric('9'), action('Backspace', '⌫', 'backspace')],
  [numeric('4'), numeric('5'), numeric('6'), action('Delete', 'Delete', 'delete')],
  [numeric('1'), numeric('2'), numeric('3'), action('NumpadEnter', 'Enter', 'enter')],
  [{ ...numeric('0'), width: 2 }, { code: 'NumpadDecimal', label: '.', value: '.' }, { code: 'NumpadSubtract', label: '−', value: '-' }],
];

function normalizeLayout(value: unknown): HYVirtualKeyboardLayout {
  if (!Array.isArray(value)) return HY_VIRTUAL_KEYBOARD_QWERTY_LAYOUT;
  const rows = value.flatMap(row => {
    if (!Array.isArray(row)) return [];
    const keys = row.flatMap(raw => {
      if (!raw || typeof raw !== 'object') return [];
      const item = raw as Record<string, unknown>;
      if (item.code == null || item.label == null) return [];
      const actionName = String(item.action ?? 'character') as HYVirtualKeyboardAction;
      const validActions: readonly HYVirtualKeyboardAction[] = ['character', 'backspace', 'delete', 'enter', 'tab', 'space', 'shift', 'caps-lock', 'escape', 'arrow-left', 'arrow-right', 'arrow-up', 'arrow-down', 'home', 'end'];
      return [{
        code: String(item.code), label: String(item.label),
        ...(item.value != null ? { value: String(item.value) } : {}),
        ...(item.shiftLabel != null ? { shiftLabel: String(item.shiftLabel) } : {}),
        ...(item.shiftValue != null ? { shiftValue: String(item.shiftValue) } : {}),
        action: validActions.includes(actionName) ? actionName : 'character',
        width: Number.isFinite(Number(item.width)) ? Math.max(.5, Math.min(12, Number(item.width))) : 1,
        ...(typeof item.disabled === 'boolean' ? { disabled: item.disabled } : {}),
      }];
    });
    return keys.length ? [keys] : [];
  });
  return rows.length ? rows : HY_VIRTUAL_KEYBOARD_QWERTY_LAYOUT;
}

function delay(milliseconds: number): Promise<void> { return new Promise(resolve => window.setTimeout(resolve, Math.max(0, milliseconds))); }

/** Themeable on-screen keyboard with programmable key actions and optional input binding. */
export class HYVirtualKeyboard extends HTMLElement {
  private readonly _keyboard = document.createElement('div');
  private _layout: HYVirtualKeyboardLayout = HY_VIRTUAL_KEYBOARD_QWERTY_LAYOUT;
  private _layoutAssigned = false;
  private _target: HTMLInputElement | HTMLTextAreaElement | null = null;
  private readonly _pressed = new Set<string>();
  private readonly _pressedValues = new Map<string, string>();
  private readonly _buttons = new Map<string, HTMLButtonElement>();
  private _shift = false;
  private _capsLock = false;
  private _listeners: AbortController | null = null;
  private _operation = 0;

  static get observedAttributes(): string[] { return ['layout', 'mode', 'disabled', 'physical-sync', 'aria-label']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #eef3ff); font: 12px/1 system-ui, sans-serif; }
      .keyboard { display: grid; gap: var(--hy-virtual-keyboard-row-gap, 7px); box-sizing: border-box; padding: var(--hy-virtual-keyboard-padding, 12px); border: 1px solid var(--hy-border-color, #3d4654); border-radius: var(--hy-virtual-keyboard-radius, 11px); background: var(--hy-virtual-keyboard-bg, var(--hy-surface-color, #111722)); box-shadow: var(--hy-virtual-keyboard-shadow, 0 16px 40px rgba(0, 0, 0, .22)); user-select: none; touch-action: manipulation; }
      .row { display: flex; gap: var(--hy-virtual-keyboard-key-gap, 6px); min-width: 0; }
      .key { position: relative; min-width: 0; height: var(--hy-virtual-keyboard-key-height, 42px); flex: var(--_key-width, 1) 1 0; overflow: hidden; padding: 0 5px; border: 1px solid var(--hy-virtual-keyboard-key-border, var(--hy-border-color, #3d4654)); border-radius: var(--hy-virtual-keyboard-key-radius, 7px); color: var(--hy-virtual-keyboard-key-color, var(--hy-text-color, #eef3ff)); background: var(--hy-virtual-keyboard-key-bg, var(--hy-surface-elevated-color, #171d27)); box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--hy-border-color, #3d4654) 65%, transparent); cursor: pointer; font: inherit; text-overflow: ellipsis; white-space: nowrap; transition: translate 70ms ease, background-color 70ms ease, box-shadow 70ms ease; }
      .key:hover:not(:disabled) { border-color: var(--hy-hover-border-color, #596779); background: var(--hy-hover-bg-color, #273241); }
      .key:focus-visible { z-index: 1; outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 1px; }
      .key.pressed, .key[aria-pressed="true"] { translate: 0 1px; border-color: var(--hy-selected-bg-color, #554cc6); background: var(--hy-virtual-keyboard-active-bg, color-mix(in srgb, var(--hy-selected-bg-color, #554cc6) 50%, var(--hy-surface-elevated-color, #171d27))); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hy-focus-border-color, #79a8ff) 24%, transparent); }
      .key:disabled { opacity: .42; cursor: not-allowed; }
      :host([disabled]) .keyboard { opacity: .62; }
      @media (max-width: 620px) { .keyboard { --hy-virtual-keyboard-padding: 7px; --hy-virtual-keyboard-row-gap: 5px; --hy-virtual-keyboard-key-gap: 3px; --hy-virtual-keyboard-key-height: 36px; font-size: 9px; } }
      @media (prefers-reduced-motion: reduce) { .key { transition: none; } }
    `;
    this._keyboard.className = 'keyboard'; this._keyboard.part.add('keyboard'); this._keyboard.setAttribute('role', 'group'); root.append(style, this._keyboard);
  }

  connectedCallback(): void {
    if (!this._layoutAssigned && this.hasAttribute('layout')) this._readLayoutAttribute();
    else if (!this._layoutAssigned) this._applyModeLayout();
    this._render(); this._connectPhysicalKeyboard();
  }
  disconnectedCallback(): void { this._operation += 1; this._disconnectPhysicalKeyboard(); this._pressed.clear(); this._pressedValues.clear(); }
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === 'layout' && !this._layoutAssigned) { this._readLayoutAttribute(); this._render(); }
    else if (name === 'mode') { this._layoutAssigned = false; this._applyModeLayout(); this._render(); }
    else if (name === 'physical-sync') this._connectPhysicalKeyboard();
    else if (name === 'aria-label') this._syncLabel();
    else if (name === 'disabled') this._syncVisuals();
  }

  get layout(): HYVirtualKeyboardLayout { return this._layout; }
  set layout(value: HYVirtualKeyboardLayout) { this._layoutAssigned = true; this._layout = normalizeLayout(value); this._render(); }
  get mode(): HYVirtualKeyboardMode { return this.getAttribute('mode') === 'numeric' ? 'numeric' : 'qwerty'; }
  set mode(value: HYVirtualKeyboardMode) {
    const normalized: HYVirtualKeyboardMode = value === 'numeric' ? 'numeric' : 'qwerty';
    this._layoutAssigned = false;
    if (this.getAttribute('mode') === normalized) { this._applyModeLayout(); this._render(); }
    else this.setAttribute('mode', normalized);
  }
  get target(): HTMLInputElement | HTMLTextAreaElement | null { return this._target; }
  set target(value: HTMLInputElement | HTMLTextAreaElement | null) { this._target = value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement ? value : null; }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', Boolean(value)); }
  get physicalSync(): boolean { return this.hasAttribute('physical-sync'); }
  set physicalSync(value: boolean) { this.toggleAttribute('physical-sync', Boolean(value)); }
  get shiftActive(): boolean { return this._shift; }
  get capsLock(): boolean { return this._capsLock; }
  get pressedKeys(): readonly string[] { return [...this._pressed]; }

  press(code: string, source: HYVirtualKeyboardSource = 'api'): void { this._press(String(code), source, source !== 'physical'); }
  release(code: string, source: HYVirtualKeyboardSource = 'api'): void { this._release(String(code), source); }
  async tap(code: string, options: HYVirtualKeyboardTapOptions = {}): Promise<void> {
    const operation = this._operation; const requested = options.holdDuration == null ? 70 : Number(options.holdDuration); const holdDuration = Number.isFinite(requested) ? Math.min(10_000, Math.max(0, requested)) : 70;
    this.press(code, 'api'); await delay(holdDuration); if (operation === this._operation && this.isConnected) this.release(code, 'api');
  }
  async type(text: string, options: HYVirtualKeyboardTypeOptions = {}): Promise<void> {
    const operation = ++this._operation; const requested = options.interval == null ? 45 : Number(options.interval); const interval = Number.isFinite(requested) ? Math.min(10_000, Math.max(0, requested)) : 45;
    for (const character of String(text)) {
      if (operation !== this._operation || !this.isConnected) return;
      const match = this._findCharacterKey(character);
      if (match) { const isLetter = match.key.code.startsWith('Key'); this._shift = isLetter ? match.shifted !== this._capsLock : match.shifted; this._press(match.key.code, 'api', true); this._release(match.key.code, 'api'); }
      else this._insertText(character, 'insertText', { code: 'Unidentified', key: character, action: 'character', source: 'api' });
      if (interval) await delay(interval);
    }
  }
  clear(): void {
    if (!this._target || this.disabled || this._target.disabled || this._target.readOnly) return;
    this._target.value = ''; this._target.setSelectionRange(0, 0); this._dispatchTargetInput('deleteContent', null); this._emitInput({ code: 'Clear', key: '', action: 'delete', source: 'api' }, 'deleteContent');
  }

  private _readLayoutAttribute(): void { try { this._layout = normalizeLayout(JSON.parse(this.getAttribute('layout') ?? '[]')); } catch { this._layout = HY_VIRTUAL_KEYBOARD_QWERTY_LAYOUT; } }
  private _applyModeLayout(): void { this._layout = this.mode === 'numeric' ? HY_VIRTUAL_KEYBOARD_NUMERIC_LAYOUT : HY_VIRTUAL_KEYBOARD_QWERTY_LAYOUT; }
  private _render(): void {
    if (!this.isConnected) return;
    this._buttons.clear(); const rows = this._layout.map((keys, rowIndex) => {
      const row = document.createElement('div'); row.className = 'row'; row.part.add('row'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', `Keyboard row ${rowIndex + 1}`);
      for (const key of keys) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'key'; button.part.add('key'); button.dataset.code = key.code; button.style.setProperty('--_key-width', String(key.width ?? 1)); button.disabled = Boolean(key.disabled) || this.disabled;
        const safePart = key.code.toLowerCase().replace(/[^a-z0-9_-]/gu, '-'); if (safePart) button.part.add(`key-${safePart}`);
        button.addEventListener('pointerdown', event => { if (button.disabled) return; event.preventDefault(); button.setPointerCapture(event.pointerId); this._press(key.code, 'pointer', true); });
        button.addEventListener('pointerup', event => { if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId); this._release(key.code, 'pointer'); });
        button.addEventListener('pointercancel', () => this._release(key.code, 'pointer'));
        button.addEventListener('click', event => { if (event.detail === 0) { this._press(key.code, 'keyboard', true); this._release(key.code, 'keyboard'); } });
        this._buttons.set(key.code, button); row.append(button);
      }
      return row;
    });
    this._keyboard.replaceChildren(...rows); this._syncLabel(); this._syncVisuals();
  }
  private _syncLabel(): void { this._keyboard.setAttribute('aria-label', this.getAttribute('aria-label') || 'Virtual keyboard'); }
  private _syncVisuals(): void {
    for (const key of this._layout.flat()) {
      const button = this._buttons.get(key.code); if (!button) continue; const resolved = this._resolveKey(key);
      button.textContent = resolved.label; button.title = key.label; button.disabled = Boolean(key.disabled) || this.disabled; button.classList.toggle('pressed', this._pressed.has(key.code));
      const toggled = key.action === 'shift' ? this._shift : key.action === 'caps-lock' ? this._capsLock : false;
      if (key.action === 'shift' || key.action === 'caps-lock') button.setAttribute('aria-pressed', String(toggled)); else button.removeAttribute('aria-pressed');
      button.setAttribute('aria-label', key.label.length === 1 ? resolved.key : key.label);
    }
  }

  private _press(code: string, source: HYVirtualKeyboardSource, apply: boolean): void {
    if (this.disabled || this._pressed.has(code)) return; const key = this._findKey(code); if (!key || key.disabled) return;
    this._pressed.add(code); const resolved = this._resolveKey(key); this._pressedValues.set(code, resolved.key);
    if (key.action === 'shift') { if (source !== 'physical') this._shift = !this._shift; }
    else if (key.action === 'caps-lock') { if (source !== 'physical') this._capsLock = !this._capsLock; }
    else if (apply) this._applyKey(key, resolved.key, source);
    this._syncVisuals(); this._dispatchKeyEvent('virtual-keyboard-down', key, resolved.key, source);
    if (apply && key.action !== 'shift' && key.action !== 'caps-lock' && this._shift) { this._shift = false; this._syncVisuals(); }
  }
  private _release(code: string, source: HYVirtualKeyboardSource): void {
    if (!this._pressed.delete(code)) return; const key = this._findKey(code); if (!key) return; const resolvedValue = this._pressedValues.get(code) ?? this._resolveKey(key).key; this._pressedValues.delete(code); this._syncVisuals(); this._dispatchKeyEvent('virtual-keyboard-up', key, resolvedValue, source);
  }
  private _applyKey(key: HYVirtualKeyboardKey, resolvedValue: string, source: HYVirtualKeyboardSource): void {
    const descriptor = { code: key.code, key: resolvedValue, action: key.action ?? 'character', source } as const;
    if (key.action === 'shift' || key.action === 'caps-lock') return;
    if (key.action === 'backspace') this._deleteBackward(descriptor);
    else if (key.action === 'delete') this._deleteForward(descriptor);
    else if (key.action === 'arrow-left') this._moveCaret(-1);
    else if (key.action === 'arrow-right') this._moveCaret(1);
    else if (key.action === 'arrow-up') this._moveCaretVertical(-1);
    else if (key.action === 'arrow-down') this._moveCaretVertical(1);
    else if (key.action === 'home') this._setCaret(0);
    else if (key.action === 'end') this._setCaret(this._target?.value.length ?? 0);
    else if (key.action === 'escape') this._target?.blur();
    else if (key.action === 'enter') { if (this._target instanceof HTMLTextAreaElement) this._insertText('\n', 'insertLineBreak', descriptor); else this._target?.dispatchEvent(new Event('change', { bubbles: true })); }
    else if (key.action === 'tab') { if (this._target instanceof HTMLTextAreaElement) this._insertText('\t', 'insertText', descriptor); }
    else this._insertText(key.action === 'space' ? ' ' : resolvedValue, 'insertText', descriptor);
  }
  private _insertText(text: string, inputType: string, descriptor: Pick<HYVirtualKeyboardKeyDetail, 'code' | 'key' | 'action' | 'source'>): void {
    const target = this._target; if (!target || target.disabled || target.readOnly) return; const start = target.selectionStart ?? target.value.length; const end = target.selectionEnd ?? start;
    target.setRangeText(text, start, end, 'end'); this._dispatchTargetInput(inputType, text); this._emitInput(descriptor, inputType);
  }
  private _deleteBackward(descriptor: Pick<HYVirtualKeyboardKeyDetail, 'code' | 'key' | 'action' | 'source'>): void {
    const target = this._target; if (!target || target.disabled || target.readOnly) return; const start = target.selectionStart ?? 0; const end = target.selectionEnd ?? start; if (start === end && start === 0) return;
    target.setRangeText('', start === end ? start - 1 : start, end, 'end'); this._dispatchTargetInput('deleteContentBackward', null); this._emitInput(descriptor, 'deleteContentBackward');
  }
  private _deleteForward(descriptor: Pick<HYVirtualKeyboardKeyDetail, 'code' | 'key' | 'action' | 'source'>): void {
    const target = this._target; if (!target || target.disabled || target.readOnly) return; const start = target.selectionStart ?? 0; const end = target.selectionEnd ?? start; if (start === end && end >= target.value.length) return;
    target.setRangeText('', start, start === end ? end + 1 : end, 'end'); this._dispatchTargetInput('deleteContentForward', null); this._emitInput(descriptor, 'deleteContentForward');
  }
  private _moveCaret(delta: number): void { const target = this._target; if (!target) return; const position = Math.max(0, Math.min(target.value.length, (target.selectionStart ?? 0) + delta)); this._setCaret(position); }
  private _moveCaretVertical(direction: -1 | 1): void {
    const target = this._target; if (!(target instanceof HTMLTextAreaElement)) return;
    const value = target.value; const position = target.selectionStart ?? 0; const lineStart = value.lastIndexOf('\n', position - 1) + 1; const column = position - lineStart;
    if (direction < 0) {
      if (lineStart === 0) return; const previousEnd = lineStart - 1; const previousStart = value.lastIndexOf('\n', previousEnd - 1) + 1; this._setCaret(previousStart + Math.min(column, previousEnd - previousStart));
    } else {
      const currentEnd = value.indexOf('\n', position); if (currentEnd < 0) return; const nextStart = currentEnd + 1; const nextEnd = value.indexOf('\n', nextStart); const length = (nextEnd < 0 ? value.length : nextEnd) - nextStart; this._setCaret(nextStart + Math.min(column, length));
    }
  }
  private _setCaret(position: number): void { const target = this._target; if (!target) return; target.focus({ preventScroll: true }); target.setSelectionRange(position, position); }
  private _dispatchTargetInput(inputType: string, data: string | null): void {
    if (!this._target) return;
    try { this._target.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType, data })); }
    catch { this._target.dispatchEvent(new Event('input', { bubbles: true, composed: true })); }
  }
  private _emitInput(descriptor: Pick<HYVirtualKeyboardKeyDetail, 'code' | 'key' | 'action' | 'source'>, inputType: string): void {
    if (!this._target) return; this.dispatchEvent(new CustomEvent<HYVirtualKeyboardInputDetail>('virtual-keyboard-input', { bubbles: true, composed: true, detail: { ...descriptor, value: this._target.value, inputType, pressedKeys: [...this._pressed], shiftKey: this._shift, capsLock: this._capsLock } }));
  }
  private _dispatchKeyEvent(name: 'virtual-keyboard-down' | 'virtual-keyboard-up', key: HYVirtualKeyboardKey, resolvedValue: string, source: HYVirtualKeyboardSource): void {
    this.dispatchEvent(new CustomEvent<HYVirtualKeyboardKeyDetail>(name, { bubbles: true, composed: true, detail: { code: key.code, key: resolvedValue, action: key.action ?? 'character', source, pressedKeys: [...this._pressed], shiftKey: this._shift, capsLock: this._capsLock } }));
  }
  private _resolveKey(key: HYVirtualKeyboardKey): { key: string; label: string } {
    const isLetter = key.code.startsWith('Key') && LETTERS.includes(key.code.slice(3).toUpperCase()); const shifted = isLetter ? this._shift !== this._capsLock : this._shift;
    const value = shifted ? (key.shiftValue ?? key.shiftLabel ?? key.value ?? key.label) : (key.value ?? key.label);
    const label = key.action && key.action !== 'character' ? key.label : shifted ? (key.shiftLabel ?? (isLetter ? key.label.toUpperCase() : key.label)) : key.label;
    return { key: value, label };
  }
  private _findKey(code: string): HYVirtualKeyboardKey | null { return this._layout.flat().find(key => key.code === code) ?? null; }
  private _findCharacterKey(character: string): { key: HYVirtualKeyboardKey; shifted: boolean } | null {
    for (const key of this._layout.flat()) { const normal = key.value ?? (key.action === 'space' ? ' ' : key.label); const shifted = key.shiftValue ?? key.shiftLabel; if (normal === character) return { key, shifted: false }; if (shifted === character) return { key, shifted: true }; } return null;
  }
  private _connectPhysicalKeyboard(): void {
    this._disconnectPhysicalKeyboard(); if (!this.isConnected || !this.physicalSync) return; const abort = new AbortController(); this._listeners = abort;
    document.addEventListener('keydown', event => { if (event.repeat) return; this._shift = event.shiftKey; this._capsLock = event.getModifierState('CapsLock'); this._press(event.code, 'physical', false); }, { signal: abort.signal });
    document.addEventListener('keyup', event => { this._shift = event.shiftKey; this._capsLock = event.getModifierState('CapsLock'); this._release(event.code, 'physical'); this._syncVisuals(); }, { signal: abort.signal });
  }
  private _disconnectPhysicalKeyboard(): void { this._listeners?.abort(); this._listeners = null; }
}

export function defineVirtualKeyboardComponents(): void {
  if (!customElements.get('hy-virtual-keyboard')) customElements.define('hy-virtual-keyboard', HYVirtualKeyboard);
}
