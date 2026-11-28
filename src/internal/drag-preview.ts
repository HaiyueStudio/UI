import { focusedElement } from './focus.js';

export interface HYDragPreview { readonly element: HTMLElement; readonly placeholder?: HTMLElement; move(x: number, y: number): void; destroy(): void; }
export interface HYDragPoint { x: number; y: number; }
const snapshotScroll = new WeakMap<Element, { top: number; left: number }>();

function setStyle(element: HTMLElement | SVGElement, property: string, value: string): void {
  element.style.setProperty(property, value, 'important');
}

function generatedContent(source: Element, pseudo: '::before' | '::after'): HTMLElement | null {
  const style = getComputedStyle(source, pseudo); const content = style.content;
  if (content === 'none' || content === 'normal' || style.display === 'none') return null;
  const element = source.ownerDocument.createElement('span');
  for (const property of style) element.style.setProperty(property, style.getPropertyValue(property), 'important');
  if (content.startsWith('"') && content.endsWith('"')) {
    try { element.textContent = JSON.parse(content) as string; }
    catch { element.textContent = content.slice(1, -1).replace(/\\([\da-f]{1,6})\s?|\\(.)/giu, (_, hex: string | undefined, escaped: string | undefined) => hex ? String.fromCodePoint(Math.min(0x10ffff, Number.parseInt(hex, 16))) : escaped ?? ''); }
  }
  setStyle(element, 'pointer-events', 'none'); return element;
}

/** A visual snapshot never upgrades custom elements or copies interactive IDs/listeners. */
function snapshot(source: Element): HTMLElement | SVGElement {
  const document = source.ownerDocument;
  const custom = source.localName.includes('-') || ['slot', 'iframe', 'object', 'embed', 'video', 'audio'].includes(source.localName);
  const clone = (custom ? document.createElement('div') : document.createElementNS(source.namespaceURI, source.localName)) as HTMLElement | SVGElement;
  for (const attribute of source.attributes) {
    if (/^(?:id|name|class|slot|for|form|autofocus|popover|tabindex|on.*|aria-.*|data-hy-.*)$/iu.test(attribute.name)) continue;
    clone.setAttribute(attribute.name, attribute.value);
  }
  const style = getComputedStyle(source);
  for (const property of style) clone.style.setProperty(property, style.getPropertyValue(property), 'important');
  setStyle(clone, 'pointer-events', 'none'); setStyle(clone, 'animation', 'none'); setStyle(clone, 'transition', 'none');
  const before = generatedContent(source, '::before'); if (before) clone.append(before);
  if (source instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
    if (source.type !== 'file') clone.value = source.value;
    clone.checked = source.checked; clone.indeterminate = source.indeterminate; clone.disabled = true;
  } else if (source instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) { clone.value = source.value; clone.disabled = true; }
  else if (clone instanceof HTMLButtonElement || clone instanceof HTMLSelectElement) clone.disabled = true;
  if (source instanceof HTMLCanvasElement && clone instanceof HTMLCanvasElement) {
    clone.width = source.width; clone.height = source.height;
    try { clone.getContext('2d')?.drawImage(source, 0, 0); } catch { /* An unavailable canvas still keeps its dimensions. */ }
  } else if (!['iframe', 'object', 'embed', 'video', 'audio'].includes(source.localName)) {
    const children = source instanceof HTMLSlotElement ? source.assignedNodes({ flatten: true }) : [...(source.shadowRoot ?? source).childNodes];
    for (const node of children.length ? children : source.childNodes) {
      if (node instanceof Text) clone.append(document.createTextNode(node.data));
      else if (node instanceof Element && !['style', 'script', 'template', 'link', 'meta'].includes(node.localName) && getComputedStyle(node).display !== 'none') clone.append(snapshot(node));
    }
  }
  if (source instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) clone.selectedIndex = source.selectedIndex;
  const after = generatedContent(source, '::after'); if (after) clone.append(after);
  if (source.scrollTop || source.scrollLeft) snapshotScroll.set(clone, { top: source.scrollTop, left: source.scrollLeft });
  return clone;
}

