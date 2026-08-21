export interface HYHistoryEntry {
  readonly id: number;
  readonly label: string;
}

export class HYHistoryControls extends HTMLElement {
  private readonly _undo = document.createElement('button');
  private readonly _redo = document.createElement('button');
  private _canUndo = false;
  private _canRedo = false;
  private _undoLabel = '';
  private _redoLabel = '';
  private _busy = false;
  private _entries: readonly HYHistoryEntry[] = Object.freeze([]);
  private _connected = false;
  private readonly _requestUndo = () => this._request('undo-request');
  private readonly _requestRedo = () => this._request('redo-request');

  static get observedAttributes(): string[] {
    return ['can-undo', 'can-redo', 'undo-label', 'redo-label', 'busy', 'locale'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-flex; }
      [role="toolbar"] { display: inline-flex; gap: 2px; }
      button {
        width: 30px;
        min-height: 28px;
        border: 1px solid var(--hy-border-color, #3d4654);
        background: var(--hy-surface-elevated-color, #202733);
        color: var(--hy-text-color, #eef3ff);
        font: 600 15px system-ui, sans-serif;
        cursor: pointer;
      }
      button:first-child { border-radius: 4px 0 0 4px; }
      button:last-child { border-radius: 0 4px 4px 0; }
      button:hover:not(:disabled) { background: var(--hy-hover-bg-color, #273241); }
      button:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 1px; }
      button:disabled { opacity: 0.45; cursor: default; }
    `;
    const toolbar = document.createElement('div');
    toolbar.setAttribute('role', 'toolbar');
    this._undo.type = 'button';
    this._redo.type = 'button';
    this._undo.textContent = '↶';
    this._redo.textContent = '↷';
    toolbar.append(this._undo, this._redo);
    root.append(style, toolbar);
    this._render();
  }

  connectedCallback(): void {
    if (this._connected) return;
    this._connected = true;
    this._undo.addEventListener('click', this._requestUndo);
    this._redo.addEventListener('click', this._requestRedo);
    this._syncAttributes();
  }

  disconnectedCallback(): void {
    if (!this._connected) return;
    this._connected = false;
    this._undo.removeEventListener('click', this._requestUndo);
    this._redo.removeEventListener('click', this._requestRedo);
  }

  attributeChangedCallback(): void { this._syncAttributes(); }

  get canUndo(): boolean { return this._canUndo; }
  set canUndo(value: boolean) { this._canUndo = Boolean(value); this._reflectBoolean('can-undo', this._canUndo); this._render(); }
  get canRedo(): boolean { return this._canRedo; }
  set canRedo(value: boolean) { this._canRedo = Boolean(value); this._reflectBoolean('can-redo', this._canRedo); this._render(); }
  get undoLabel(): string { return this._undoLabel; }
  set undoLabel(value: string) { this._undoLabel = String(value); this._reflectString('undo-label', this._undoLabel); this._render(); }
  get redoLabel(): string { return this._redoLabel; }
  set redoLabel(value: string) { this._redoLabel = String(value); this._reflectString('redo-label', this._redoLabel); this._render(); }
  get busy(): boolean { return this._busy; }
  set busy(value: boolean) { this._busy = Boolean(value); this._reflectBoolean('busy', this._busy); this._render(); }
  get entries(): readonly HYHistoryEntry[] { return this._entries; }
  set entries(value: readonly HYHistoryEntry[]) {
    this._entries = Object.freeze(value.map(entry => Object.freeze({ id: entry.id, label: entry.label })));
  }

  private _syncAttributes(): void {
    this._canUndo = this.hasAttribute('can-undo');
    this._canRedo = this.hasAttribute('can-redo');
    this._busy = this.hasAttribute('busy');
    this._undoLabel = this.getAttribute('undo-label') ?? '';
    this._redoLabel = this.getAttribute('redo-label') ?? '';
    this._render();
  }

  private _render(): void {
    const chinese = (this.getAttribute('locale') ?? '').toLowerCase().startsWith('zh');
    const undo = chinese ? '撤销' : 'Undo';
    const redo = chinese ? '重做' : 'Redo';
    const undoTitle = this._undoLabel ? `${undo}: ${this._undoLabel}` : undo;
    const redoTitle = this._redoLabel ? `${redo}: ${this._redoLabel}` : redo;
    this._undo.disabled = this._busy || !this._canUndo;
    this._redo.disabled = this._busy || !this._canRedo;
    this._undo.title = undoTitle;
    this._redo.title = redoTitle;
    this._undo.setAttribute('aria-label', undoTitle);
    this._redo.setAttribute('aria-label', redoTitle);
    this.setAttribute('aria-busy', String(this._busy));
  }

  private _request(type: 'undo-request' | 'redo-request'): void {
    if (this._busy || (type === 'undo-request' ? !this._canUndo : !this._canRedo)) return;
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }));
  }

  private _reflectBoolean(name: string, value: boolean): void {
    if (value === this.hasAttribute(name)) return;
    this.toggleAttribute(name, value);
  }

  private _reflectString(name: string, value: string): void {
    if (this.getAttribute(name) === value) return;
    if (value) this.setAttribute(name, value); else this.removeAttribute(name);
  }
}

export function defineHistoryControlsComponents(): void {
  if (!customElements.get('hy-history-controls')) customElements.define('hy-history-controls', HYHistoryControls);
}
