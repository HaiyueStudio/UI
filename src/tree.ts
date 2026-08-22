import { HYTreeModel } from './tree-model.js';
import { HYTreeNode } from './tree-node.js';
import type {
  FlatTreeNode,
  HYTreeDataChangeDetail,
  HYTreeDropPosition,
  HYTreeNodeContextMenuDetail,
  HYTreeNodeData,
  HYTreeSelectionChangeDetail,
} from './tree-types.js';

export { HYTreeNode } from './tree-node.js';
export type {
  HYTreeDataChangeDetail,
  HYTreeDropPosition,
  HYTreeNodeContextMenuDetail,
  HYTreeNodeData,
  HYTreeSelectionChangeDetail,
} from './tree-types.js';

interface RenderedTreeRow {
  row: HTMLElement;
  toggle: HTMLButtonElement;
  content: HTMLElement;
  renderer: HTMLElement & {
    node?: HYTreeNodeData;
    depth?: number;
    selected?: boolean;
    expanded?: boolean;
    hasChildren?: boolean;
  };
  rendererTag: string;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const TREE_TOGGLE_ICON_PATHS = [
  'M318.57 223.95l322.99 322.99c21.87 21.87 57.33 21.87 79.2 0 21.87-21.87 21.87-57.33 0-79.2l-323-322.99c-21.87-21.87-57.33-21.87-79.2 0-21.86 21.87-21.86 57.33 0.01 79.2z',
  'M729.75 555.95L406.76 878.93c-21.87 21.87-57.33 21.87-79.2 0-21.87-21.87-21.87-57.33 0-79.2l322.99-322.99c21.87-21.87 57.33-21.87 79.2 0 21.87 21.88 21.87 57.34 0 79.21z',
];
const HIERARCHY_MEASURE_PREFIX = 'editor.hierarchy.';

function measureHierarchyTreeStage<T>(stage: 'index-update' | 'tree-rebuild', operation: () => T): T {
  const startedAt = performance.now();
  try {
    return operation();
  } finally {
    const name = `${HIERARCHY_MEASURE_PREFIX}${stage}`;
    performance.clearMeasures(name);
    performance.measure(name, { start: startedAt, end: performance.now() });
  }
}

function createTreeToggleIconSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('class', 'toggle-icon');
  svg.setAttribute('viewBox', '0 0 1024 1024');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const pathData of TREE_TOGGLE_ICON_PATHS) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'currentColor');
    svg.append(path);
  }
  return svg;
}

export class HYTree extends HTMLElement {
  private static readonly VIRTUALIZATION_THRESHOLD = 160;
  private static readonly ROW_HEIGHT = 28;
  private static readonly OVERSCAN_ROWS = 8;
  private readonly _root: ShadowRoot;
  private readonly _style = document.createElement('style');
  private readonly _list = document.createElement('div');
  private readonly _rowCache = new Map<string, RenderedTreeRow>();
  private _clipboard: HYTreeNodeData[] = [];
  private _data: HYTreeNodeData[] = [];
  private _selectedId: string | null = null;
  private _selectedIds = new Set<string>();
  private _selectionAnchorId: string | null = null;
  private _activeId: string | null = null;
  private _expandedIds = new Set<string>();
  private readonly _model = new HYTreeModel(this._expandedIds);
  private _dragNodeId: string | null = null;
  private _syncingSelectionAttributes = false;
  private _resizeObserver: ResizeObserver | null = null;

