export interface GETreeNodeData {
  id: string;
  label?: string;
  icon?: string;
  expanded?: boolean;
  renderer?: string;
  children?: GETreeNodeData[];
  [key: string]: unknown;
}

export type GETreeDropPosition = 'before' | 'after' | 'inside';

export interface GETreeSelectionChangeDetail {
  selectedId: string | null;
  node: GETreeNodeData | null;
  selectedIds: string[];
  nodes: GETreeNodeData[];
}

export interface GETreeDataChangeDetail {
  data: GETreeNodeData[];
  action?: 'copy' | 'paste' | 'delete' | 'drop';
  sourceId?: string;
  targetId?: string | null;
  dropPosition?: GETreeDropPosition;
  pastedNodes?: GETreeNodeData[];
  deletedIds?: string[];
}

export interface GETreeNodeContextMenuDetail {
  id: string;
  node: GETreeNodeData;
  selectedIds: string[];
  clientX: number;
  clientY: number;
}

export interface FlatTreeNode {
  node: GETreeNodeData;
  parent: GETreeNodeData | null;
  depth: number;
}

export interface IndexedTreeNode extends FlatTreeNode {
  ancestorIds: readonly string[];
  index: number;
}
