export interface HYTreeNodeData {
  id: string;
  label?: string;
  icon?: string;
  expanded?: boolean;
  renderer?: string;
  children?: HYTreeNodeData[];
  [key: string]: unknown;
}

export type HYTreeDropPosition = 'before' | 'after' | 'inside';

export interface HYTreeSelectionChangeDetail {
  selectedId: string | null;
  node: HYTreeNodeData | null;
  selectedIds: string[];
  nodes: HYTreeNodeData[];
}

export interface HYTreeDataChangeDetail {
  data: HYTreeNodeData[];
  action?: 'copy' | 'paste' | 'delete' | 'drop';
  sourceId?: string;
  targetId?: string | null;
  dropPosition?: HYTreeDropPosition;
  pastedNodes?: HYTreeNodeData[];
  deletedIds?: string[];
}

export interface HYTreeNodeContextMenuDetail {
  id: string;
  node: HYTreeNodeData;
  selectedIds: string[];
  clientX: number;
  clientY: number;
}

export interface FlatTreeNode {
  node: HYTreeNodeData;
  parent: HYTreeNodeData | null;
  depth: number;
}

export interface IndexedTreeNode extends FlatTreeNode {
  ancestorIds: readonly string[];
  index: number;
}
