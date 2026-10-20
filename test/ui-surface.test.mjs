import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.HTMLElement ??= class HTMLElement {};

test('UI root keeps the supported component surface importable', async () => {
  const ui = await import('../dist/index.js');
  const expected = [
    'HYAffix',
    'HYBadge',
    'HYExpandable',
    'defineExpandableComponents',
    'HYButton',
    'HYButtonGroup',
    'HYBorderBeam',
    'HYBreadcrumb',
    'HYCascader',
    'HYDatePicker',
    'HYCheckbox',
    'HYCollapse',
    'HYContextMenu',
    'HYDialog',
    'HYDivider',
    'HYDrawer',
    'HYDraggable',
    'HYDropdown',
    'HYHistoryControls',
    'HYInput',
    'HYNotification',
    'HYRadio',
    'HYRate',
    'HYRange',
    'HYResizable',
    'HYSelect',
    'HYSkeleton',
    'HYSplit',
    'HYSteps',
    'HYTabs',
    'HYTimeline',
    'HYTooltip',
    'HYTree',
    'HYTreeNode',
    'HYVirtualList',
    'HYVirtualKeyboard',
    'HYVirtualMouse',
    'HY_VIRTUAL_KEYBOARD_NUMERIC_LAYOUT',
    'HY_VIRTUAL_KEYBOARD_QWERTY_LAYOUT',
    'HYWatermark',
    'HYTable',
    'HYTimePicker',
    'HYTour',
    'calculateVirtualListRange',
    'defineButtonComponents',
    'defineButtonGroupComponents',
    'defineAffixComponents',
    'defineBadgeComponents',
    'defineBorderBeamComponents',
    'defineBreadcrumbComponents',
    'defineCascaderComponents',
    'defineDatePickerComponents',
    'defineCheckboxComponents',
    'defineCollapseComponents',
    'defineContextMenuComponents',
    'defineDialogComponents',
    'defineDividerComponents',
    'defineDrawerComponents',
    'defineDraggableComponents',
    'defineDropdownComponents',
    'defineHistoryControlsComponents',
    'defineInputComponents',
    'defineNotificationComponents',
    'defineHaiyueUI',
    'defineRadioComponents',
    'defineRateComponents',
    'defineRangeComponents',
    'defineResizableComponents',
    'defineSelectComponents',
    'defineSkeletonComponents',
    'defineSplitComponents',
    'defineStepsComponents',
    'defineTabsComponents',
    'defineTimelineComponents',
    'defineTooltipComponents',
    'defineTreeComponents',
    'defineVirtualListComponents',
    'defineVirtualKeyboardComponents',
    'defineVirtualMouseComponents',
    'defineWatermarkComponents',
    'defineTableComponents',
    'defineTimePickerComponents',
    'defineTourComponents',
  ];
  assert.deepEqual(Object.keys(ui).sort(), expected.sort());
  assert.equal(Object.keys(ui).some(name => /^GE[A-Z]/u.test(name)), false);
});

test('button exposes a themeable native surface and forwards pressed state for gallery controls', () => {
  const source = readFileSync(new URL('../src/button.ts', import.meta.url), 'utf8');
  assert.match(source, /this\._button\.part\.add\('button'\)/);
  assert.match(source, /this\._button\.type = 'button'/);
  assert.match(source, /'aria-pressed'/);
  assert.match(source, /this\._button\.setAttribute\('aria-pressed', pressed\)/);
  assert.match(source, /get loading\(\): boolean/);
  assert.match(source, /get iconPosition\(\): HYButtonIconPosition/);
  assert.match(source, /this\._spinner\.part\.add\('spinner'\)/);
  assert.match(source, /this\._button\.disabled = this\.hasAttribute\('disabled'\) \|\| loading/);
});

