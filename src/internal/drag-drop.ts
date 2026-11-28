import { focusedElement } from './focus.js';
import { isKeyboardControlEvent } from './keyboard.js';
import { textDragPreview } from './drag-preview.js';
import type { HYDragPreview } from './drag-preview.js';

export interface HYDragPayload {
  readonly type: string;
  readonly data: unknown;
  readonly source: HTMLElement;
  readonly effect: 'copy' | 'move';
  readonly input: 'pointer' | 'keyboard';
}

export interface HYDragEndDetail extends HYDragPayload {
  readonly target: HTMLElement | null;
  readonly accepted: boolean;
  readonly cancelled: boolean;
}

export interface HYDropTarget {
  element: HTMLElement;
  accepts(payload: HYDragPayload): boolean;
  over(payload: HYDragPayload, point: { x: number; y: number } | null): void;
  leave(payload: HYDragPayload): void;
  drop(payload: HYDragPayload): boolean;
}

interface Session {
  payload: HYDragPayload;
  target: HYDropTarget | null;
  abort: AbortController;
  preview: HYDragPreview | null;
  frame: number | null;
  point: { x: number; y: number } | null;
  end(detail: HYDragEndDetail): void;
}
interface Context { targets: Set<HYDropTarget>; session: Session | null; }
const contexts = new WeakMap<Document, Context>();

function context(document: Document): Context {
  let value = contexts.get(document);
  if (!value) { value = { targets: new Set(), session: null }; contexts.set(document, value); }
  return value;
}

export function composedContains(parent: Element, child: Node | null): boolean {
  while (child) {
    if (child === parent) return true;
    child = child instanceof Element && child.assignedSlot ? child.assignedSlot : child.parentNode ?? (child instanceof ShadowRoot ? child.host : null);
  }
  return false;
}

function targetFor(document: Document, hit: Element | null): HYDropTarget | null {
  const state = context(document);
  if (!state.session) return null;
  let found: HYDropTarget | null = null;
  for (const target of state.targets) {
    if (target.element.isConnected && composedContains(target.element, hit) && target.accepts(state.session.payload) &&
      (!found || composedContains(found.element, target.element))) found = target;
  }
  return found;
}

export function registerDropTarget(target: HYDropTarget): () => void {
  const state = context(target.element.ownerDocument);
  state.targets.add(target);
  return () => {
    state.targets.delete(target);
    if (state.session?.target === target) {
      const session = state.session; session.target = null; target.leave(session.payload);
    }
  };
}

export function activeDrag(document: Document): HYDragPayload | null { return context(document).session?.payload ?? null; }

function setTarget(document: Document, target: HYDropTarget | null, point: { x: number; y: number } | null): void {
  const session = context(document).session;
  if (!session) return;
  if (session.target !== target) {
    const previous = session.target;
    session.target = target;
    previous?.leave(session.payload);
  }
  if (context(document).session === session) target?.over(session.payload, point);
}

export function beginDrag(payload: HYDragPayload, end: (detail: HYDragEndDetail) => void, createPreview?: () => HYDragPreview | null): boolean {
  const document = payload.source.ownerDocument;
  const state = context(document);
  if (state.session || !payload.source.isConnected) return false;
  const abort = new AbortController();
  const session: Session = { payload, target: null, abort, preview: null, frame: null, point: null, end };
  state.session = session;
  if (payload.input === 'pointer') {
    let preview: HYDragPreview | null;
    try { preview = createPreview ? createPreview() : textDragPreview(payload.source); }
    catch { finishDrag(document, true); return false; }
    if (state.session !== session) { preview?.destroy(); return false; }
    session.preview = preview;
  }
  const { signal } = abort;
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') { event.preventDefault(); finishDrag(document, true); }
    else if (payload.input === 'keyboard' && (event.key === 'Enter' || event.key === ' ') &&
      !isKeyboardControlEvent(event, session.target?.element ?? payload.source)) {
      event.preventDefault(); finishDrag(document);
    }
  }, { signal });
  document.addEventListener('focusin', () => {
    if (payload.input === 'keyboard') setTarget(document, targetFor(document, focusedElement(document)), null);
  }, { signal });
  document.defaultView?.addEventListener('blur', () => finishDrag(document, true), { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finishDrag(document, true); }, { signal });
  if (payload.input === 'keyboard') setTarget(document, targetFor(document, focusedElement(document)), null);
  return true;
}

export function moveDrag(document: Document, x: number, y: number): void {
  const session = context(document).session;
  if (!session) return;
  session.point = { x, y };
  session.preview?.move(x, y);
  const ignored = session.preview?.element;
  const atPoint = (root: Document | ShadowRoot): Element | null => root.elementsFromPoint(x, y).find(element => !ignored || !composedContains(ignored, element)) ?? null;
  let hit = atPoint(document);
  for (;;) {
    const nested = hit?.shadowRoot ? atPoint(hit.shadowRoot) : null;
    if (!nested || nested === hit || !composedContains(hit!, nested)) break;
    hit = nested;
  }
  setTarget(document, targetFor(document, hit), { x, y });
  if (context(document).session === session && scrollAtEdge(document, hit, x, y) && session.frame === null) {
    session.frame = document.defaultView!.requestAnimationFrame(() => {
      session.frame = null;
      if (context(document).session === session && session.point) moveDrag(document, session.point.x, session.point.y);
    });
  }
}

function scrollAtEdge(document: Document, hit: Element | null, x: number, y: number): boolean {
  for (let element = hit; element; element = element.parentElement ?? (element.getRootNode() instanceof ShadowRoot ? (element.getRootNode() as ShadowRoot).host : null)) {
    const root = element === document.scrollingElement;
    const style = getComputedStyle(element);
    const rect = root ? { left: 0, top: 0, right: document.defaultView!.innerWidth, bottom: document.defaultView!.innerHeight } : element.getBoundingClientRect();
    const dx = x < rect.left + 24 ? -12 : x > rect.right - 24 ? 12 : 0;
    const dy = y < rect.top + 24 ? -12 : y > rect.bottom - 24 ? 12 : 0;
    const left = element.scrollLeft; const top = element.scrollTop; let requested = false;
    if (dy && (root || /auto|scroll/u.test(style.overflowY))) {
      const next = Math.max(0, Math.min(element.scrollHeight - element.clientHeight, top + dy));
      if (next !== top) { element.scrollTop = next; requested = true; }
    }
    if (dx && (root || /auto|scroll/u.test(style.overflowX))) {
      const extent = Math.max(0, element.scrollWidth - element.clientWidth); const rtl = style.direction === 'rtl';
      const next = Math.max(rtl ? -extent : 0, Math.min(rtl ? 0 : extent, left + dx));
      if (next !== left) { element.scrollLeft = next; requested = true; }
    }
    // Some scrolling surfaces report their new offset on the following frame.
    if (requested) return true;
  }
  return false;
}

export function finishDrag(document: Document, cancelled = false): void {
  const state = context(document);
  const session = state.session;
  if (!session) return;
  state.session = null;
  session.abort.abort(); session.preview?.destroy();
  if (session.frame !== null) document.defaultView!.cancelAnimationFrame(session.frame);
  const target = session.target;
  const accepted = !cancelled && Boolean(target?.element.isConnected && target.accepts(session.payload) && target.drop(session.payload));
  target?.leave(session.payload);
  session.end({ ...session.payload, target: accepted ? target!.element : null, accepted, cancelled });
}

export function cancelDragSource(source: HTMLElement): void {
  if (activeDrag(source.ownerDocument)?.source === source) finishDrag(source.ownerDocument, true);
}