function layer(source: HTMLElement, content: Node, mode: string, opacity: number): HTMLElement {
  const element = source.ownerDocument.createElement('div');
  element.dataset.hyDragPreview = mode; element.part.add('preview'); element.inert = true; element.setAttribute('aria-hidden', 'true');
  const rules: Record<string, string> = {
    position: 'fixed', inset: 'auto', left: '0', top: '0', margin: '0', padding: '0', border: '0',
    background: 'transparent', color: 'inherit', overflow: 'visible', 'pointer-events': 'none',
    'z-index': '2147483000', opacity: String(opacity), width: 'max-content', height: 'auto',
  };
  for (const [property, value] of Object.entries(rules)) setStyle(element, property, value);
  element.append(content); element.popover = 'manual'; (source.shadowRoot ?? source.ownerDocument.body).append(element);
  try { element.showPopover(); } catch { element.removeAttribute('popover'); }
  return element;
}

function following(element: HTMLElement, offset: HYDragPoint): HYDragPreview {
  return {
    element,
    move: (x, y) => { setStyle(element, 'left', `${x - offset.x}px`); setStyle(element, 'top', `${y - offset.y}px`); },
    destroy: () => element.remove(),
  };
}

export function textDragPreview(source: HTMLElement, opacity = 1): HYDragPreview {
  const text = source.ownerDocument.createElement('div'); const style = getComputedStyle(source);
  const label = [...source.childNodes].filter(node => !(node instanceof Element) || !node.getAttribute('slot')).map(node => node.textContent ?? '').join('').trim();
  text.textContent = source.getAttribute('aria-label') || label.slice(0, 100) || 'Dragging';
  text.style.cssText = 'padding:8px 12px;max-width:280px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border:1px solid;box-shadow:0 8px 24px #0003;';
  text.style.color = style.getPropertyValue('--hy-text-color') || style.color;
  text.style.background = style.getPropertyValue('--hy-surface-elevated-color') || '#171d27';
  text.style.borderColor = style.getPropertyValue('--hy-border-color') || '#3d4654';
  text.style.borderRadius = style.getPropertyValue('--hy-radius-md') || '6px'; text.style.font = style.font;
  return following(layer(source, text, 'text', opacity), { x: -12, y: -12 });
}

export function cloneDragPreview(source: HTMLElement, origin: HYDragPoint, opacity: number): HYDragPreview {
  const rect = source.getBoundingClientRect(); const clone = previewSnapshot(source);
  setStyle(clone, 'margin', '0'); setStyle(clone, 'position', 'absolute'); setStyle(clone, 'inset', 'auto');
  setStyle(clone, 'left', '0'); setStyle(clone, 'top', '0');
  const element = layer(source, clone, 'clone', opacity);
  setStyle(element, 'width', `${rect.width}px`); setStyle(element, 'height', `${rect.height}px`);
  const bounds = clone.getBoundingClientRect();
  setStyle(clone, 'left', `${-bounds.left}px`); setStyle(clone, 'top', `${-bounds.top}px`);
  const preview = following(element, { x: origin.x - rect.left, y: origin.y - rect.top }); preview.move(origin.x, origin.y);
  return preview;
}

export function customDragPreview(source: HTMLElement, content: HTMLElement, origin: HYDragPoint, opacity: number): HYDragPreview {
  const element = layer(source, content, 'custom', opacity);
  const preview = following(element, { x: -12, y: -12 }); preview.move(origin.x, origin.y);
  return preview;
}

export function previewSnapshot(source: HTMLElement): HTMLElement {
  const root = snapshot(source) as HTMLElement;
  queueMicrotask(() => {
    if (!root.isConnected) return;
    for (const element of [root, ...root.querySelectorAll('*')]) {
      const position = snapshotScroll.get(element);
      if (position) { element.scrollTop = position.top; element.scrollLeft = position.left; }
    }
  });
  return root;
}

