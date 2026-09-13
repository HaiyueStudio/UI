export type HYExpandableButtonPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
export interface HYExpandableChangeDetail { expanded: boolean }

/** A non-modal, top-layer expansion of the same slotted content; no cloning or reparenting. */
export class HYExpandable extends HTMLElement {
  static get observedAttributes(): string[] { return ['expanded', 'expanded-width', 'expanded-height', 'button-position', 'expand-label', 'restore-label']; }
  private readonly panel: HTMLDivElement;
  private readonly placeholder: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly expandIcon: HTMLSlotElement;
  private readonly restoreIcon: HTMLSlotElement;
  private lifetime: AbortController | undefined;
  private active = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display:block; position:relative; min-width:0; min-height:0; }
      .placeholder { display:none; pointer-events:none; }
      .panel { position:relative; display:grid; grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr); width:100%; height:100%; min-width:0; min-height:0; box-sizing:border-box; color:inherit; font:inherit; }
      .panel:popover-open { position:fixed; inset:0; margin:auto; width:var(--_width,90vw); height:var(--_height,90dvh); max-width:calc(100vw - 2 * var(--hy-expandable-margin,16px)); max-height:calc(100dvh - 2 * var(--hy-expandable-margin,16px)); padding:var(--hy-expandable-padding,16px); border:1px solid var(--hy-border-color,#536074); border-radius:var(--hy-expandable-radius,10px); background:var(--hy-surface-color,#18202e); box-shadow:var(--hy-expandable-shadow,0 16px 64px #0006); }
      .panel::backdrop { background:transparent; pointer-events:none; }
      button { position:absolute; z-index:2; top:var(--hy-expandable-button-offset,8px); right:var(--hy-expandable-button-offset,8px); display:grid; place-items:center; width:var(--hy-expandable-button-size,32px); height:var(--hy-expandable-button-size,32px); padding:6px; border:1px solid var(--hy-border-color,#536074); border-radius:6px; color:var(--hy-text-color,inherit); background:var(--hy-surface-color,#18202e); cursor:pointer; }
      button:hover { color:var(--hy-accent-color,#7dd3fc); }
      button:focus-visible { outline:2px solid var(--hy-accent-color,#7dd3fc); outline-offset:2px; }
      button[data-position$="left"] { left:var(--hy-expandable-button-offset,8px); right:auto; }
      button[data-position^="bottom"] { bottom:var(--hy-expandable-button-offset,8px); top:auto; }
      svg, ::slotted([slot="expand-icon"]), ::slotted([slot="restore-icon"]) { width:100%; height:100%; pointer-events:none; }
      slot[hidden] { display:none; }
    `;
    this.placeholder = document.createElement('div'); this.placeholder.className = 'placeholder';
    this.panel = document.createElement('div'); this.panel.className = 'panel'; this.panel.id = 'panel'; this.panel.part.add('panel');
    this.button = document.createElement('button'); this.button.type = 'button'; this.button.part.add('toggle'); this.button.setAttribute('aria-controls', 'panel');
    const icon = (name: string, path: string): HTMLSlotElement => {
      const slot = document.createElement('slot'); slot.name = name; slot.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
      const shape = document.createElementNS(svg.namespaceURI, 'path'); shape.setAttribute('d', path); svg.append(shape); slot.append(svg); return slot;
    };
    this.expandIcon = icon('expand-icon', 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6');
    this.restoreIcon = icon('restore-icon', 'M3 9h6V3m6 0v6h6M9 21v-6H3m18 0h-6v6M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6');
    this.button.append(this.expandIcon, this.restoreIcon);
    this.panel.append(document.createElement('slot'), this.button); root.append(style, this.placeholder, this.panel);
    this.button.addEventListener('click', () => this.toggle());
    this.render();
  }
  get expanded(): boolean { return this.hasAttribute('expanded'); }
  set expanded(value: boolean) { this.toggleAttribute('expanded', Boolean(value)); }
  get expandedWidth(): string { return this.getAttribute('expanded-width') ?? '90vw'; }
  set expandedWidth(value: string) { this.setAttribute('expanded-width', value); }
  get expandedHeight(): string { return this.getAttribute('expanded-height') ?? '90dvh'; }
  set expandedHeight(value: string) { this.setAttribute('expanded-height', value); }
  get buttonPosition(): HYExpandableButtonPosition {
    const value = this.getAttribute('button-position');
    return (['top-left', 'bottom-right', 'bottom-left'].includes(value ?? '') ? value : 'top-right') as HYExpandableButtonPosition;
  }
  set buttonPosition(value: HYExpandableButtonPosition) { this.setAttribute('button-position', value); }
  toggle(): void { this.expanded = !this.expanded; }
  connectedCallback(): void {
    this.lifetime?.abort(); this.lifetime = new AbortController();
    this.ownerDocument.addEventListener('keydown', event => {
      // Let nested popovers/menus handle Escape first. Independent expanded containers only close when focused.
      if (event.key === 'Escape' && !event.defaultPrevented && this.active && (this.contains(this.ownerDocument.activeElement) || this.ownerDocument.activeElement === this)) {
        event.preventDefault(); this.expanded = false; this.button.focus({ preventScroll: true });
      }
    }, { signal: this.lifetime.signal });
    queueMicrotask(() => { if (this.isConnected) this.sync(); });
  }
  disconnectedCallback(): void {
    this.lifetime?.abort(); this.lifetime = undefined;
    this.closePanel(); // Attribute remains available if the owner reconnects this element.
  }
  attributeChangedCallback(): void { this.render(); if (this.isConnected) this.sync(); }
  private render(): void {
    for (const [name, value] of [['width', this.expandedWidth], ['height', this.expandedHeight]]) {
      this.panel.style.removeProperty(`--_${name}`);
      if (CSS.supports(name!, value!)) this.panel.style.setProperty(`--_${name}`, value!);
    }
    this.button.dataset.position = this.buttonPosition;
    this.button.setAttribute('aria-expanded', String(this.expanded));
    const label = this.getAttribute(this.expanded ? 'restore-label' : 'expand-label') ?? (this.expanded ? 'Restore size' : 'Expand');
    this.button.setAttribute('aria-label', label); this.button.title = label;
    this.expandIcon.hidden = this.expanded; this.restoreIcon.hidden = !this.expanded;
  }
  private sync(): void {
    if (this.expanded === this.active) return;
    if (this.expanded) {
      this.placeholder.style.height = `${this.getBoundingClientRect().height}px`;
      this.placeholder.style.display = 'block';
      this.panel.setAttribute('popover', 'manual'); this.panel.showPopover(); this.active = true;
    } else this.closePanel();
    this.dispatchEvent(new CustomEvent<HYExpandableChangeDetail>('expanded-change', { detail: { expanded: this.active }, bubbles: true, composed: true }));
  }
  private closePanel(): void {
    if (this.panel.matches(':popover-open')) this.panel.hidePopover();
    this.panel.removeAttribute('popover'); this.placeholder.style.display = 'none'; this.active = false;
  }
}
export function defineExpandableComponents(): void {
  if (!customElements.get('hy-expandable')) customElements.define('hy-expandable', HYExpandable);
}
