import type {
  FlatTreeNode,
  HYTreeDropPosition,
  HYTreeNodeData,
  IndexedTreeNode,
} from './tree-types.js';

/** Mutable hierarchy model owned by hy-tree. It has no DOM dependency and is safe to unit test. */
export class HYTreeModel {
  private _data: HYTreeNodeData[] = [];
  private readonly _expandedIds: Set<string>;
  private readonly _nodeIndex = new Map<string, IndexedTreeNode>();
  private readonly _visibleNodes: FlatTreeNode[] = [];
  private readonly _visibleIds: string[] = [];
  private readonly _visibleIndex = new Map<string, number>();
  private _indexDirty = true;
  private _visibleDirty = true;

  constructor(expandedIds: Set<string>) {
    this._expandedIds = expandedIds;
  }

  get index(): ReadonlyMap<string, IndexedTreeNode> {
    this._ensureIndex();
    return this._nodeIndex;
  }

  get visibleIndex(): ReadonlyMap<string, number> {
    this.getVisibleNodes();
    return this._visibleIndex;
  }

  get isVisibilityDirty(): boolean {
    return this._visibleDirty;
  }

  setData(data: HYTreeNodeData[]): void {
    this._data = data;
    this._indexDirty = true;
    this._visibleDirty = true;
  }

  invalidateVisibility(): void {
    this._visibleDirty = true;
  }

  getVisibleNodes(): readonly FlatTreeNode[] {
    if (!this._visibleDirty) return this._visibleNodes;
    this._ensureIndex();
    this._visibleNodes.length = 0;
    this._visibleIds.length = 0;
    this._visibleIndex.clear();
    const visit = (nodes: HYTreeNodeData[], parent: HYTreeNodeData | null, depth: number): void => {
      for (const node of nodes) {
        this._visibleIndex.set(node.id, this._visibleIds.length);
        this._visibleNodes.push(this._nodeIndex.get(node.id) ?? { node, parent, depth });
        this._visibleIds.push(node.id);
        if (node.children?.length && this._expandedIds.has(node.id)) {
          visit(node.children, node, depth + 1);
        }
      }
    };
    visit(this._data, null, 0);
    this._visibleDirty = false;
    return this._visibleNodes;
  }

  getVisibleIds(): readonly string[] {
    this.getVisibleNodes();
    return this._visibleIds;
  }

  getIndexedNode(id: string): IndexedTreeNode | null {
    this._ensureIndex();
    return this._nodeIndex.get(id) ?? null;
  }

  findNode(id: string): { node: HYTreeNodeData; parent: HYTreeNodeData | null } | null {
    const found = this.getIndexedNode(id);
    return found ? { node: found.node, parent: found.parent } : null;
  }

  topLevelSelection(ids: Iterable<string>): string[] {
    this._ensureIndex();
    const existing = [...new Set(ids)].filter(id => this._nodeIndex.has(id));
    const selected = new Set(existing);
    return existing.filter(id => {
      const indexed = this._nodeIndex.get(id);
      return indexed !== undefined && !indexed.ancestorIds.some(ancestorId => selected.has(ancestorId));
    });
  }

  removeNode(id: string): boolean {
    const found = this.findNode(id);
    if (!found) return false;
    const list = found.parent?.children ?? this._data;
    const index = this._nodeIndex.get(id)?.index ?? -1;
    if (index < 0) return false;
    list.splice(index, 1);
    this.setData(this._data);
    return true;
  }

  moveNode(sourceId: string, targetId: string, position: HYTreeDropPosition): boolean {
    this._ensureIndex();
    this.getVisibleNodes();
    const source = this._nodeIndex.get(sourceId);
    const target = this._nodeIndex.get(targetId);
    if (!source || !target || sourceId === targetId) return false;
    if (target.ancestorIds.includes(sourceId)) return false;

    const sourceList = source.parent?.children ?? this._data;
    const sourceIndex = source.index;
    if (sourceIndex < 0) return false;
    const previousDepth = source.depth;
    const visibleStart = this._visibleIndex.get(sourceId) ?? -1;
    let visibleCount = 0;
    if (visibleStart >= 0) {
      visibleCount = 1;
      while (visibleStart + visibleCount < this._visibleNodes.length
        && (this._visibleNodes[visibleStart + visibleCount]?.depth ?? -1) > previousDepth) {
        visibleCount++;
      }
    }
    sourceList.splice(sourceIndex, 1);

    let nextParent: HYTreeNodeData | null;
    let targetList: HYTreeNodeData[];
    let insertIndex: number;
    let expandedNextParent = false;
    if (position === 'inside') {
      target.node.children ??= [];
      nextParent = target.node;
      targetList = target.node.children;
      insertIndex = targetList.length;
      expandedNextParent = !this._expandedIds.has(target.node.id);
      this._expandedIds.add(target.node.id);
    } else {
      nextParent = target.parent;
      targetList = target.parent?.children ?? this._data;
      let targetIndex = target.index;
      if (sourceList === targetList && sourceIndex < targetIndex) targetIndex--;
      if (targetIndex < 0) return false;
      insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    }
    targetList.splice(insertIndex, 0, source.node);
    this._refreshSiblingIndexes(sourceList);
    if (targetList !== sourceList) this._refreshSiblingIndexes(targetList);
    const parentIndex = nextParent ? this._nodeIndex.get(nextParent.id) : null;
    const ancestorIds = parentIndex ? [...parentIndex.ancestorIds, nextParent!.id] : [];
    this._refreshSubtreeIndex(
      source.node,
      nextParent,
      parentIndex ? parentIndex.depth + 1 : 0,
      ancestorIds,
    );
    this._moveVisibleSubtree(
      source.node,
      visibleStart,
      visibleCount,
      nextParent,
      expandedNextParent,
    );
    return true;
  }