test('button group joins buttons with accessible horizontal and vertical layouts', () => {
  const source = readFileSync(new URL('../src/button-group.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYButtonGroup extends HTMLElement/);
  assert.match(source, /role', 'group'/);
  assert.match(source, /get orientation\(\): HYButtonGroupOrientation/);
  assert.match(source, /::slotted\(hy-button:first-child\)/);
  assert.match(source, /customElements\.define\('hy-button-group'/);
});

test('affix preserves layout while pinning content to window or an owned scroll target', () => {
  const source = readFileSync(new URL('../src/affix.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYAffix extends HTMLElement/);
  assert.match(source, /get topOffset\(\): number \| null/);
  assert.match(source, /get bottomOffset\(\): number \| null/);
  assert.match(source, /get target\(\): HTMLElement \| Window \| null/);
  assert.match(source, /this\._placeholder\.style\.height/);
  assert.match(source, /this\._listeners\?\.abort\(\)/);
  assert.match(source, /this\._resizeObserver\?\.disconnect\(\)/);
  assert.match(source, /CustomEvent<HYAffixChangeDetail>\('affix-change'/);
  assert.match(source, /customElements\.define\('hy-affix'/);
});

test('badge renders bounded counts, dots, semantic statuses, custom colors, and offsets', () => {
  const source = readFileSync(new URL('../src/badge.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYBadge extends HTMLElement/);
  assert.match(source, /get overflowCount\(\): number/);
  assert.match(source, /get showZero\(\): boolean/);
  assert.match(source, /get offset\(\): readonly \[number, number\]/);
  assert.match(source, /value > this\.overflowCount \? `\$\{this\.overflowCount\}\+`/);
  assert.match(source, /role', 'status'/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /customElements\.define\('hy-badge'/);
});

test('collapse exposes accessible multi-panel and accordion disclosure behavior', () => {
  const source = readFileSync(new URL('../src/collapse.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYCollapse extends HTMLElement/);
  assert.match(source, /get activeKeys\(\): readonly HYCollapseKey\[\]/);
  assert.match(source, /get accordion\(\): boolean/);
  assert.match(source, /get destroyOnHidden\(\): boolean/);
  assert.match(source, /button\.setAttribute\('aria-expanded'/);
  assert.match(source, /region\.setAttribute\('role', 'region'\)/);
  assert.match(source, /--hy-collapse-extra-gap, 10px/);
  assert.match(source, /this\.accordion \? \[normalized\]/);
  assert.match(source, /CustomEvent<HYCollapseChangeDetail>\('collapse-change'/);
  assert.match(source, /customElements\.define\('hy-collapse'/);
});

test('tour guides across resolved targets with mask, keyboard, focus, and lifecycle events', () => {
  const source = readFileSync(new URL('../src/tour.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYTour extends HTMLElement/);
  assert.match(source, /'top' \| 'right' \| 'bottom' \| 'left' \| 'center'/);
  assert.match(source, /target\.scrollIntoView/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /this\._returnFocus\?\.focus/);
  assert.match(source, /CustomEvent<HYTourChangeDetail>\('tour-change'/);
  assert.match(source, /CustomEvent<HYTourFinishDetail>\('tour-finish'/);
  assert.match(source, /CustomEvent<HYTourCloseDetail>\('tour-close'/);
  assert.match(source, /customElements\.define\('hy-tour'/);
});

test('date picker exposes an ISO calendar, constraints, keyboard navigation, and owned listener cleanup', () => {
  const source = readFileSync(new URL('../src/date-picker.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYDatePicker extends HTMLElement/);
  assert.match(source, /\^\(\\d\{4\}\)-\(\\d\{2\}\)-\(\\d\{2\}\)\$/);
  assert.match(source, /get weekStart\(\): 0 \| 1/);
  assert.match(source, /'ArrowLeft'.*'ArrowRight'.*'ArrowUp'.*'ArrowDown'/s);
  assert.match(source, /'PageUp'.*'PageDown'/s);
  assert.match(source, /this\._outsideAbort\?\.abort\(\)/);
  assert.match(source, /CustomEvent<HYDatePickerChangeDetail>\('value-change'/);
  assert.match(source, /customElements\.define\('hy-date-picker'/);
});

test('time picker exposes stepped columns, range limits, keyboard navigation, and composed events', () => {
  const source = readFileSync(new URL('../src/time-picker.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYTimePicker extends HTMLElement/);
  assert.match(source, /get showSeconds\(\): boolean/);
  assert.match(source, /get minuteStep\(\): number/);
  assert.match(source, /get secondStep\(\): number/);
  assert.match(source, /role', 'listbox'/);
  assert.match(source, /'ArrowDown'.*'ArrowUp'.*'Home'.*'End'/s);
  assert.match(source, /this\._outsideAbort\?\.abort\(\)/);
  assert.match(source, /CustomEvent<HYTimePickerChangeDetail>\('value-change'/);
  assert.match(source, /customElements\.define\('hy-time-picker'/);
});

test('skeleton swaps loading placeholders for content with bounded and themeable structure', () => {
  const source = readFileSync(new URL('../src/skeleton.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYSkeleton extends HTMLElement/);
  assert.match(source, /get loading\(\): boolean/);
  assert.match(source, /get rows\(\): number/);
  assert.match(source, /get paragraphWidths\(\): readonly string\[\]/);
  assert.match(source, /clampInteger\(this\.getAttribute\('rows'\), 3, 0, 20\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /this\._content\.hidden = loading/);
  assert.match(source, /part\.add\('avatar'\)/);
  assert.match(source, /customElements\.define\('hy-skeleton'/);
});

test('watermark renders protected shadow-owned text or image patterns without intercepting input', () => {
  const source = readFileSync(new URL('../src/watermark.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYWatermark extends HTMLElement/);
  assert.match(source, /patternUnits', 'userSpaceOnUse'/);
  assert.match(source, /pointer-events: none/);
  assert.match(source, /this\.content\.split\(\/\\r\?\\n\/u\)/);
  assert.match(source, /private _renderImage/);
  assert.match(source, /private _renderText/);
  assert.match(source, /rotate\(\$\{this\.rotate\}/);
  assert.match(source, /customElements\.define\('hy-watermark'/);
});

test('timeline renders semantic ordered history with modes, reverse, pending, and custom content hooks', () => {
  const source = readFileSync(new URL('../src/timeline.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYTimeline extends HTMLElement/);
  assert.match(source, /private readonly _list = document\.createElement\('ol'\)/);
  assert.match(source, /'left' \| 'right' \| 'alternate'/);
  assert.match(source, /if \(this\.reverse\) nodes\.unshift\(pending\)/);
  assert.match(source, /get renderItem\(\): HYTimelineItemRenderer \| null/);
  assert.match(source, /get renderDot\(\): HYTimelineDotRenderer \| null/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /customElements\.define\('hy-timeline'/);
});

test('rate supports bounded half stars, clear, keyboard control, and composed events', () => {
  const source = readFileSync(new URL('../src/rate.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYRate extends HTMLElement/);
  assert.match(source, /get allowHalf\(\): boolean/);
  assert.match(source, /const step = this\.allowHalf \? 0\.5 : 1/);
  assert.match(source, /role', 'slider'/);
  assert.match(source, /'ArrowRight'.*'ArrowUp'.*'ArrowLeft'.*'ArrowDown'/s);
  assert.match(source, /CustomEvent<HYRateChangeDetail>\('value-change'/);
  assert.match(source, /CustomEvent<HYRateHoverChangeDetail>\('hover-change'/);
  assert.match(source, /customElements\.define\('hy-rate'/);
});

test('divider exposes semantic orientation, line styles, text placement, and slotted labels', () => {
  const source = readFileSync(new URL('../src/divider.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYDivider extends HTMLElement/);
  assert.match(source, /'solid' \| 'dashed' \| 'dotted' \| 'double'/);
  assert.match(source, /setAttribute\('role', 'separator'\)/);
  assert.match(source, /setAttribute\('aria-orientation', this\.orientation\)/);
  assert.match(source, /this\._slot\.assignedNodes\(\)/);
  assert.match(source, /lineStyle === 'double' \? Math\.max\(3, this\.thickness\)/);
  assert.match(source, /customElements\.define\('hy-divider'/);
});

test('steps exposes semantic status progression, horizontal and vertical layout, and optional navigation', () => {
  const source = readFileSync(new URL('../src/steps.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYSteps extends HTMLElement/);
  assert.match(source, /'horizontal' \| 'vertical'/);
  assert.match(source, /private readonly _list = document\.createElement\('ol'\)/);
  assert.match(source, /index < current \? 'finish' : index === current \? 'process' : 'wait'/);
  assert.match(source, /setAttribute\('aria-current', 'step'\)/);
  assert.match(source, /CustomEvent<HYStepsChangeDetail>\('step-change'/);
  assert.match(source, /customElements\.define\('hy-steps'/);
});

test('cascader owns hierarchical selection, keyboard traversal, and outside-listener cleanup', () => {
  const cascader = readFileSync(new URL('../src/cascader.ts', import.meta.url), 'utf8');
  assert.match(cascader, /export class HYCascader extends HTMLElement/);
  assert.match(cascader, /readonly children\?: readonly HYCascaderOption\[\]/);
  assert.match(cascader, /private _normalizePath/);
  assert.match(cascader, /'ArrowDown'.*'ArrowUp'.*'Home'.*'End'/s);
  assert.match(cascader, /event\.key === 'ArrowRight'/);
  assert.match(cascader, /event\.key === 'ArrowLeft'/);
  assert.match(cascader, /this\._outsideAbort\?\.abort\(\)/);
  assert.match(cascader, /CustomEvent<HYCascaderChangeDetail>\('value-change'/);
  assert.match(cascader, /CustomEvent<HYCascaderOpenChangeDetail>\('open-change'/);
  assert.match(cascader, /customElements\.define\('hy-cascader'/);
});

test('breadcrumb renders accessible navigation, separators, actions, and a cancelable click contract', () => {
  const breadcrumb = readFileSync(new URL('../src/breadcrumb.ts', import.meta.url), 'utf8');
  assert.match(breadcrumb, /export class HYBreadcrumb extends HTMLElement/);
  assert.match(breadcrumb, /this\._nav\.setAttribute\('aria-label'/);
  assert.match(breadcrumb, /element\.setAttribute\('aria-current', 'page'\)/);
  assert.match(breadcrumb, /separator\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(breadcrumb, /CustomEvent<HYBreadcrumbClickDetail>\('breadcrumb-click'/);
  assert.match(breadcrumb, /cancelable: true/);
  assert.match(breadcrumb, /customElements\.define\('hy-breadcrumb'/);
});

test('table composes filtering, stable sorting, pagination, and accessible controls', () => {
  const table = readFileSync(new URL('../src/table.ts', import.meta.url), 'utf8');
  assert.match(table, /export class HYTable.*extends HTMLElement/);
  assert.match(table, /this\._dataSource\.map\(\(record, index\) => \(\{ record, index \}\)\)/);
  assert.match(table, /records\.sort\(\(left, right\) =>/);
  assert.match(table, /slice\(start, start \+ this\._pageSize\)/);
  assert.match(table, /setFilter\(key: string, value: string\)/);
  assert.match(table, /sortBy\(key: string, direction\?: HYTableSortDirection\)/);
  assert.match(table, /goToPage\(value: number\)/);
  assert.match(table, /aria-sort/);
  assert.match(table, /get showFilters\(\): boolean/);
  assert.match(table, /column\.showFilter !== false/);
  assert.match(table, /className = 'filter-trigger'/);
  assert.match(table, /CustomEvent<HYTableChangeDetail<T>>\('table-change'/);
  assert.match(table, /CustomEvent<HYTableRowClickDetail<T>>\('row-click'/);
  assert.match(table, /customElements\.define\('hy-table'/);
});

test('virtual list calculates a buffered, exclusive render range', async () => {
  const { calculateVirtualListRange } = await import('../dist/virtual-list.js');
  assert.deepEqual(calculateVirtualListRange(10_000, 40, 320, 4_000, 3), {
    startIndex: 97,
    endIndex: 111,
    visibleStartIndex: 100,
    visibleEndIndex: 108,
  });
  assert.deepEqual(calculateVirtualListRange(4, 40, 320, 0, 3), {
    startIndex: 0,
    endIndex: 4,
    visibleStartIndex: 0,
    visibleEndIndex: 4,
  });
  assert.deepEqual(calculateVirtualListRange(20, 40, 120, 99_999, 0), {
    startIndex: 17,
    endIndex: 20,
    visibleStartIndex: 17,
    visibleEndIndex: 20,
  });
});

test('virtual list keeps data off-DOM and cleans up owned observers and listeners', () => {
  const source = readFileSync(new URL('../src/virtual-list.ts', import.meta.url), 'utf8');
  assert.match(source, /for \(let index = range\.startIndex; index < range\.endIndex/);
  assert.match(source, /this\._items\[index\]/);
  assert.match(source, /row\.dataset\.hyVirtualListGenerated/);
  assert.match(source, /this\._window\.replaceChildren\(\.\.\.rows\)/);
  assert.doesNotMatch(source, /row\.slot = 'items'/);
  assert.match(source, /this\._resizeObserver\?\.disconnect\(\)/);
  assert.match(source, /removeEventListener\('scroll', this\._onScroll\)/);
  assert.match(source, /'visible-range-change'/);
  assert.match(source, /'item-click'/);
});

test('virtual mouse exposes fixed visuals, state images, movement, and owned interaction cleanup', () => {
  const virtualMouse = readFileSync(new URL('../src/virtual-mouse.ts', import.meta.url), 'utf8');
  assert.match(virtualMouse, /export class HYVirtualMouse extends HTMLElement/);
  assert.match(virtualMouse, /position: fixed !important/);
  assert.match(virtualMouse, /pointer-events: none !important/);
  assert.match(virtualMouse, /moveTo\(x: number, y: number/);
  assert.match(virtualMouse, /moveBy\(deltaX: number, deltaY: number/);
  assert.match(virtualMouse, /press\(button: HYVirtualMouseButton = 'left'\)/);
  assert.match(virtualMouse, /release\(button: HYVirtualMouseButton = 'left'\)/);
  assert.match(virtualMouse, /rightClick\(options:/);
  assert.match(virtualMouse, /idle-image.*left-down-image.*middle-down-image.*right-down-image/s);
  assert.match(virtualMouse, /--hy-virtual-mouse-right-down-background/);
  assert.match(virtualMouse, /this\._cancelMove\(\)/);
  assert.match(virtualMouse, /for \(const cancel of this\._delays\.values\(\)\) cancel\(\)/);
  assert.match(virtualMouse, /CustomEvent<HYVirtualMouseMoveDetail>\('virtual-mouse-move-end'/);
  assert.match(virtualMouse, /CustomEvent<HYVirtualMouseButtonDetail>\(name/);
});

test('virtual keyboard exposes customizable keys, editable targets, API playback, and owned physical listeners', () => {
  const source = readFileSync(new URL('../src/virtual-keyboard.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYVirtualKeyboard extends HTMLElement/);
  assert.match(source, /HY_VIRTUAL_KEYBOARD_QWERTY_LAYOUT/);
  assert.match(source, /HY_VIRTUAL_KEYBOARD_NUMERIC_LAYOUT/);
  assert.match(source, /get mode\(\): HYVirtualKeyboardMode/);
  assert.match(source, /action\('ArrowUp', '↑', 'arrow-up'\)/);
  assert.match(source, /action\('ArrowDown', '↓', 'arrow-down'\)/);
  assert.match(source, /_moveCaretVertical\(direction: -1 \| 1\)/);
  assert.match(source, /press\(code: string/);
  assert.match(source, /release\(code: string/);
  assert.match(source, /async tap\(code: string/);
  assert.match(source, /async type\(text: string/);
  assert.match(source, /target\.setRangeText/);
  assert.match(source, /new InputEvent\('input'/);
  assert.match(source, /event\.getModifierState\('CapsLock'\)/);
  assert.match(source, /this\._listeners\?\.abort\(\)/);
  assert.match(source, /CustomEvent<HYVirtualKeyboardKeyDetail>\(name/);
  assert.match(source, /CustomEvent<HYVirtualKeyboardInputDetail>\('virtual-keyboard-input'/);
  assert.match(source, /customElements\.define\('hy-virtual-keyboard'/);
});

test('draggable exposes constrained pointer, keyboard, and API movement with owned drag cleanup', () => {
  const source = readFileSync(new URL('../src/draggable.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYDraggable extends HTMLElement/);
  assert.match(source, /get axis\(\): HYDraggableAxis/);
  assert.match(source, /get bounds\(\): HYDraggableBounds/);
  assert.match(source, /get grid\(\): number/);
  assert.match(source, /get handle\(\): string/);
  assert.match(source, /get cancel\(\): string/);
  assert.match(source, /moveTo\(x: number, y: number\)/);
  assert.match(source, /moveBy\(deltaX: number, deltaY: number\)/);
  assert.match(source, /setPointerCapture\(event\.pointerId\)/);
  assert.match(source, /this\._dragAbort\?\.abort\(\)/);
  assert.match(source, /Math\.round\(finiteNumber\(x, oldX\) \/ this\.grid\)/);
  assert.match(source, /event\.key === 'ArrowLeft'.*event\.key === 'ArrowRight'.*event\.key === 'ArrowUp'.*event\.key === 'ArrowDown'/s);
  assert.match(source, /CustomEvent<HYDraggableStartDetail>\('drag-start'.*cancelable: true/s);
  assert.match(source, /CustomEvent<HYDraggableMoveDetail>\('drag-move'/);
  assert.match(source, /CustomEvent<HYDraggableEndDetail>\('drag-end'/);
  assert.match(source, /customElements\.define\('hy-draggable'/);
});

test('resizable exposes eight pointer and keyboard handles with constrained rectangle APIs', () => {
  const source = readFileSync(new URL('../src/resizable.ts', import.meta.url), 'utf8');
  assert.match(source, /export class HYResizable extends HTMLElement/);
  assert.match(source, /\['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'\]/);
  assert.match(source, /setRect\(rect: HYResizableRect\)/);
  assert.match(source, /moveTo\(x: number, y: number\)/);
  assert.match(source, /resizeTo\(width: number, height: number\)/);
  assert.match(source, /get aspectRatio\(\): number \| null/);
  assert.match(source, /get bounds\(\): HYResizableBounds/);
  assert.match(source, /setPointerCapture\(event\.pointerId\)/);
  assert.match(source, /this\._dragAbort\?\.abort\(\)/);
  assert.match(source, /event\.key === 'ArrowLeft'.*event\.key === 'ArrowRight'.*event\.key === 'ArrowUp'.*event\.key === 'ArrowDown'/s);
  assert.match(source, /CustomEvent<HYResizableChangeDetail>\('resize-start'.*cancelable: true/s);
  assert.match(source, /CustomEvent<HYResizableChangeDetail>\('resize'/);
  assert.match(source, /CustomEvent<HYResizableEndDetail>\('resize-end'/);
  assert.match(source, /customElements\.define\('hy-resizable'/);
});

test('drawer exposes directional placement, mask, Escape, and hidden-content destruction', () => {
  const drawer = readFileSync(new URL('../src/drawer.ts', import.meta.url), 'utf8');
  assert.match(drawer, /export class HYDrawer extends HTMLElement/);
  assert.match(drawer, /'top' \| 'right' \| 'bottom' \| 'left'/);
  assert.match(drawer, /get mask\(\): boolean/);
  assert.match(drawer, /get destroyOnHidden\(\): boolean/);
  assert.match(drawer, /event\.key === 'Escape'/);
  assert.match(drawer, /this\.close\('mask'\)/);
  assert.match(drawer, /this\._detachedContent\.append/);
  assert.match(drawer, /this\._documentListenerAbort\?\.abort\(\)/);
  assert.match(drawer, /CustomEvent<HYDrawerCloseDetail>\('drawer-close'/);
});

test('notification exposes typed timed stacks with optional progress and owned timer cleanup', () => {
  const notification = readFileSync(new URL('../src/notification.ts', import.meta.url), 'utf8');
  assert.match(notification, /'success' \| 'info' \| 'warning' \| 'error'/);
  assert.match(notification, /'topLeft'[\s\S]*'bottomRight'/);
  assert.match(notification, /open\(options: HYNotificationOptions\): string/);
  assert.match(notification, /success\(options:/);
  assert.match(notification, /showProgress \?\? this\.showProgress/);
  assert.match(notification, /hy-notification-progress/);
  assert.match(notification, /translate3d/);
  assert.match(notification, /window\.setTimeout\(\(\) => this\._closeNotice\(notice, 'timeout'\)/);
  assert.match(notification, /window\.clearTimeout\(notice\.timer\)/);
  assert.match(notification, /CustomEvent<HYNotificationCloseDetail>\('notification-close'/);
});

test('border beam follows the live rounded border with configurable flow instances', () => {
  const borderBeam = readFileSync(new URL('../src/border-beam.ts', import.meta.url), 'utf8');
  assert.match(borderBeam, /export class HYBorderBeam extends HTMLElement/);
  assert.match(borderBeam, /\['thickness', 'speed', 'color', 'count'\]/);
  assert.match(borderBeam, /new ResizeObserver\(\(\) => this\.refresh\(\)\)/);
  assert.match(borderBeam, /this\._resizeObserver\?\.disconnect\(\)/);
  assert.match(borderBeam, /stroke-dasharray/);
  assert.match(borderBeam, /animationDelay/);
  assert.match(borderBeam, /hy-border-beam-flow/);
  assert.match(borderBeam, /customElements\.define\('hy-border-beam'/);
});

test('range supports one or two accessible handles with themeable parts and owned drag cleanup', () => {
  const range = readFileSync(new URL('../src/range.ts', import.meta.url), 'utf8');
  assert.match(range, /export class HYRange extends HTMLElement/);
  assert.match(range, /'lower-value', 'upper-value'/);
  assert.match(range, /get values\(\): readonly \[number, number\]/);
  assert.match(range, /set values\(value: readonly \[number, number\]\)/);
  assert.match(range, /button\.setAttribute\('role', 'slider'\)/);
  assert.match(range, /button\.part\.add\('handle', `handle-\$\{handle\}`\)/);
  assert.match(range, /--hy-range-handle-size/);
  assert.match(range, /--hy-range-rail-height/);
  assert.match(range, /this\._dragAbort\?\.abort\(\)/);
  assert.match(range, /'value-input' \| 'value-change'/);
  assert.match(range, /bubbles: true,[\s\S]*composed: true/);
});

test('history controls are controlled, accessible, and release click listeners', () => {
  const history = readFileSync(new URL('../src/history-controls.ts', import.meta.url), 'utf8');
  assert.match(history, /export class HYHistoryControls extends HTMLElement/);
  assert.match(history, /'undo-request' \| 'redo-request'/);
  assert.match(history, /bubbles: true, composed: true/);
  assert.match(history, /role', 'toolbar'/);
  assert.match(history, /removeEventListener\('click', this\._requestUndo\)/);
  assert.doesNotMatch(history, /window\.addEventListener|\.undo\(\)|\.redo\(\)/);
});

test('tree orchestrator delegates DOM-free hierarchy ownership to tree-model', () => {
  const tree = readFileSync(new URL('../src/tree.ts', import.meta.url), 'utf8');
  const model = readFileSync(new URL('../src/tree-model.ts', import.meta.url), 'utf8');
  const node = readFileSync(new URL('../src/tree-node.ts', import.meta.url), 'utf8');
  assert.match(tree, /new HYTreeModel\(this\._expandedIds\)/);
  assert.doesNotMatch(model, /\bdocument\b|\bHTMLElement\b|\bcustomElements\b/);
  assert.match(node, /class HYTreeNode extends HTMLElement/);
  assert.ok(tree.split('\n').length <= 1050, 'tree.ts must remain an orchestrator, not absorb model/view ownership');
});

test('shared input keeps native constraints and emits one composed commit contract', () => {
  const input = readFileSync(new URL('../src/input.ts', import.meta.url), 'utf8');
  assert.match(input, /export class HYInput extends HTMLElement/);
  assert.match(input, /'text' \| 'number' \| 'color' \| 'search'/);
  assert.match(input, /get prefix\(\): string/);
  assert.match(input, /get suffix\(\): string/);
  assert.match(input, /this\._prefixSlot\.name = 'prefix'/);
  assert.match(input, /this\._suffixSlot\.name = 'suffix'/);
  assert.match(input, /search\(\): boolean/);
  assert.match(input, /event\.key === 'Enter'.*this\.type === 'search'/);
  assert.match(input, /CustomEvent<HYInputSearchDetail>\('search'/);
  assert.match(input, /CustomEvent<HYInputChangeDetail>\('value-change'/);
  assert.match(input, /bubbles: true,[\s\S]*composed: true/);
  assert.match(input, /this\._input\.validity\.valid/);
});

test('shared select preserves options assigned before connection', () => {
  const select = readFileSync(new URL('../src/select.ts', import.meta.url), 'utf8');
  assert.match(select, /if \(this\.hasAttribute\('options'\)\) this\._readOptionsAttribute\(\)/);
  assert.doesNotMatch(select, /private _syncFromAttributes\(\): void \{\s*this\._readOptionsAttribute\(\)/);
});
