export function hasSlotContent(slot: HTMLSlotElement): boolean {
  return slot.assignedNodes({ flatten: true }).some(node => node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()));
}

export function presentationIcon(kind: 'empty' | 'avatar' | 'success' | 'info' | 'warning' | 'error'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48'); svg.setAttribute('fill', 'none'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  const paths = {
    empty: ['M8 18 16 8h16l8 10v20H8Z', 'M8 20h10l3 6h6l3-6h10', 'M18 36h12'],
    avatar: ['M24 25a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M7 43a17 17 0 0 1 34 0'],
    success: ['M24 45a21 21 0 1 0 0-42 21 21 0 0 0 0 42Z', 'm14 24 7 7 14-15'],
    info: ['M24 45a21 21 0 1 0 0-42 21 21 0 0 0 0 42Z', 'M24 22v13', 'M24 13v1'],
    warning: ['M24 4 46 42H2Z', 'M24 18v12', 'M24 35v1'],
    error: ['M24 45a21 21 0 1 0 0-42 21 21 0 0 0 0 42Z', 'm17 17 14 14', 'm31 17-14 14'],
  };
  for (const data of paths[kind]) {
    const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', data); svg.append(path);
  }
  return svg;
}
