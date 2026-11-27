import { registerDropTarget } from './internal/drag-drop.js';
import type { HYDragPayload } from './internal/drag-drop.js';
import { HYNativeDrop, hasFiles } from './internal/native-drop.js';

export interface HYDropzoneDropDetail {
  readonly source: HTMLElement | null;
  readonly type: string;
  readonly data: unknown;
  readonly files: readonly File[];
  readonly effect: 'copy' | 'move';
  readonly input: 'pointer' | 'keyboard' | 'native';
}

/** Drop target for typed application data and native files or text. */
export class HYDropzone extends HTMLElement {
  private readonly _surface = document.createElement('div');
  private readonly _native = new HYNativeDrop(this._surface, {
    enabled: () => true,
    accepts: transfer => !this.disabled && this._acceptsTypes(hasFiles(transfer) ? ['Files'] : [...transfer.types]),
    active: active => this.toggleAttribute('dragover', active),
    drop: event => {
      const transfer = event.dataTransfer!;
      const files = [...transfer.files];
      const type = files.length ? 'Files' : [...transfer.types].find(value => this._acceptsTypes([value])) || 'text/plain';
      this._drop({ source: null, type, data: files.length ? null : transfer.getData(type), files, effect: 'copy', input: 'native' });
    },
  });
  private _unregister: (() => void) | null = null;
  private _listeners: AbortController | null = null;
  static get observedAttributes(): string[] { return ['accept', 'disabled', 'aria-label']; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #eef0ff); font: var(--hy-font-size-sm, 12px)/var(--hy-line-height-relaxed, 1.5) var(--hy-font-family, system-ui, sans-serif); }
      :host([hidden]) { display: none !important; }
      .surface { box-sizing: border-box; min-height: var(--hy-dropzone-min-height, 120px); padding: var(--hy-dropzone-padding, var(--hy-space-8, 16px)); border: 1px dashed var(--hy-border-color, #343765); border-radius: var(--hy-dropzone-radius, var(--hy-radius-lg, 8px)); background: var(--hy-dropzone-bg-color, var(--hy-surface-color, #10132f)); }
      :host([dragover]) .surface { border-color: var(--hy-drop-indicator-color, var(--hy-accent-color, #8177f2)); background: var(--hy-drop-target-bg-color, var(--hy-hover-bg-color, #242752)); }
      .surface:focus-visible { outline: 2px solid var(--hy-focus-border-color, #8177f2); outline-offset: 2px; }
      :host([disabled]) .surface { opacity: .5; }
    `;
    this._surface.className = 'surface'; this._surface.part.add('surface');
    this._surface.setAttribute('role', 'group'); this._surface.append(document.createElement('slot'));
    root.append(style, this._surface);
  }

  connectedCallback(): void {
    this._listeners?.abort(); this._unregister?.();
    this._listeners = new AbortController(); this._native.connect(this._listeners.signal);
    this._unregister = registerDropTarget({
      element: this,
      accepts: payload => !this.disabled && this._acceptsTypes([payload.type]),
      over: payload => {
        if (this.hasAttribute('dragover')) return;
        this.setAttribute('dragover', '');
        this.dispatchEvent(new CustomEvent<HYDragPayload>('drag-enter', { detail: payload, bubbles: true, composed: true }));
      },
      leave: payload => {
        this.removeAttribute('dragover');
        this.dispatchEvent(new CustomEvent<HYDragPayload>('drag-leave', { detail: payload, bubbles: true, composed: true }));
      },
      drop: payload => this._drop({ ...payload, files: [] }),
    });
    this._sync();
  }
  disconnectedCallback(): void { this._listeners?.abort(); this._listeners = null; this._unregister?.(); this._unregister = null; this.removeAttribute('dragover'); }
  attributeChangedCallback(name: string): void { if (name === 'accept' || name === 'disabled') { this._native.reset(); this.removeAttribute('dragover'); } this._sync(); }
  get accept(): string { return this.getAttribute('accept') ?? '*'; }
  set accept(value: string) { this.setAttribute('accept', value); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', value); }
  override focus(options?: FocusOptions): void { this._surface.focus(options); }

  private _sync(): void {
    this._surface.tabIndex = this.disabled ? -1 : 0;
    this._surface.setAttribute('aria-disabled', String(this.disabled));
    this._surface.setAttribute('aria-label', this.getAttribute('aria-label') || 'Drop zone. Press Enter to drop a picked-up item.');
  }
  private _acceptsTypes(types: readonly string[]): boolean {
    const accepted = this.accept.split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    return accepted.includes('*') || types.some(type => accepted.includes(type.toLowerCase()));
  }
  private _drop(detail: HYDropzoneDropDetail): boolean {
    if (this.disabled || !this.isConnected || !this._acceptsTypes([detail.type])) return false;
    return this.dispatchEvent(new CustomEvent<HYDropzoneDropDetail>('data-drop', { detail, bubbles: true, composed: true, cancelable: true }));
  }
}

export function defineDropzoneComponents(): void {
  if (!customElements.get('hy-dropzone')) customElements.define('hy-dropzone', HYDropzone);
}
