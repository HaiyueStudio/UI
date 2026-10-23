import { qrcodegen } from './internal/qrcodegen.js';

export type HYQRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type HYQRCodeStatus = 'empty' | 'ready' | 'error';
export interface HYQRCodeRenderDetail {
  readonly value: string;
  readonly version: number;
  readonly moduleCount: number;
  readonly errorCorrectionLevel: HYQRCodeErrorCorrectionLevel;
}
export interface HYQRCodeErrorDetail { readonly message: string; }
export interface HYQRCodeIconErrorDetail { readonly src: string; }

const levels = { L: qrcodegen.QrCode.Ecc.LOW, M: qrcodegen.QrCode.Ecc.MEDIUM, Q: qrcodegen.QrCode.Ecc.QUARTILE, H: qrcodegen.QrCode.Ecc.HIGH };
function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.floor(number))) : fallback;
}

/** Local SVG QR generation with a bounded decorative image or named icon slot. */
export class HYQRCode extends HTMLElement {
  private readonly _frame = document.createElement('div');
  private readonly _svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private readonly _background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  private readonly _modules = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  private readonly _iconFrame = document.createElement('div');
  private readonly _image = document.createElement('img');
  private readonly _slot = document.createElement('slot');
  private readonly _message = document.createElement('span');
  private _code: qrcodegen.QrCode | null = null;
  private _key = '';
  private _pathKey = '';
  private _lastIcon = '';
  private _iconReady = false;
  private _state: HYQRCodeStatus = 'empty';
  private _error = '';

