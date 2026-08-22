import { defineButtonComponents } from './button.js';
import { defineBorderBeamComponents } from './border-beam.js';
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
import { defineDrawerComponents } from './drawer.js';
import { defineInputComponents } from './input.js';
import { defineNotificationComponents } from './notification.js';
import { defineHistoryControlsComponents } from './history-controls.js';
import { defineVirtualListComponents } from './virtual-list.js';

export {
  defineButtonComponents,
  HYButton,
} from './button.js';
export {
  defineBorderBeamComponents,
  HYBorderBeam,
} from './border-beam.js';
export {
  defineTreeComponents,
  HYTree,
  HYTreeNode,
} from './tree.js';
export {
  defineSplitComponents,
  HYSplit,
} from './split.js';
export {
  defineSelectComponents,
  HYSelect,
} from './select.js';
export {
  defineTabsComponents,
  HYTabs,
} from './tabs.js';
export {
  defineContextMenuComponents,
  HYContextMenu,
} from './context-menu.js';
export {
  defineDropdownComponents,
  HYDropdown,
} from './dropdown.js';
export {
  defineTooltipComponents,
  HYTooltip,
} from './tooltip.js';
export {
  defineCheckboxComponents,
  HYCheckbox,
} from './checkbox.js';
export {
  defineRadioComponents,
  HYRadio,
} from './radio.js';
export {
  defineDialogComponents,
  HYDialog,
} from './dialog.js';
export {
  defineDrawerComponents,
  HYDrawer,
} from './drawer.js';
export {
  defineInputComponents,
  HYInput,
} from './input.js';
export {
  defineNotificationComponents,
  HYNotification,
} from './notification.js';
export {
  defineHistoryControlsComponents,
  HYHistoryControls,
} from './history-controls.js';
export type {
  HYHistoryEntry,
} from './history-controls.js';
export {
  calculateVirtualListRange,
  defineVirtualListComponents,
  HYVirtualList,
} from './virtual-list.js';
export type {
  HYVirtualListAlign,
  HYVirtualListItemClickDetail,
  HYVirtualListItemRenderer,
  HYVirtualListRange,
  HYVirtualListRangeChangeDetail,
} from './virtual-list.js';
export type {
  HYSplitDirection,
  HYSplitRatioChangeDetail,
} from './split.js';
export type {
  HYSelectChangeDetail,
  HYSelectOption,
} from './select.js';
export type {
  HYTabChangeDetail,
  HYTabOption,
} from './tabs.js';
export type {
  HYContextMenuItem,
  HYContextMenuSelectDetail,
} from './context-menu.js';
export type {
  HYDropdownItem,
  HYDropdownPlacement,
  HYDropdownSelectDetail,
} from './dropdown.js';
export type {
  HYTooltipPlacement,
} from './tooltip.js';
export type {
  HYCheckboxChangeDetail,
} from './checkbox.js';
export type {
  HYRadioChangeDetail,
} from './radio.js';
export type {
  HYDialogCloseDetail,
  HYDialogCloseReason,
} from './dialog.js';
export type {
  HYDrawerCloseDetail,
  HYDrawerCloseReason,
  HYDrawerPlacement,
} from './drawer.js';
export type {
  HYInputChangeDetail,
  HYInputType,
} from './input.js';
export type {
  HYNotificationCloseDetail,
  HYNotificationCloseReason,
  HYNotificationMethodOptions,
  HYNotificationOpenDetail,
  HYNotificationOptions,
  HYNotificationPlacement,
  HYNotificationType,
} from './notification.js';
export type {
  HYTreeDataChangeDetail,
  HYTreeDropPosition,
  HYTreeNodeContextMenuDetail,
  HYTreeNodeData,
  HYTreeSelectionChangeDetail,
} from './tree.js';

export function defineHaiyueUI(): void {
  defineBorderBeamComponents();
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
  defineDrawerComponents();
  defineInputComponents();
  defineNotificationComponents();
  defineHistoryControlsComponents();
  defineVirtualListComponents();
}