/** Lift the real source through the top layer, retaining its DOM parent and component state. */
export function liveDragPreview(source: HTMLElement, origin: HYDragPoint, opacity: number, sourceOpacity: number): HYDragPreview {
  if (typeof source.showPopover !== 'function') return cloneDragPreview(source, origin, opacity);
  const document = source.ownerDocument; const rect = source.getBoundingClientRect(); const style = getComputedStyle(source);
  const placeholder = previewSnapshot(source); placeholder.dataset.hyDragPlaceholder = ''; placeholder.slot = source.slot;
  placeholder.inert = true; placeholder.setAttribute('aria-hidden', 'true'); setStyle(placeholder, 'opacity', String(sourceOpacity));
  const oldPopover = source.getAttribute('popover'); const wasOpen = source.matches(':popover-open');
  const hadStyle = source.hasAttribute('style');
  const oldMarker = source.getAttribute('data-hy-live-drag'); const oldPreview = source.getAttribute('data-hy-drag-preview');
  const styles = new Map<string, { original: string; priority: string; value: string }>();
  const own = (property: string, value: string): void => {
    const previous = styles.get(property);
    const original = previous?.original ?? source.style.getPropertyValue(property); const priority = previous?.priority ?? source.style.getPropertyPriority(property);
    setStyle(source, property, value);
    styles.set(property, { original, priority, value: source.style.getPropertyValue(property) });
  };
  let opened = false; let destroyed = false;
  const restoreAttribute = (name: string, value: string | null): void => { if (value === null) source.removeAttribute(name); else source.setAttribute(name, value); };
  const destroy = (): void => {
    if (destroyed) return; destroyed = true;
    const focused = focusedElement(document);
    if (opened && source.matches(':popover-open')) source.hidePopover();
    restoreAttribute('popover', oldPopover); restoreAttribute('data-hy-live-drag', oldMarker); restoreAttribute('data-hy-drag-preview', oldPreview);
    for (const [property, saved] of styles) {
      if (source.style.getPropertyValue(property) === saved.value && source.style.getPropertyPriority(property) === 'important') {
        if (saved.original) source.style.setProperty(property, saved.original, saved.priority); else source.style.removeProperty(property);
      }
    }
    if (!hadStyle && !source.style.length) source.removeAttribute('style');
    placeholder.remove();
    if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
  };
  try {
    // Freeze UA popover defaults before adding the attribute, without freezing unrelated app styles.
    const frozen = ['display', 'box-sizing', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'background-color', 'color', 'overflow-x', 'overflow-y', 'transform', 'transform-origin',
      ...['top', 'right', 'bottom', 'left'].flatMap(side => [`padding-${side}`, `border-${side}-width`, `border-${side}-style`, `border-${side}-color`])].map(property => [property, style.getPropertyValue(property)] as const);
    const originalOpacity = Number(style.opacity);
    source.after(placeholder);
    for (const [property, value] of frozen) own(property, value);
    for (const side of ['top', 'right', 'bottom', 'left']) own(`margin-${side}`, '0px');
    own('position', 'fixed'); own('right', 'auto'); own('bottom', 'auto'); own('left', `${rect.left}px`); own('top', `${rect.top}px`);
    own('pointer-events', 'none'); own('z-index', '2147483000'); own('opacity', String(originalOpacity * opacity));
    source.setAttribute('data-hy-live-drag', ''); source.dataset.hyDragPreview = 'move';
    if (!wasOpen) { source.popover = 'manual'; source.showPopover(); opened = source.matches(':popover-open'); if (!opened) throw new Error('Popover opening cancelled'); }
    const bounds = source.getBoundingClientRect(); const left = rect.left + rect.left - bounds.left; const top = rect.top + rect.top - bounds.top;
    own('left', `${left}px`); own('top', `${top}px`);
    return { element: source, placeholder, move: (x, y) => { own('left', `${left + x - origin.x}px`); own('top', `${top + y - origin.y}px`); }, destroy };
  } catch {
    destroy(); return cloneDragPreview(source, origin, opacity);
  }
}
