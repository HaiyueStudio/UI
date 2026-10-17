import type { HYAccessibility, HYLayout } from '../../core/types.js';

export function attribute(element: Element, name: string, value: string | undefined): void {
  if (value === undefined) { if (element.hasAttribute(name)) element.removeAttribute(name); }
  else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}
export function flag(element: Element, name: string, value: boolean): void {
  if (element.hasAttribute(name) !== value) element.toggleAttribute(name, value);
}
export function deepActive(document: Document): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}
export function composedParent(element: Element): Element | null {
  return element.assignedSlot ?? element.parentElement ?? (element.getRootNode() instanceof ShadowRoot ? (element.getRootNode() as ShadowRoot).host : null);
}
export function visible(element: HTMLElement): boolean {
  if (!element.isConnected || !element.getClientRects().length) return false;
  let current: Element | null = element;
  while (current) {
    if (current instanceof HTMLElement && (current.hidden || current.inert)) return false;
    current = composedParent(current);
  }
  return getComputedStyle(element).visibility !== 'hidden';
}
export function focusable(root: Element | ShadowRoot): HTMLElement[] {
  const result: HTMLElement[] = [];
  const visit = (element: Element): void => {
    if (element instanceof HTMLElement && element.tabIndex >= 0 && !element.matches(':disabled') && visible(element)) result.push(element);
    if (element instanceof HTMLSlotElement) {
      for (const child of element.assignedElements({ flatten: true })) visit(child);
    } else {
      const children = element.shadowRoot?.children ?? element.children;
      for (const child of children) visit(child);
    }
  };
  for (const child of root.children) visit(child);
  return result;
}
export function captureFocus(document: Document): () => void {
  const active = deepActive(document);
  if (!(active instanceof HTMLElement)) return () => {};
  const input = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : null;
  const start = input?.selectionStart ?? null, end = input?.selectionEnd ?? null, direction = input?.selectionDirection ?? undefined;
  const value = input?.value;
  return () => {
    if (!visible(active) || active.matches(':disabled')) return;
    if (deepActive(document) !== active) active.focus({ preventScroll: true });
    // A new accepted value intentionally owns its new selection.
    if (input && input.value === value && start !== null && end !== null
      && (input.selectionStart !== start || input.selectionEnd !== end || input.selectionDirection !== direction)) input.setSelectionRange(start, end, direction);
  };
}
const logical = (value: number | 'auto' | undefined): string => value === undefined ? '' : typeof value === 'number' ? `${value}px` : value;
export function applyLayout(element: HTMLElement, layout: HYLayout = {}, overlayChild = false): void {
  const style = element.style;
  for (const name of ['width','height','minWidth','maxWidth','minHeight','maxHeight'] as const) style[name] = logical(layout[name]);
  style.padding = layout.padding?.map(v => `${v}px`).join(' ') ?? '';
  style.gap = logical(layout.gap);
  style.flexGrow = layout.grow === undefined ? '' : String(layout.grow);
  style.flexBasis = layout.grow ? '0px' : '';
  style.alignItems = layout.align === undefined ? '' : { start:'flex-start', center:'center', end:'flex-end', stretch:'stretch' }[layout.align];
  style.gridTemplateColumns = layout.columns?.map(track => typeof track === 'object' ? `minmax(0, ${track.grow}fr)` : logical(track)).join(' ') ?? '';
  style.gridTemplateRows = layout.rows?.map(track => typeof track === 'object' ? `minmax(0, ${track.grow}fr)` : logical(track)).join(' ') ?? '';
  style.gridRow = layout.row === undefined ? (overlayChild ? '1' : '') : String(layout.row + 1);
  style.gridColumn = layout.column === undefined ? (overlayChild ? '1' : '') : String(layout.column + 1);
  // Scroll owns its axis-specific overflow, including after insertion/reordering.
  if (element.dataset.hyKind !== 'Scroll') style.overflow = layout.clip === true ? 'hidden' : '';
}
export function applyAccessibility(element: HTMLElement, a11y: HYAccessibility | undefined): void {
  attribute(element,'aria-label',a11y?.label);
  attribute(element,'aria-description',a11y?.description);
  attribute(element,'aria-invalid',a11y?.error ? 'true' : undefined);
  // Actual semantic roles of native controls are preserved. A requested extra role belongs on generic containers.
}
