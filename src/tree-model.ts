import type {
  FlatTreeNode,
  HYTreeDropPosition,
  HYTreeNodeData,
  IndexedTreeNode,
} from './tree-types.js';

interface VisibleRange {
  readonly start: number;
  readonly count: number;
}

interface TreeMovePlan extends VisibleRange {
  readonly source: IndexedTreeNode;
  readonly target: IndexedTreeNode;
  readonly sourceList: HYTreeNodeData[];
  readonly sourceIndex: number;
}

interface TreeMoveDestination {
  readonly nextParent: HYTreeNodeData | null;
  readonly targetList: HYTreeNodeData[];
  readonly insertIndex: number;
  readonly expandedNextParent: boolean;
}

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
    const plan = this._createMovePlan(sourceId, targetId);
    if (!plan) return false;
    const destination = this._resolveMoveDestination(plan, position);
    if (!destination) return false;

    plan.sourceList.splice(plan.sourceIndex, 1);
    destination.targetList.splice(destination.insertIndex, 0, plan.source.node);
    this._refreshSiblingIndexes(plan.sourceList);
    if (destination.targetList !== plan.sourceList) this._refreshSiblingIndexes(destination.targetList);
    this._refreshMovedSubtree(plan.source.node, destination.nextParent);
    this._moveVisibleSubtree(
      plan.source.node,
      plan.start,
      plan.count,
      destination.nextParent,
      destination.expandedNextParent,
    );
    return true;
  }

  private _createMovePlan(sourceId: string, targetId: string): TreeMovePlan | null {
    const source = this._nodeIndex.get(sourceId);
    const target = this._nodeIndex.get(targetId);
    if (!source || !target || sourceId === targetId) return null;
    if (target.ancestorIds.includes(sourceId)) return null;

    const sourceList = source.parent?.children ?? this._data;
    const sourceIndex = source.index;
    if (sourceIndex < 0) return null;
    return { source, target, sourceList, sourceIndex, ...this._visibleRange(source) };
  }

  private _visibleRange(source: IndexedTreeNode): VisibleRange {
    const start = this._visibleIndex.get(source.node.id) ?? -1;
    if (start < 0) return { start, count: 0 };
    let count = 1;
    while (start + count < this._visibleNodes.length
      && (this._visibleNodes[start + count]?.depth ?? -1) > source.depth) {
      count++;
    }
    return { start, count };
  }

  private _resolveMoveDestination(
    plan: TreeMovePlan,
    position: HYTreeDropPosition,
  ): TreeMoveDestination | null {
    if (position === 'inside') {
      plan.target.node.children ??= [];
      const expandedNextParent = !this._expandedIds.has(plan.target.node.id);
      this._expandedIds.add(plan.target.node.id);
      return {
        nextParent: plan.target.node,
        targetList: plan.target.node.children,
        insertIndex: plan.target.node.children.length,
        expandedNextParent,
      };
    }

    const targetList = plan.target.parent?.children ?? this._data;
    let targetIndex = plan.target.index;
    if (plan.sourceList === targetList && plan.sourceIndex < targetIndex) targetIndex--;
    if (targetIndex < 0) return null;
    return {
      nextParent: plan.target.parent,
      targetList,
      insertIndex: position === 'before' ? targetIndex : targetIndex + 1,
      expandedNextParent: false,
    };
  }

  private _refreshMovedSubtree(source: HYTreeNodeData, nextParent: HYTreeNodeData | null): void {
    const parentIndex = nextParent ? this._nodeIndex.get(nextParent.id) : null;
    const ancestorIds = parentIndex && nextParent ? [...parentIndex.ancestorIds, nextParent.id] : [];
    this._refreshSubtreeIndex(
      source,
      nextParent,
      parentIndex ? parentIndex.depth + 1 : 0,
      ancestorIds,
    );
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
    this._removeVisibleRange(previousStart, previousCount);
    if (expandedNextParent && nextParent) {
      this._insertExpandedChildren(nextParent);
      return;
    }
    const insertAt = this._resolveVisibleInsertAt(source, nextParent);
    if (insertAt >= 0) this._insertVisibleSubtrees(insertAt, [source]);
  }

  private _removeVisibleRange(start: number, count: number): void {
    if (start < 0 || count <= 0) return;
    this._visibleNodes.splice(start, count);
    this._visibleIds.splice(start, count);
    this._refreshVisibleIndexes(start);
  }

  private _insertExpandedChildren(parent: HYTreeNodeData): void {
    const parentVisible = this._visibleIndex.get(parent.id);
    if (parentVisible === undefined) return;
    this._insertVisibleSubtrees(parentVisible + 1, parent.children ?? []);
  }

  private _resolveVisibleInsertAt(source: HYTreeNodeData, nextParent: HYTreeNodeData | null): number {
    const sourceIndex = this._nodeIndex.get(source.id)?.index ?? -1;
    if (sourceIndex < 0) return -1;
    const siblings = nextParent?.children ?? this._data;
    if (!nextParent) return sourceIndex === 0 ? 0 : this._visibleSubtreeEnd(siblings[sourceIndex - 1]?.id);
    const parentVisible = this._visibleIndex.get(nextParent.id);
    if (parentVisible === undefined || !this._expandedIds.has(nextParent.id)) return -1;
    return sourceIndex === 0
      ? parentVisible + 1
      : this._visibleSubtreeEnd(siblings[sourceIndex - 1]?.id);
  }

  private _insertVisibleSubtrees(insertAt: number, roots: readonly HYTreeNodeData[]): void {
    const moved: IndexedTreeNode[] = [];
    for (const root of roots) this._collectVisibleSubtree(root, moved);
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
