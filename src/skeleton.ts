export type HYSkeletonAvatarShape = 'circle' | 'square';
export type HYSkeletonSize = 'small' | 'medium' | 'large';

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeWidth(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return /^\d+(?:\.\d+)?(?:%|px|rem|em|ch|vw)$/u.test(text) ? text : fallback;
}

/** Theme-aware loading placeholder that swaps to slotted content when ready. */
export class HYSkeleton extends HTMLElement {
  private readonly _placeholder = document.createElement('div');
  private readonly _content = document.createElement('div');
  private readonly _slot = document.createElement('slot');
  private _paragraphWidths: readonly string[] = [];

  static get observedAttributes(): string[] {
    return ['loading', 'active', 'avatar', 'avatar-shape', 'avatar-size', 'show-title', 'title-width', 'show-paragraph', 'rows', 'round', 'size', 'aria-label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; font: 12px/1.4 system-ui, sans-serif; }
      .placeholder { display: flex; min-width: 0; align-items: flex-start; gap: var(--hy-skeleton-gap, 14px); }
      .placeholder[hidden], .content[hidden] { display: none; }
      .body { flex: 1; min-width: 0; padding-top: var(--hy-skeleton-body-offset, 2px); }
      .block { position: relative; overflow: hidden; background: var(--hy-skeleton-color, color-mix(in srgb, var(--hy-text-color, #eef3ff) 11%, transparent)); }
      .avatar { flex: 0 0 auto; width: var(--_avatar-size); height: var(--_avatar-size); border-radius: 50%; }
      :host([avatar-shape="square"]) .avatar { border-radius: var(--hy-skeleton-avatar-radius, 7px); }
      .title { height: var(--hy-skeleton-title-height, 15px); margin-bottom: var(--hy-skeleton-title-gap, 17px); border-radius: var(--hy-skeleton-radius, 5px); }
      .paragraph { display: grid; gap: var(--hy-skeleton-row-gap, 11px); }
      .row { height: var(--hy-skeleton-row-height, 11px); border-radius: var(--hy-skeleton-radius, 5px); }
      :host([round]) .title, :host([round]) .row { border-radius: 999px; }
      :host([size="small"]) { --hy-skeleton-title-height: 12px; --hy-skeleton-row-height: 8px; --hy-skeleton-row-gap: 9px; --hy-skeleton-gap: 11px; }
      :host([size="large"]) { --hy-skeleton-title-height: 18px; --hy-skeleton-row-height: 14px; --hy-skeleton-row-gap: 13px; --hy-skeleton-gap: 17px; }
      :host([active]) .block::after { position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, var(--hy-skeleton-highlight-color, color-mix(in srgb, var(--hy-text-color, #eef3ff) 12%, transparent)) 45%, transparent 85%); content: ''; transform: translateX(-100%); animation: hy-skeleton-wave var(--hy-skeleton-duration, 1.5s) ease-in-out infinite; }
      @keyframes hy-skeleton-wave { to { transform: translateX(100%); } }
      @media (prefers-reduced-motion: reduce) { :host([active]) .block::after { animation: none; } }
    `;
    this._placeholder.className = 'placeholder'; this._placeholder.part.add('placeholder'); this._placeholder.setAttribute('aria-hidden', 'true');
    this._content.className = 'content'; this._content.part.add('content'); this._content.append(this._slot);
    root.append(style, this._placeholder, this._content);
  }

  connectedCallback(): void { this._render(); }
  attributeChangedCallback(): void { this._render(); }

  /** Defaults to true. Set to false to reveal the default slot. */
  get loading(): boolean { return this.getAttribute('loading') !== 'false'; }
  set loading(value: boolean) { this.setAttribute('loading', String(Boolean(value))); }
  get active(): boolean { return this.hasAttribute('active'); }
  set active(value: boolean) { this.toggleAttribute('active', Boolean(value)); }
  get avatar(): boolean { return this.hasAttribute('avatar'); }
  set avatar(value: boolean) { this.toggleAttribute('avatar', Boolean(value)); }
  get avatarShape(): HYSkeletonAvatarShape { return this.getAttribute('avatar-shape') === 'square' ? 'square' : 'circle'; }
  set avatarShape(value: HYSkeletonAvatarShape) { this.setAttribute('avatar-shape', value === 'square' ? 'square' : 'circle'); }
  get avatarSize(): number { return clampInteger(this.getAttribute('avatar-size'), 44, 16, 160); }
  set avatarSize(value: number) { this.setAttribute('avatar-size', String(clampInteger(value, 44, 16, 160))); }
  get showTitle(): boolean { return this.getAttribute('show-title') !== 'false'; }
  set showTitle(value: boolean) { this.setAttribute('show-title', String(Boolean(value))); }
  get titleWidth(): string { return normalizeWidth(this.getAttribute('title-width'), '38%'); }
  set titleWidth(value: string) { this.setAttribute('title-width', normalizeWidth(value, '38%')); }
  get showParagraph(): boolean { return this.getAttribute('show-paragraph') !== 'false'; }
  set showParagraph(value: boolean) { this.setAttribute('show-paragraph', String(Boolean(value))); }
  get rows(): number { return clampInteger(this.getAttribute('rows'), 3, 0, 20); }
  set rows(value: number) { this.setAttribute('rows', String(clampInteger(value, 3, 0, 20))); }
  get round(): boolean { return this.hasAttribute('round'); }
  set round(value: boolean) { this.toggleAttribute('round', Boolean(value)); }
  get size(): HYSkeletonSize {
    const value = this.getAttribute('size'); return value === 'small' || value === 'large' ? value : 'medium';
  }
  set size(value: HYSkeletonSize) { this.setAttribute('size', value === 'small' || value === 'large' ? value : 'medium'); }
  get paragraphWidths(): readonly string[] { return this._paragraphWidths; }
  set paragraphWidths(value: readonly string[]) {
    this._paragraphWidths = Array.isArray(value) ? value.map(width => normalizeWidth(width, '100%')) : [];
    this._render();
  }

  private _render(): void {
    const loading = this.loading;
    this.setAttribute('aria-busy', String(loading));
    this.setAttribute('role', 'status');
    if (!this.hasAttribute('aria-live')) this.setAttribute('aria-live', 'polite');
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Loading');
    this._placeholder.hidden = !loading; this._content.hidden = loading;
    if (!loading) { this._placeholder.replaceChildren(); return; }
    const body = document.createElement('div'); body.className = 'body'; body.part.add('body');
    if (this.showTitle) { const title = document.createElement('div'); title.className = 'block title'; title.part.add('title'); title.style.width = this.titleWidth; body.append(title); }
    if (this.showParagraph && this.rows > 0) {
      const paragraph = document.createElement('div'); paragraph.className = 'paragraph'; paragraph.part.add('paragraph');
      for (let index = 0; index < this.rows; index += 1) { const row = document.createElement('div'); row.className = 'block row'; row.part.add('row'); row.style.width = this._rowWidth(index); paragraph.append(row); }
      body.append(paragraph);
    }
    const children: HTMLElement[] = [];
    if (this.avatar) { const avatar = document.createElement('div'); avatar.className = 'block avatar'; avatar.part.add('avatar'); avatar.style.setProperty('--_avatar-size', `${this.avatarSize}px`); children.push(avatar); }
    if (body.childElementCount) children.push(body);
    this._placeholder.replaceChildren(...children);
  }

  private _rowWidth(index: number): string {
    const configured = this._paragraphWidths[index];
    if (configured) return configured;
    return index === this.rows - 1 && this.rows > 1 ? '68%' : '100%';
  }
}

export function defineSkeletonComponents(): void {
  if (!customElements.get('hy-skeleton')) customElements.define('hy-skeleton', HYSkeleton);
}
