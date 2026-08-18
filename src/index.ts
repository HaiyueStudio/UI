import { defineButtonComponents } from './button.js';
import { defineTreeComponents } from './tree.js';
import { defineSplitComponents } from './split.js';
import { defineSelectComponents } from './select.js';
import { defineTabsComponents } from './tabs.js';
import { defineContextMenuComponents } from './context-menu.js';
import { defineDropdownComponents } from './dropdown.js';
import { defineTooltipComponents } from './tooltip.js';
import { defineCheckboxComponents } from './checkbox.js';
import { defineRadioComponents } from './radio.js';
import { defineDialogComponents } from './dialog.js';
import { defineInputComponents } from './input.js';
import { defineHistoryControlsComponents } from './history-controls.js';

export {
  defineButtonComponents,
  GEButton,
} from './button.js';
export {
  defineTreeComponents,
  GETree,
  GETreeNode,
} from './tree.js';
export {
  defineSplitComponents,
  GESplit,
} from './split.js';
export {
  defineSelectComponents,
  GESelect,
} from './select.js';
export {
  defineTabsComponents,
  GETabs,
} from './tabs.js';
export {
  defineContextMenuComponents,
  GEContextMenu,
} from './context-menu.js';
export {
  defineDropdownComponents,
  GEDropdown,
} from './dropdown.js';
export {
  defineTooltipComponents,
  GETooltip,
} from './tooltip.js';
export {
  defineCheckboxComponents,
  GECheckbox,
} from './checkbox.js';
export {
  defineRadioComponents,
  GERadio,
} from './radio.js';
export {
  defineDialogComponents,
  GEDialog,
} from './dialog.js';
export {
  defineInputComponents,
  GEInput,
} from './input.js';
export {
  defineHistoryControlsComponents,
  GEHistoryControls,
} from './history-controls.js';
export type {
  GEHistoryEntry,
} from './history-controls.js';
export type {
  GESplitDirection,
  GESplitRatioChangeDetail,
} from './split.js';
export type {
  GESelectChangeDetail,
  GESelectOption,
} from './select.js';
export type {
  GETabChangeDetail,
  GETabOption,
} from './tabs.js';
export type {
  GEContextMenuItem,
  GEContextMenuSelectDetail,
} from './context-menu.js';
export type {
  GEDropdownItem,
  GEDropdownPlacement,
  GEDropdownSelectDetail,
} from './dropdown.js';
export type {
  GETooltipPlacement,
} from './tooltip.js';
export type {
  GECheckboxChangeDetail,
} from './checkbox.js';
export type {
  GERadioChangeDetail,
} from './radio.js';
export type {
  GEDialogCloseDetail,
  GEDialogCloseReason,
} from './dialog.js';
export type {
  GEInputChangeDetail,
  GEInputType,
} from './input.js';
export type {
  GETreeDataChangeDetail,
  GETreeDropPosition,
  GETreeNodeContextMenuDetail,
  GETreeNodeData,
  GETreeSelectionChangeDetail,
} from './tree.js';

export function defineHaiyueUI(): void {
  defineButtonComponents();
  defineTreeComponents();
  defineSplitComponents();
  defineSelectComponents();
  defineTabsComponents();
  defineContextMenuComponents();
  defineDropdownComponents();
  defineTooltipComponents();
  defineCheckboxComponents();
  defineRadioComponents();
  defineDialogComponents();
  defineInputComponents();
  defineHistoryControlsComponents();
}