  static get observedAttributes(): string[] {
    return ['value', 'size', 'color', 'background-color', 'margin', 'error-correction-level', 'icon', 'icon-size', 'icon-margin', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; max-width: 100%; vertical-align: middle; color: var(--hy-text-color, #eef0ff); font: 12px/1.5 system-ui, sans-serif; }
      :host([hidden]), [hidden] { display: none !important; }
      .frame { position: relative; box-sizing: border-box; max-width: 100%; aspect-ratio: 1; }
      svg { display: block; width: 100%; height: 100%; }
      .icon { position: absolute; box-sizing: border-box; inset: 50% auto auto 50%; transform: translate(-50%, -50%); display: grid; place-items: center; background: var(--_qr-background); border-radius: var(--hy-qr-code-icon-radius, 4px); pointer-events: none; overflow: hidden; }
      img { display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: contain; }
      slot { display: contents; }
      ::slotted([slot="icon"]) { display: block; box-sizing: border-box; width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: contain; overflow: hidden; }
      .message { position: absolute; inset: 0; display: grid; place-items: center; box-sizing: border-box; padding: 12px; text-align: center; color: var(--hy-secondary-text-color, #a9add4); background: var(--hy-surface-color, #10132f); border: 1px solid var(--hy-border-color, #343765); border-radius: var(--hy-qr-code-radius, 8px); }
    `;
    this._frame.className = 'frame'; this._frame.part.add('frame');
    this._svg.part.add('code'); this._svg.setAttribute('aria-hidden', 'true'); this._svg.setAttribute('shape-rendering', 'crispEdges');
    this._background.part.add('background'); this._modules.part.add('modules'); this._svg.append(this._background, this._modules);
    this._iconFrame.className = 'icon'; this._iconFrame.part.add('icon'); this._iconFrame.setAttribute('aria-hidden', 'true'); this._iconFrame.inert = true;
    this._image.alt = ''; this._image.draggable = false; this._image.part.add('icon-image');
    this._slot.name = 'icon'; this._iconFrame.append(this._slot, this._image);
    this._message.className = 'message'; this._message.part.add('message');
    this._frame.append(this._svg, this._iconFrame, this._message); root.append(style, this._frame);
    this._image.addEventListener('load', () => {
      if (!this.isConnected || !this._image.naturalWidth) return;
      this._iconReady = true; this._render();
    });
    this._image.addEventListener('error', () => {
      if (!this.isConnected || !this._lastIcon) return;
      this._iconReady = false; this._render();
      this.dispatchEvent(new CustomEvent<HYQRCodeIconErrorDetail>('qr-icon-error', { detail: { src: this._lastIcon }, bubbles: true, composed: true }));
    });
  }

  connectedCallback(): void { this._slot.addEventListener('slotchange', this._render); this._render(); }
  disconnectedCallback(): void {
    this._slot.removeEventListener('slotchange', this._render);
    this._lastIcon = ''; this._iconReady = false; this._image.removeAttribute('src');
  }
  attributeChangedCallback(): void { this._render(); }

  get value(): string { return this.getAttribute('value') ?? ''; }
  set value(value: string) { this.setAttribute('value', String(value ?? '')); }
  get size(): number { return integer(this.getAttribute('size'), 200, 64, 2048); }
  set size(value: number) { this.setAttribute('size', String(integer(value, 200, 64, 2048))); }
  get color(): string { return this.getAttribute('color') ?? ''; }
  set color(value: string) { this.setAttribute('color', value); }
  get backgroundColor(): string { return this.getAttribute('background-color') ?? ''; }
  set backgroundColor(value: string) { this.setAttribute('background-color', value); }
  /** Quiet zone in modules. At least four modules are retained. */
  get margin(): number { return integer(this.getAttribute('margin'), 4, 4, 16); }
  set margin(value: number) { this.setAttribute('margin', String(integer(value, 4, 4, 16))); }
  /** Defaults to H with an icon and M otherwise. An explicit level takes precedence. */
  get errorCorrectionLevel(): HYQRCodeErrorCorrectionLevel {
    const value = this.getAttribute('error-correction-level')?.toUpperCase();
    if (value === 'L' || value === 'M' || value === 'Q' || value === 'H') return value;
    return this.icon || this._hasSlotIcon() ? 'H' : 'M';
  }
  set errorCorrectionLevel(value: HYQRCodeErrorCorrectionLevel) { this.setAttribute('error-correction-level', value); }
  get icon(): string { return this.getAttribute('icon') ?? ''; }
  set icon(value: string) { this.setAttribute('icon', value ?? ''); }
  /** Requested image/slot size in CSS pixels. Actual coverage is bounded for readability. */
  get iconSize(): number { return integer(this.getAttribute('icon-size'), 32, 4, 512); }
  set iconSize(value: number) { this.setAttribute('icon-size', String(integer(value, 32, 4, 512))); }
  get iconMargin(): number { return integer(this.getAttribute('icon-margin'), 2, 0, 64); }
  set iconMargin(value: number) { this.setAttribute('icon-margin', String(integer(value, 2, 0, 64))); }
  get status(): HYQRCodeStatus { return this._state; }

  private _hasSlotIcon(): boolean {
    return this._slot.assignedNodes().some(node => node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()));
  }

  private _render = (): void => {
    if (!this.isConnected) return;
    const value = this.value; const level = this.errorCorrectionLevel;
    const key = JSON.stringify([value, level]); let generated = false; let failed = false;
    if (key !== this._key) {
      this._key = key; this._code = null; this._error = ''; this._state = value ? 'ready' : 'empty';
      if (value) {
        try {
          const bytes = new TextEncoder().encode(value);
          if (bytes.length > 7089) throw new RangeError('Value too long');
          const segments = /^[\x00-\x7f]*$/.test(value) ? qrcodegen.QrSegment.makeSegments(value) : [qrcodegen.QrSegment.makeEci(26), qrcodegen.QrSegment.makeBytes([...bytes])];
          this._code = qrcodegen.QrCode.encodeSegments(segments, levels[level], 1, 40, -1, false);
          generated = true;
        } catch {
          this._state = 'error'; this._error = 'This value is too long for the selected error correction level.'; failed = true;
        }
      }
    }
    const background = CSS.supports('color', this.backgroundColor) ? this.backgroundColor : 'var(--hy-qr-code-background-color, #ffffff)';
    const color = CSS.supports('color', this.color) ? this.color : 'var(--hy-qr-code-color, #111827)';
    this._frame.style.width = `${this.size}px`; this._frame.style.setProperty('--_qr-background', background);
    this._frame.dataset.state = this._state;
    this._svg.toggleAttribute('hidden', this._state !== 'ready');
    this._message.hidden = this._state === 'ready';
    this._message.textContent = this._state === 'error' ? this._error : 'Enter a value to generate a QR code.';
    this._message.setAttribute('role', this._state === 'error' ? 'alert' : 'status');
    if (this._state === 'ready') {
      this._frame.setAttribute('role', 'img'); this._frame.setAttribute('aria-label', this.getAttribute('aria-label') ?? 'QR code');
    } else { this._frame.removeAttribute('role'); this._frame.removeAttribute('aria-label'); }
    this._background.setAttribute('fill', background); this._modules.setAttribute('fill', color);

    const code = this._code; const pathKey = `${key}:${this.margin}`;
    if (!code) { this._modules.removeAttribute('d'); this._pathKey = ''; }
    else if (pathKey !== this._pathKey) {
      this._pathKey = pathKey;
      const extent = code.size + this.margin * 2;
      this._svg.setAttribute('viewBox', `0 0 ${extent} ${extent}`);
      this._background.setAttribute('width', String(extent)); this._background.setAttribute('height', String(extent));
      const path: string[] = [];
      for (let y = 0; y < code.size; y++) {
        for (let x = 0; x < code.size;) {
          if (!code.getModule(x, y)) { x++; continue; }
          const start = x; while (x < code.size && code.getModule(x, y)) x++;
          path.push(`M${start + this.margin},${y + this.margin}h${x - start}v1h-${x - start}z`);
        }
      }
      this._modules.setAttribute('d', path.join(''));
    }
    const slotted = this._hasSlotIcon(); const src = slotted || !code ? '' : this.icon;
    if (src !== this._lastIcon) {
      this._lastIcon = src; this._iconReady = false;
      if (src) this._image.src = src; else this._image.removeAttribute('src');
    }
    this._image.hidden = slotted || !src;
    this._iconFrame.hidden = !code || (!slotted && !this._iconReady);
    if (code) {
      // Include the backing margin in the coverage limit; percentages also
      // preserve that limit when max-width shrinks the rendered code.
      const coverage = Math.min(this.iconSize + this.iconMargin * 2, this.size * code.size / (code.size + this.margin * 2) * .2);
      const padding = Math.min(this.iconMargin, coverage / 4);
      this._iconFrame.style.width = this._iconFrame.style.height = `${coverage / this.size * 100}%`;
      this._iconFrame.style.padding = `${padding / this.size * 100}%`;
    }
    if (generated && code) this.dispatchEvent(new CustomEvent<HYQRCodeRenderDetail>('qr-render', {
      detail: { value, version: code.version, moduleCount: code.size, errorCorrectionLevel: level }, bubbles: true, composed: true,
    }));
    if (failed) this.dispatchEvent(new CustomEvent<HYQRCodeErrorDetail>('qr-error', { detail: { message: this._error }, bubbles: true, composed: true }));
  };
}

export function defineQRCodeComponents(): void {
  if (!customElements.get('hy-qr-code')) customElements.define('hy-qr-code', HYQRCode);
}
