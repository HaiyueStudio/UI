export function focusedElement(document: Document): HTMLElement | null {
  let element: Element | null = document.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element instanceof HTMLElement ? element : null;
}

export function focusableElements(root: Element | ShadowRoot): HTMLElement[] {
  const result: HTMLElement[] = [];
  const visit = (element: Element): void => {
    if (element instanceof HTMLElement && (element.hidden || element.inert || element.matches(':disabled'))) return;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    if (element instanceof HTMLSlotElement) {
      const assigned = element.assignedElements({ flatten: true });
      for (const child of assigned.length ? assigned : element.children) visit(child);
      return;
    }
    if (element instanceof HTMLElement && element.getClientRects().length &&
      (element.tabIndex >= 0 || (element.isContentEditable && !element.hasAttribute('tabindex')))) result.push(element);
    for (const child of element.shadowRoot?.children ?? element.children) visit(child);
  };
  for (const child of root.children) visit(child);
  return result.sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
}
