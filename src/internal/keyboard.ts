const CONTROL_SELECTOR = 'input,textarea,select,button,a[href],summary,[role="textbox"],[role="combobox"],[role="spinbutton"],[role="slider"],[role="button"],[role="checkbox"],[role="radio"],[role="switch"],[role="listbox"]';

/** Ancestor shortcuts must leave slotted and shadow-owned controls their editing keys. */
export function isKeyboardControlEvent(event: KeyboardEvent, boundary: HTMLElement): boolean {
  for (const target of event.composedPath()) {
    if (target === boundary) break;
    if (target instanceof HTMLElement && (target.isContentEditable || target.matches(CONTROL_SELECTOR))) return true;
  }
  return false;
}