  private _refreshSiblingIndexes(nodes: readonly HYTreeNodeData[]): void {
    for (let index = 0; index < nodes.length; index++) {
      const item = nodes[index];
      const indexed = item ? this._nodeIndex.get(item.id) : null;
      if (indexed) indexed.index = index;
    }
  }

  private _refreshSubtreeIndex(
    node: HYTreeNodeData,
    parent: HYTreeNodeData | null,
    depth: number,
    ancestorIds: readonly string[],
  ): void {
    const indexed = this._nodeIndex.get(node.id);
    if (!indexed) return;
    indexed.parent = parent;
    indexed.depth = depth;
    indexed.ancestorIds = ancestorIds;
    const childAncestors = [...ancestorIds, node.id];
    for (let index = 0; index < (node.children?.length ?? 0); index++) {
      const child = node.children?.[index];
      if (!child) continue;
      const childIndex = this._nodeIndex.get(child.id);
      if (childIndex) childIndex.index = index;
      this._refreshSubtreeIndex(child, node, depth + 1, childAncestors);
    }
  }

  private _moveVisibleSubtree(
    source: HYTreeNodeData,
    previousStart: number,
    previousCount: number,
    nextParent: HYTreeNodeData | null,
    expandedNextParent: boolean,
  ): void {
    if (previousStart >= 0 && previousCount > 0) {
      this._visibleNodes.splice(previousStart, previousCount);
      this._visibleIds.splice(previousStart, previousCount);
      this._refreshVisibleIndexes(previousStart);
    }

    if (expandedNextParent && nextParent) {
      const parentVisible = this._visibleIndex.get(nextParent.id);
      if (parentVisible === undefined) return;
      const expandedChildren: IndexedTreeNode[] = [];
      for (const child of nextParent.children ?? []) {
        this._collectVisibleSubtree(child, expandedChildren);
      }
      if (expandedChildren.length === 0) return;
      const insertAt = parentVisible + 1;
      this._visibleNodes.splice(insertAt, 0, ...expandedChildren);
      this._visibleIds.splice(insertAt, 0, ...expandedChildren.map(item => item.node.id));
      this._refreshVisibleIndexes(insertAt);
      return;
    }

    let insertAt = -1;
    const sourceIndex = this._nodeIndex.get(source.id)?.index ?? -1;
    const siblings = nextParent?.children ?? this._data;
    if (sourceIndex >= 0) {
      if (nextParent) {
        const parentVisible = this._visibleIndex.get(nextParent.id);
        if (parentVisible !== undefined && this._expandedIds.has(nextParent.id)) {
          insertAt = sourceIndex === 0
            ? parentVisible + 1
            : this._visibleSubtreeEnd(siblings[sourceIndex - 1]?.id);
        }
      } else {
        insertAt = sourceIndex === 0
          ? 0
          : this._visibleSubtreeEnd(siblings[sourceIndex - 1]?.id);
      }
    }
    if (insertAt < 0) return;

    const moved: IndexedTreeNode[] = [];
    this._collectVisibleSubtree(source, moved);
    if (moved.length === 0) return;
    this._visibleNodes.splice(insertAt, 0, ...moved);
    this._visibleIds.splice(insertAt, 0, ...moved.map(item => item.node.id));
    this._refreshVisibleIndexes(insertAt);
  }

  private _collectVisibleSubtree(node: HYTreeNodeData, result: IndexedTreeNode[]): void {
    const indexed = this._nodeIndex.get(node.id);
    if (!indexed) return;
    result.push(indexed);
    if (!this._expandedIds.has(node.id)) return;
    for (const child of node.children ?? []) this._collectVisibleSubtree(child, result);
  }

  private _visibleSubtreeEnd(id: string | undefined): number {
    if (!id) return -1;
    const start = this._visibleIndex.get(id);
    const depth = this._nodeIndex.get(id)?.depth;
    if (start === undefined || depth === undefined) return -1;
    let end = start + 1;
    while (end < this._visibleNodes.length
      && (this._visibleNodes[end]?.depth ?? -1) > depth) {
      end++;
    }
    return end;
  }

  private _refreshVisibleIndexes(start: number): void {
    for (let index = Math.max(0, start); index < this._visibleIds.length; index++) {
      const id = this._visibleIds[index];
      if (id !== undefined) this._visibleIndex.set(id, index);
    }
    for (const [id, index] of this._visibleIndex) {
      if (index < this._visibleIds.length && this._visibleIds[index] === id) continue;
      this._visibleIndex.delete(id);
    }
  }

  private _ensureIndex(): void {
    if (!this._indexDirty) return;
    this._nodeIndex.clear();
    const ancestorIds: string[] = [];
    const visit = (nodes: HYTreeNodeData[], parent: HYTreeNodeData | null, depth: number): void => {
      for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        if (!node) continue;
        this._nodeIndex.set(node.id, { node, parent, depth, ancestorIds: ancestorIds.slice(), index });
        if (node.children?.length) {
          ancestorIds.push(node.id);
          visit(node.children, node, depth + 1);
          ancestorIds.pop();
        }
      }
    };
    visit(this._data, null, 0);
    for (const id of this._expandedIds) {
      if (!this._nodeIndex.has(id)) this._expandedIds.delete(id);
    }
    this._indexDirty = false;
  }
}