  static get observedAttributes(): string[] {
    return ['data', 'selected-id', 'selected-ids', 'allow-drag'];
  }

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    this._style.textContent = `
      :host {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        width: 100%;
        min-height: 0;
        color: var(--hy-tree-text-color, var(--hy-text-color, #c8d3e4));
        background: var(--hy-panel-bg-color, #171d28);
        font: 12px system-ui, sans-serif;
        text-align: left;
        user-select: none;
        overflow: auto;
      }
      .list {
        box-sizing: border-box;
        width: 100%;
        flex: 0 0 auto;
        padding: 4px;
      }
      .row {
        height: 28px;
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 4px;
        color: var(--hy-tree-text-color, var(--hy-text-color, #c8d3e4));
        cursor: default;
      }
      .virtual-spacer {
        width: 1px;
        pointer-events: none;
      }
      .row:hover {
        background: var(--hy-hover-bg-color, #222b3a);
      }
      .row.selected {
        background: var(--hy-selected-bg-color, var(--hy-accent-strong-color, #255a91));
        color: var(--hy-selected-text-color, #fff);
      }
      .row.active:not(.selected) {
        background: var(--hy-tree-active-bg-color, var(--hy-hover-bg-color, #222b3a));
        color: var(--hy-tree-active-text-color, var(--hy-tree-text-color, #dce8fb));
      }
      .row.active {
        outline: var(--hy-tree-active-ring-width, 1px) solid var(--hy-tree-active-ring-color, var(--hy-focus-border-color, #3d6fa8));
        outline-offset: -1px;
      }
      .toggle {
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        border: 0;
        padding: 0;
        background: transparent;
        color: var(--hy-tree-icon-color, var(--hy-secondary-text-color, #8fa7c8));
        cursor: pointer;
        display: inline-grid;
        place-items: center;
      }
      .toggle.empty {
        cursor: default;
        visibility: hidden;
      }
      .toggle-icon {
        width: 12px;
        height: 12px;
        color: var(--hy-tree-icon-color, var(--hy-secondary-text-color, #8fa7c8));
        transition: transform 0.16s ease, color 0.16s ease;
      }
      .toggle.expanded .toggle-icon {
        transform: rotate(90deg);
        color: var(--hy-tree-icon-active-color, #b9d4ff);
      }
      .row:hover .toggle-icon {
        color: var(--hy-tree-icon-active-color, #b9d4ff);
      }
      .content {
        min-width: 0;
        flex: 1 1 auto;
      }
      .row.drop-before {
        box-shadow: inset 0 2px 0 var(--hy-drop-indicator-color, #62a8ff);
      }
      .row.drop-after {
        box-shadow: inset 0 -2px 0 var(--hy-drop-indicator-color, #62a8ff);
      }
      .row.drop-inside {
        outline: 1px solid var(--hy-drop-indicator-color, #62a8ff);
        background: var(--hy-drop-target-bg-color, #223650);
      }
    `;
    this._list.className = 'list';
    this._root.append(this._style, this._list);
  }

  connectedCallback(): void {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'tree');
    this._syncFromAttributes();
    this.addEventListener('keydown', this._onKeyDown);
    this._list.addEventListener('click', this._onListClick);
    this._list.addEventListener('contextmenu', this._onListContextMenu);
    this._list.addEventListener('dragstart', this._onListDragStart);
    this._list.addEventListener('dragover', this._onListDragOver);
    this._list.addEventListener('dragleave', this._onListDragLeave);
    this._list.addEventListener('drop', this._onListDrop);
    this._list.addEventListener('dragend', this._onListDragEnd);
    this.addEventListener('scroll', this._onScroll, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this._render());
      this._resizeObserver.observe(this);
    }
    this._render();
  }

  disconnectedCallback(): void {
    this.removeEventListener('keydown', this._onKeyDown);
    this._list.removeEventListener('click', this._onListClick);
    this._list.removeEventListener('contextmenu', this._onListContextMenu);
    this._list.removeEventListener('dragstart', this._onListDragStart);
    this._list.removeEventListener('dragover', this._onListDragOver);
    this._list.removeEventListener('dragleave', this._onListDragLeave);
    this._list.removeEventListener('drop', this._onListDrop);
    this._list.removeEventListener('dragend', this._onListDragEnd);
    this.removeEventListener('scroll', this._onScroll);
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  attributeChangedCallback(name: string): void {
    if (name === 'data') this._readDataAttribute();
    if (this._syncingSelectionAttributes) return;
    if (!this._syncingSelectionAttributes) {
      if (name === 'selected-id') this._setSelectionFromSelectedIdAttribute();
      if (name === 'selected-ids') this._setSelectionFromSelectedIdsAttribute();
    }
    this._render();
  }

  get data(): HYTreeNodeData[] {
    return this._data;
  }

  set data(value: HYTreeNodeData[]) {
    this._data = Array.isArray(value) ? value : [];
    this._seedExpanded(this._data);
    this._model.setData(this._data);
    this._render();
  }

  get selectedId(): string | null {
    return this._selectedId;
  }

  set selectedId(value: string | null) {
    this._setSelection(value ? [value] : [], value, false);
  }

  get selectedIds(): string[] {
    return [...this._selectedIds];
  }

  set selectedIds(value: string[]) {
    const ids = Array.isArray(value) ? value : [];
    this._setSelection(ids, ids[ids.length - 1] ?? null, false);
  }

  get allowDrag(): boolean {
    return this.hasAttribute('allow-drag');
  }

  set allowDrag(value: boolean) {
    if (value) this.setAttribute('allow-drag', '');
    else this.removeAttribute('allow-drag');
  }

  updateData(value: HYTreeNodeData[]): void {
    this.data = value;
  }

  expand(id: string): void {
    this._expandedIds.add(id);
    this._model.invalidateVisibility();
    this._render();
  }

  collapse(id: string): void {
    this._expandedIds.delete(id);
    this._model.invalidateVisibility();
    this._render();
  }

  toggle(id: string): void {
    if (this._expandedIds.has(id)) this._expandedIds.delete(id);
    else this._expandedIds.add(id);
    this._model.invalidateVisibility();
    this._render();
  }

  reveal(id: string): boolean {
    const indexed = this._model.getIndexedNode(id);
    if (!indexed) return false;
    for (const ancestorId of indexed.ancestorIds) this._expandedIds.add(ancestorId);
    this._model.invalidateVisibility();
    this._render();
    this._setActiveId(id, true);
    return this._model.visibleIndex.has(id);
  }

  copySelection(): boolean {
    return this._copySelection();
  }

  pasteClipboard(): boolean {
    return this._pasteClipboard();
  }

  deleteSelection(): boolean {
    return this._deleteSelection();
  }

  cutSelection(): boolean {
    if (!this._copySelection()) return false;
    return this._deleteSelection();
  }

  private _syncFromAttributes(): void {
    this._readDataAttribute();
    if (this.hasAttribute('selected-ids')) this._setSelectionFromSelectedIdsAttribute();
    else this._setSelectionFromSelectedIdAttribute();
  }

  private _readDataAttribute(): void {
    const raw = this.getAttribute('data');
    if (!raw) {
      this._data = [];
      this._model.setData(this._data);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      this._data = Array.isArray(parsed) ? parsed : [];
      this._seedExpanded(this._data);
      this._model.setData(this._data);
    } catch (error) {
      console.warn('Invalid hy-tree data attribute.', error);
    }
  }

  private _seedExpanded(nodes: HYTreeNodeData[]): void {
    const visit = (items: HYTreeNodeData[]) => {
      for (const node of items) {
        if (node.expanded) this._expandedIds.add(node.id);
        if (node.children) visit(node.children);
      }
    };
    visit(nodes);
  }

  private _render(): void {
    this._ensureActiveVisible();
    const visible = this._getVisibleFlatNodes();
    const window = this._getRenderWindow(visible.length);
    const visibleIds = new Set<string>();
    const fragment = document.createDocumentFragment();
    if (window.start > 0) fragment.append(this._createVirtualSpacer(window.start * HYTree.ROW_HEIGHT));
    for (let index = window.start; index < window.end; index++) {
      const item = visible[index];
      if (!item) continue;
      visibleIds.add(item.node.id);
      const rendered = this._getOrCreateRow(item.node.id);
      this._syncRow(rendered, item);
      fragment.append(rendered.row);
    }
    if (window.end < visible.length) {
      fragment.append(this._createVirtualSpacer((visible.length - window.end) * HYTree.ROW_HEIGHT));
    }

    for (const [id, rendered] of this._rowCache) {
      if (visibleIds.has(id)) continue;
      rendered.row.remove();
      this._rowCache.delete(id);
    }
    this._list.replaceChildren(fragment);
  }

  private _getRenderWindow(itemCount: number): { start: number; end: number } {
    const viewportHeight = this.clientHeight;
    if (itemCount < HYTree.VIRTUALIZATION_THRESHOLD || viewportHeight <= 0) return { start: 0, end: itemCount };
    const first = Math.floor(this.scrollTop / HYTree.ROW_HEIGHT);
    const last = Math.ceil((this.scrollTop + viewportHeight) / HYTree.ROW_HEIGHT);
    return {
      start: Math.max(0, first - HYTree.OVERSCAN_ROWS),
      end: Math.min(itemCount, last + HYTree.OVERSCAN_ROWS),
    };
  }

  private _createVirtualSpacer(height: number): HTMLDivElement {
    const spacer = document.createElement('div');
    spacer.className = 'virtual-spacer';
    spacer.style.height = `${height}px`;
    spacer.setAttribute('aria-hidden', 'true');
    return spacer;
  }

  private _getVisibleFlatNodes(): readonly FlatTreeNode[] {
    return this._model.getVisibleNodes();
  }

  private _getVisibleIds(): readonly string[] {
    return this._model.getVisibleIds();
  }

  private _getOrCreateRow(id: string): RenderedTreeRow {
    const cached = this._rowCache.get(id);
    if (cached) return cached;

    const row = document.createElement('div');
    const toggle = document.createElement('button');
    const content = document.createElement('div');
    const renderer = document.createElement('hy-tree-node') as RenderedTreeRow['renderer'];

    row.className = 'row';
    row.dataset.id = id;
    toggle.type = 'button';
    toggle.append(createTreeToggleIconSvg());
    content.className = 'content';
    content.append(renderer);
    row.append(toggle, content);

    const rendered = { row, toggle, content, renderer, rendererTag: 'hy-tree-node' };
    this._rowCache.set(id, rendered);
    return rendered;
  }

  private _syncRow(rendered: RenderedTreeRow, item: FlatTreeNode): void {
    const { node, depth } = item;
    const hasChildren = Boolean(node.children?.length);
    const expanded = this._expandedIds.has(node.id);
    const selected = this._selectedIds.has(node.id);
    const active = this._activeId === node.id;
    const rendererTag = this._getRendererTag(node);
    const { row, toggle, content } = rendered;

    row.className = `row${selected ? ' selected' : ''}${active ? ' active' : ''}`;
    row.dataset.id = node.id;
    row.style.paddingLeft = `${depth * 16 + 4}px`;
    row.draggable = this.allowDrag;

    toggle.className = `${hasChildren ? 'toggle' : 'toggle empty'}${expanded ? ' expanded' : ''}`;
    toggle.disabled = !hasChildren;
    toggle.setAttribute('aria-hidden', hasChildren ? 'false' : 'true');
    toggle.tabIndex = hasChildren ? 0 : -1;

    if (rendered.rendererTag !== rendererTag) {
      rendered.renderer = document.createElement(rendererTag) as RenderedTreeRow['renderer'];
      rendered.rendererTag = rendererTag;
      content.replaceChildren(rendered.renderer);
    }
    this._syncRenderer(rendered.renderer, node, depth, expanded, hasChildren, selected);
  }

  private _getRendererTag(node: HYTreeNodeData): string {
    return typeof node.renderer === 'string' && node.renderer ? node.renderer : 'hy-tree-node';
  }

  private _syncRenderer(
    el: RenderedTreeRow['renderer'],
    node: HYTreeNodeData,
    depth: number,
    expanded: boolean,
    hasChildren: boolean,
    selected: boolean,
  ): void {
    el.node = node;
    el.depth = depth;
    el.selected = selected;
    el.expanded = expanded;
    el.hasChildren = hasChildren;
    el.id = this._getTreeItemElementId(node.id);
    if (!el.hasAttribute('role')) el.setAttribute('role', 'treeitem');
    el.setAttribute('aria-level', String(depth + 1));
    if (hasChildren) el.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    else el.removeAttribute('aria-expanded');
    el.setAttribute('label', String(node.label ?? node.id));
    if (node.icon) el.setAttribute('icon', String(node.icon));
    else el.removeAttribute('icon');
    if (selected) {
      el.setAttribute('selected', '');
      el.setAttribute('aria-selected', 'true');
    } else {
      el.removeAttribute('selected');
      el.setAttribute('aria-selected', 'false');
    }
  }

  private _syncRenderedSelection(): void {
    for (const [id, rendered] of this._rowCache) {
      const selected = this._selectedIds.has(id);
      rendered.row.classList.toggle('selected', selected);
      rendered.renderer.selected = selected;
      if (selected) {
        rendered.renderer.setAttribute('selected', '');
        rendered.renderer.setAttribute('aria-selected', 'true');
      } else {
        rendered.renderer.removeAttribute('selected');
        rendered.renderer.setAttribute('aria-selected', 'false');
      }
    }
  }

  private _syncRenderedActive(): void {
    for (const [id, rendered] of this._rowCache) {
      rendered.row.classList.toggle('active', this._activeId === id);
    }
    this._syncActiveDescendant();
  }

  private _select(id: string, event: MouseEvent): void {
    const visibleIds = this._getVisibleIds();
    let ids: string[];

    if (event.shiftKey && this._selectionAnchorId) {
      ids = this._getRangeSelection(visibleIds, this._selectionAnchorId, id);
    } else if (event.metaKey || event.ctrlKey) {
      const next = new Set(this._selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      ids = [...next];
      this._selectionAnchorId = id;
    } else {
      ids = [id];
      this._selectionAnchorId = id;
    }

    this._setSelection(ids, id, true);
  }

  private _setSelection(ids: string[], selectedId: string | null, emit: boolean): void {
    const uniqueIds = [...new Set(ids)].filter(id => this._model.index.has(id));
    this._selectedIds = new Set(uniqueIds);
    this._selectedId = selectedId && this._selectedIds.has(selectedId)
      ? selectedId
      : uniqueIds[uniqueIds.length - 1] ?? null;
    if (this._selectedId && !this._selectionAnchorId) this._selectionAnchorId = this._selectedId;
    this._setActiveId(this._selectedId, false);
    this._syncSelectionAttributes();
    if (this._model.isVisibilityDirty) this._render();
    else this._syncRenderedSelection();

    if (!emit) return;
    const node = this._selectedId ? this._model.getIndexedNode(this._selectedId)?.node ?? null : null;
    const nodes = uniqueIds
      .map(id => this._model.getIndexedNode(id)?.node ?? null)
      .filter((item): item is HYTreeNodeData => item !== null);
    this.dispatchEvent(new CustomEvent<HYTreeSelectionChangeDetail>('selection-change', {
      detail: { selectedId: this._selectedId, node, selectedIds: uniqueIds, nodes },
      bubbles: true,
      composed: true,
    }));
  }

  private _syncSelectionAttributes(): void {
    this._syncingSelectionAttributes = true;
    if (this._selectedId === null) this.removeAttribute('selected-id');
    else this.setAttribute('selected-id', this._selectedId);

    if (this._selectedIds.size === 0) this.removeAttribute('selected-ids');
    else this.setAttribute('selected-ids', JSON.stringify([...this._selectedIds]));
    this._syncingSelectionAttributes = false;
  }

  private _setSelectionFromSelectedIdAttribute(): void {
    const id = this.getAttribute('selected-id');
    this._selectedIds = id ? new Set([id]) : new Set();
    this._selectedId = id;
    this._selectionAnchorId = id;
    this._activeId = id;
  }

  private _setSelectionFromSelectedIdsAttribute(): void {
    const raw = this.getAttribute('selected-ids');
    if (!raw) {
      this._setSelectionFromSelectedIdAttribute();
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const ids = Array.isArray(parsed) ? parsed.map(String) : [];
      this._selectedIds = new Set(ids);
      this._selectedId = ids[ids.length - 1] ?? null;
      this._selectionAnchorId = this._selectedId;
      this._activeId = this._selectedId;
    } catch (error) {
      console.warn('Invalid hy-tree selected-ids attribute.', error);
      this._setSelectionFromSelectedIdAttribute();
    }
  }

  private _getRangeSelection(visibleIds: readonly string[], fromId: string, toId: string): string[] {
    this._getVisibleFlatNodes();
    const fromIndex = this._model.visibleIndex.get(fromId) ?? -1;
    const toIndex = this._model.visibleIndex.get(toId) ?? -1;
    if (fromIndex < 0 || toIndex < 0) return [toId];
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    return visibleIds.slice(start, end + 1);
  }

  private _getEventRow(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    const row = target.closest<HTMLElement>('.row');
    return row && this._list.contains(row) ? row : null;
  }

  private _getRowNode(row: HTMLElement): HYTreeNodeData | null {
    const id = row.dataset.id;
    return id ? this._model.getIndexedNode(id)?.node ?? null : null;
  }

  private _onListClick = (event: MouseEvent): void => {
    const row = this._getEventRow(event.target);
    if (!row) return;
    const node = this._getRowNode(row);
    if (!node) return;

    const toggle = event.target instanceof Element ? event.target.closest('.toggle') : null;
    if (toggle && row.contains(toggle)) {
      event.stopPropagation();
      if (node.children?.length) this.toggle(node.id);
      return;
    }

    this.focus();
    this._setActiveId(node.id, false);
    this._select(node.id, event);
  };

  private _onListContextMenu = (event: MouseEvent): void => {
    const row = this._getEventRow(event.target);
    if (!row) return;
    const node = this._getRowNode(row);
    if (!node) return;

    event.preventDefault();
    event.stopPropagation();
    this.focus();
    this._setActiveId(node.id, false);
    if (!this._selectedIds.has(node.id)) this._setSelection([node.id], node.id, true);
    this.dispatchEvent(new CustomEvent<HYTreeNodeContextMenuDetail>('node-context-menu', {
      detail: {
        id: node.id,
        node,
        selectedIds: this.selectedIds,
        clientX: event.clientX,
        clientY: event.clientY,
      },
      bubbles: true,
      composed: true,
    }));
  };

  private _onListDragStart = (event: DragEvent): void => {
    const row = this._getEventRow(event.target);
    if (!row || !this.allowDrag || !row.dataset.id) return;
    this._onDragStart(event, row.dataset.id);
  };

  private _onListDragOver = (event: DragEvent): void => {
    const row = this._getEventRow(event.target);
    if (!row || !this.allowDrag) return;
    this._onDragOver(event, row);
  };

  private _onListDragLeave = (event: DragEvent): void => {
    const row = this._getEventRow(event.target);
    if (row) this._clearDropClass(row);
  };

  private _onListDrop = (event: DragEvent): void => {
    const row = this._getEventRow(event.target);
    if (!row || !this.allowDrag || !row.dataset.id) return;
    this._onDrop(event, row, row.dataset.id);
  };

  private _onListDragEnd = (): void => {
    this._clearAllDropClasses();
  };

  private _onDragStart(event: DragEvent, id: string): void {
    this._dragNodeId = id;
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  private _onDragOver(event: DragEvent, row: HTMLElement): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this._clearAllDropClasses();
    row.classList.add(this._getDropClass(event, row));
  }

  private _onDrop(event: DragEvent, row: HTMLElement, targetId: string): void {
    performance.clearMarks(`${HIERARCHY_MEASURE_PREFIX}input-start`);
    performance.mark(`${HIERARCHY_MEASURE_PREFIX}input-start`);
    event.preventDefault();
    const sourceId = this._dragNodeId ?? event.dataTransfer?.getData('text/plain') ?? null;
    this._clearAllDropClasses();
    this._dragNodeId = null;
    if (!sourceId || sourceId === targetId) return;
    const position = this._getDropPosition(event, row);
    if (measureHierarchyTreeStage('index-update', () => this._model.moveNode(sourceId, targetId, position))) {
      measureHierarchyTreeStage('tree-rebuild', () => this._render());
      this.dispatchEvent(new CustomEvent<HYTreeDataChangeDetail>('data-change', {
        detail: { data: this._data, action: 'drop', sourceId, targetId, dropPosition: position },
        bubbles: true,
        composed: true,
      }));
    }
  }

  private _onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || this._isEditableTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const command = event.metaKey || event.ctrlKey;

    if (command && key === 'c') {
      if (this._copySelection()) event.preventDefault();
      return;
    }

    if (command && key === 'v') {
      if (this._pasteClipboard()) event.preventDefault();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this._deleteSelection()) event.preventDefault();
      return;
    }

    if (this._handleNavigationKey(event)) event.preventDefault();
  };

  private _handleNavigationKey(event: KeyboardEvent): boolean {
    if (event.altKey || event.metaKey || event.ctrlKey) return false;
    const visibleIds = this._getVisibleIds();
    if (visibleIds.length === 0) return false;

    const activeId = this._getActiveVisibleId() ?? visibleIds[0];
    if (activeId === undefined) return false;
    const activeIndex = this._model.visibleIndex.get(activeId) ?? 0;
    const linearTarget = this._linearNavigationTarget(event.key, activeIndex, visibleIds);
    if (linearTarget) {
      this._setActiveId(linearTarget);
      return true;
    }
    return this._handleNavigationAction(event.key, activeId);
  }

  private _linearNavigationTarget(
    key: string,
    activeIndex: number,
    visibleIds: readonly string[],
  ): string | null {
    if (key === 'ArrowDown') return visibleIds[Math.min(activeIndex + 1, visibleIds.length - 1)] ?? null;
    if (key === 'ArrowUp') return visibleIds[Math.max(activeIndex - 1, 0)] ?? null;
    if (key === 'Home') return visibleIds[0] ?? null;
    if (key === 'End') return visibleIds[visibleIds.length - 1] ?? null;
    return null;
  }

  private _handleNavigationAction(key: string, activeId: string): boolean {
    if (key === 'ArrowRight') return this._moveActiveRight(activeId);
    if (key === 'ArrowLeft') return this._moveActiveLeft(activeId);
    if (key !== 'Enter' && key !== ' ') return false;
    this._setSelection([activeId], activeId, true);
    return true;
  }

  private _moveActiveRight(activeId: string): boolean {
    const indexed = this._model.getIndexedNode(activeId);
    if (!indexed?.node.children?.length) return false;
    if (!this._expandedIds.has(activeId)) {
      this._expandedIds.add(activeId);
      this._model.invalidateVisibility();
      this._render();
      this._scrollActiveIntoView();
      return true;
    }

    const visibleIds = this._getVisibleIds();
    const activeIndex = this._model.visibleIndex.get(activeId) ?? -1;
    const nextId = visibleIds[activeIndex + 1];
    if (nextId) this._setActiveId(nextId);
    return Boolean(nextId);
  }

  private _moveActiveLeft(activeId: string): boolean {
    const indexed = this._model.getIndexedNode(activeId);
    if (!indexed) return false;
    if (indexed.node.children?.length && this._expandedIds.has(activeId)) {
      this._expandedIds.delete(activeId);
      this._model.invalidateVisibility();
      this._render();
      this._scrollActiveIntoView();
      return true;
    }

    const parentId = indexed.parent?.id;
    if (parentId) this._setActiveId(parentId);
    return Boolean(parentId);
  }

  private _getActiveVisibleId(): string | null {
    this._getVisibleFlatNodes();
    if (this._activeId && this._model.visibleIndex.has(this._activeId)) return this._activeId;
    if (this._selectedId && this._model.visibleIndex.has(this._selectedId)) return this._selectedId;
    return null;
  }

  private _ensureActiveVisible(): void {
    const visibleIds = this._getVisibleIds();
    if (this._activeId && this._model.visibleIndex.has(this._activeId)) {
      this._syncActiveDescendant();
      return;
    }
    this._activeId = this._selectedId && this._model.visibleIndex.has(this._selectedId)
      ? this._selectedId
      : visibleIds[0] ?? null;
    this._syncActiveDescendant();
  }

  private _setActiveId(id: string | null, scroll = true): void {
    this._getVisibleFlatNodes();
    const nextId = id && this._model.visibleIndex.has(id) ? id : this._getActiveVisibleId();
    if (this._activeId === nextId) {
      if (scroll) this._scrollActiveIntoView();
      return;
    }
    this._activeId = nextId;
    this._syncRenderedActive();
    if (scroll) this._scrollActiveIntoView();
  }

  private _syncActiveDescendant(): void {
    if (this._activeId) this.setAttribute('aria-activedescendant', this._getTreeItemElementId(this._activeId));
    else this.removeAttribute('aria-activedescendant');
  }

  private _getTreeItemElementId(id: string): string {
    return `hy-tree-item-${encodeURIComponent(id)}`;
  }

  private _scrollActiveIntoView(): void {
    if (!this._activeId) return;
    let rendered = this._rowCache.get(this._activeId);
    if (!rendered && this.clientHeight > 0) {
      this._getVisibleFlatNodes();
      const index = this._model.visibleIndex.get(this._activeId);
      if (index !== undefined) {
        const rowTop = index * HYTree.ROW_HEIGHT;
        const rowBottom = rowTop + HYTree.ROW_HEIGHT;
        if (rowTop < this.scrollTop) this.scrollTop = rowTop;
        else if (rowBottom > this.scrollTop + this.clientHeight) this.scrollTop = rowBottom - this.clientHeight;
        this._render();
        rendered = this._rowCache.get(this._activeId);
      }
    }
    rendered?.row.scrollIntoView({ block: 'nearest' });
  }

  private _onScroll = (): void => {
    if (this._getVisibleFlatNodes().length >= HYTree.VIRTUALIZATION_THRESHOLD) this._render();
  };

  private _isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  private _copySelection(): boolean {
    const nodes = this._getSelectedTopLevelNodes();
    if (nodes.length === 0) return false;
    this._clipboard = nodes.map(node => this._cloneNode(node));
    return true;
  }

  private _pasteClipboard(): boolean {
    if (this._clipboard.length === 0) return false;
    const target = this._selectedId ? this._model.findNode(this._selectedId) : null;
    if (target && !target.node.children) target.node.children = [];
    const targetList = target?.node.children ?? this._data;
    if (target) {
      this._expandedIds.add(target.node.id);
    }

    const existingIds = new Set(this._model.index.keys());
    const pastedNodes = this._clipboard.map(node => this._cloneNodeWithUniqueIds(node, existingIds));
    targetList.push(...pastedNodes);
    this._model.setData(this._data);
    const pastedIds = pastedNodes.map(node => node.id);
    this._setSelection(pastedIds, pastedIds[pastedIds.length - 1] ?? null, true);
    this.dispatchEvent(new CustomEvent<HYTreeDataChangeDetail>('data-change', {
      detail: { data: this._data, action: 'paste', targetId: target?.node.id ?? null, pastedNodes },
      bubbles: true,
      composed: true,
    }));
    return true;
  }

  private _deleteSelection(): boolean {
    const ids = this._getTopLevelSelectedIds();
    if (ids.length === 0) return false;
    const deletedIds: string[] = [];
    for (const id of ids) {
      if (this._model.removeNode(id)) deletedIds.push(id);
    }
    if (deletedIds.length === 0) return false;

    this._model.setData(this._data);
    this._setSelection([], null, true);
    this.dispatchEvent(new CustomEvent<HYTreeDataChangeDetail>('data-change', {
      detail: { data: this._data, action: 'delete', deletedIds },
      bubbles: true,
      composed: true,
    }));
    return true;
  }

  private _cloneNode(node: HYTreeNodeData): HYTreeNodeData {
    return typeof structuredClone === 'function'
      ? structuredClone(node)
      : JSON.parse(JSON.stringify(node)) as HYTreeNodeData;
  }

  private _cloneNodeWithUniqueIds(node: HYTreeNodeData, existingIds: Set<string>): HYTreeNodeData {
    const clone = this._cloneNode(node);
    const assignIds = (item: HYTreeNodeData) => {
      item.id = this._makeUniqueId(item.id, existingIds);
      existingIds.add(item.id);
      item.children?.forEach(assignIds);
    };
    assignIds(clone);
    return clone;
  }

  private _makeUniqueId(baseId: string, existingIds: Set<string>): string {
    const base = `${baseId}-copy`;
    if (!existingIds.has(base)) return base;
    let index = 2;
    while (existingIds.has(`${base}-${index}`)) index++;
    return `${base}-${index}`;
  }

  private _getSelectedTopLevelNodes(): HYTreeNodeData[] {
    return this._getTopLevelSelectedIds()
      .map(id => this._model.getIndexedNode(id)?.node ?? null)
      .filter((node): node is HYTreeNodeData => node !== null);
  }

  private _getTopLevelSelectedIds(): string[] {
    return this._model.topLevelSelection(this._selectedIds);
  }

  private _getDropPosition(event: DragEvent, row: HTMLElement): HYTreeDropPosition {
    const rect = row.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (y < rect.height * 0.28) return 'before';
    if (y > rect.height * 0.72) return 'after';
    return 'inside';
  }

  private _getDropClass(event: DragEvent, row: HTMLElement): string {
    const position = this._getDropPosition(event, row);
    return `drop-${position}`;
  }

  private _clearDropClass(row: HTMLElement): void {
    row.classList.remove('drop-before', 'drop-after', 'drop-inside');
  }

  private _clearAllDropClasses(): void {
    this._list.querySelectorAll<HTMLElement>('.row').forEach(row => this._clearDropClass(row));
  }
}

export function defineTreeComponents(): void {
  if (!customElements.get('hy-tree-node')) {
    customElements.define('hy-tree-node', HYTreeNode);
  }
  if (!customElements.get('hy-tree')) {
    customElements.define('hy-tree', HYTree);
  }
}
