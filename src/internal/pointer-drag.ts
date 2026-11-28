interface PointerCallbacks {
  start(event: PointerEvent): boolean;
  move(event: PointerEvent): void;
  end(event: PointerEvent, cancelled: boolean): void;
}

interface PointerSession {
  origin: PointerEvent;
  last: PointerEvent;
  target: HTMLElement;
  callbacks: PointerCallbacks;
  abort: AbortController;
  started: boolean;
}

/** Owns one pointer gesture, including threshold activation and cancellation cleanup. */
export class HYPointerDrag {
  private _session: PointerSession | null = null;

  start(event: PointerEvent, target: HTMLElement, callbacks: PointerCallbacks, threshold = 0): boolean {
    if (this._session || event.button !== 0 || event.isPrimary === false) return false;
    const session: PointerSession = { origin: event, last: event, target, callbacks, abort: new AbortController(), started: false };
    this._session = session;
    const { signal } = session.abort;
    const view = target.ownerDocument.defaultView!;
    const activate = (): boolean => {
      if (!callbacks.start(session.origin) || this._session !== session || !target.isConnected) {
        if (this._session === session) this._finish(true);
        return false;
      }
      session.started = true;
      try { target.setPointerCapture(event.pointerId); } catch { /* Window listeners also track uncaptured gestures. */ }
      return true;
    };
    view.addEventListener('pointermove', move => {
      if (move.pointerId !== event.pointerId) return;
      session.last = move;
      if (!session.started && Math.hypot(move.clientX - event.clientX, move.clientY - event.clientY) < threshold) return;
      if (!session.started && !activate()) return;
      move.preventDefault(); callbacks.move(move);
    }, { signal, passive: false });
    view.addEventListener('pointerup', up => {
      if (up.pointerId !== event.pointerId) return;
      session.last = up; this._finish(false);
    }, { signal });
    view.addEventListener('pointercancel', cancel => {
      if (cancel.pointerId === event.pointerId) this._finish(true);
    }, { signal });
    target.addEventListener('lostpointercapture', lost => {
      if (lost.target === target && lost.pointerId === event.pointerId) this._finish(true);
    }, { signal });
    view.addEventListener('blur', () => this._finish(true), { signal });
    target.ownerDocument.addEventListener('keydown', key => {
      if (key.key === 'Escape' && !key.defaultPrevented && session.started) { key.preventDefault(); this._finish(true); }
    }, { signal });
    if (threshold === 0) { const started = activate(); if (started) event.preventDefault(); return started; }
    return true;
  }

  cancel(): void { this._finish(true); }

  private _finish(cancelled: boolean): void {
    const session = this._session;
    if (!session) return;
    this._session = null;
    session.abort.abort();
    if (session.target.hasPointerCapture(session.origin.pointerId)) session.target.releasePointerCapture(session.origin.pointerId);
    if (session.started) session.callbacks.end(session.last, cancelled);
  }
}

export const HY_DRAG_CANCEL = 'input,textarea,select,button,a,[contenteditable],[data-no-drag]';

export function dragTargetAllowed(event: Event, boundary: HTMLElement, handle = '', cancel = HY_DRAG_CANCEL): boolean {
  const path: Element[] = [];
  for (const node of event.composedPath()) {
    if (node === boundary) break;
    if (node instanceof Element) path.push(node);
  }
  const matches = (element: Element, selector: string): boolean => {
    try { return Boolean(selector) && element.matches(selector); } catch { return false; }
  };
  // An explicit handle can be a button. Its child controls still keep their input behavior.
  const handleIndex = handle ? path.findIndex(element => matches(element, handle)) : -1;
  if (handle && handleIndex < 0) return false;
  return !path.slice(0, handleIndex < 0 ? path.length : handleIndex).some(element => matches(element, cancel));
}
