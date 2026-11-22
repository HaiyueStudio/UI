import { hasSlotContent, presentationIcon } from './internal/presentation.js';

export type HYResultStatus = 'success' | 'info' | 'warning' | 'error' | '403' | '404' | '500';
const headings: Record<HYResultStatus, string> = { success: 'Completed', info: 'Information', warning: 'Please check', error: 'Something went wrong', '403': '403', '404': '404', '500': '500' };

/** Outcome page with semantic status, details and custom actions. */
export class HYResult extends HTMLElement {
  private readonly _surface = document.createElement('section');
  private readonly _icon = document.createElement('slot');
  private readonly _heading = document.createElement('slot');
  private readonly _description = document.createElement('slot');
  private readonly _content = document.createElement('slot');
  private readonly _extra = document.createElement('slot');
  static get observedAttributes(): string[] { return ['status', 'heading', 'description', 'aria-label']; }
  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #eef0ff); font: var(--hy-font-size-sm, 12px)/var(--hy-line-height-relaxed, 1.5) var(--hy-font-family, system-ui, sans-serif); }
      .result { display: flex; align-items: center; flex-direction: column; gap: var(--hy-space-6, 12px); padding: var(--hy-result-padding, var(--hy-space-16, 32px) var(--hy-space-10, 20px)); text-align: center; overflow-wrap: anywhere; }
      .icon { display: block; width: var(--hy-result-icon-size, 64px); max-width: 100%; color: var(--hy-result-status-color, var(--hy-info-color, #55b4da)); }
      .icon svg, .icon::slotted(*) { display: block; width: 100%; height: auto; }
      .icon.code { width: auto; font-size: var(--hy-result-code-size, 64px); font-weight: var(--hy-font-weight-bold, 700); line-height: var(--hy-line-height-compact, 1.2); }
      .success { --hy-result-status-color: var(--hy-success-color, #51b88b); } .warning { --hy-result-status-color: var(--hy-warning-color, #e1b952); } .error { --hy-result-status-color: var(--hy-error-color, #e47689); }
      h2 { max-width: 100%; margin: 0; font-size: var(--hy-font-size-2xl, 24px); font-weight: var(--hy-font-weight-semibold, 600); }
      .description { display: block; max-width: 64ch; color: var(--hy-secondary-text-color, #a9add4); }
      .content { display: block; width: 100%; box-sizing: border-box; padding: var(--hy-space-8, 16px); border-radius: var(--hy-radius-md, 6px); color: var(--hy-secondary-text-color, #a9add4); background: var(--hy-surface-color, #10132f); text-align: start; }
      .extra { display: flex; justify-content: center; flex-wrap: wrap; gap: var(--hy-space-4, 8px); max-width: 100%; }
      [hidden] { display: none !important; }
    `;
    this._surface.className = 'result'; this._surface.part.add('result'); this._surface.setAttribute('aria-labelledby', 'result-heading');
    this._icon.name = 'icon'; this._icon.className = 'icon'; this._icon.part.add('icon'); this._icon.setAttribute('aria-hidden', 'true');
    const heading = document.createElement('h2'); heading.id = 'result-heading'; heading.part.add('heading'); this._heading.name = 'heading'; heading.append(this._heading);
    this._description.name = 'description'; this._description.className = 'description'; this._description.part.add('description');
    this._content.className = 'content'; this._content.part.add('content');
    this._extra.name = 'extra'; this._extra.className = 'extra'; this._extra.part.add('extra');
    this._surface.append(this._icon, heading, this._description, this._content, this._extra); root.append(style, this._surface);
    for (const slot of [this._description, this._content, this._extra]) slot.addEventListener('slotchange', this._render);
  }
  connectedCallback(): void { this._render(); }
  attributeChangedCallback(): void { this._render(); }
  get status(): HYResultStatus { const value = this.getAttribute('status') as HYResultStatus; return Object.hasOwn(headings, value) ? value : 'info'; }
  set status(value: HYResultStatus) { this.setAttribute('status', value); }
  get heading(): string { return this.getAttribute('heading') ?? headings[this.status]; }
  set heading(value: string) { this.setAttribute('heading', value); }
  get description(): string { return this.getAttribute('description') ?? ''; }
  set description(value: string) { this.setAttribute('description', value); }
  private _render = (): void => {
    const status = this.status; const code = /^\d/.test(status);
    this._surface.className = `result ${code ? 'info' : status}`;
    this._icon.className = code ? 'icon code' : 'icon';
    this._icon.replaceChildren(code ? document.createTextNode(status) : presentationIcon(status as 'success' | 'info' | 'warning' | 'error'));
    if (this._heading.textContent !== this.heading) this._heading.textContent = this.heading;
    if (this._description.textContent !== this.description) this._description.textContent = this.description;
    this._description.hidden = !this.description && !hasSlotContent(this._description);
    this._content.hidden = !hasSlotContent(this._content); this._extra.hidden = !hasSlotContent(this._extra);
    const label = this.getAttribute('aria-label');
    if (label) { this._surface.setAttribute('aria-label', label); this._surface.removeAttribute('aria-labelledby'); }
    else { this._surface.removeAttribute('aria-label'); this._surface.setAttribute('aria-labelledby', 'result-heading'); }
  };
}
export function defineResultComponents(): void { if (!customElements.get('hy-result')) customElements.define('hy-result', HYResult); }
