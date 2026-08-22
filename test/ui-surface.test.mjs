import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.HTMLElement ??= class HTMLElement {};

test('UI root keeps the supported component surface importable', async () => {
  const ui = await import('../dist/index.js');
  const expected = [
    'HYButton',
    'HYCheckbox',
    'HYContextMenu',
    'HYDialog',
    'HYDropdown',
    'HYHistoryControls',
    'HYInput',
    'HYRadio',
    'HYSelect',
    'HYSplit',
    'HYTabs',
    'HYTooltip',
    'HYTree',
    'HYTreeNode',
    'HYVirtualList',
    'calculateVirtualListRange',
    'defineButtonComponents',
    'defineCheckboxComponents',
    'defineContextMenuComponents',
    'defineDialogComponents',
    'defineDropdownComponents',
    'defineHistoryControlsComponents',
    'defineInputComponents',
    'defineHaiyueUI',
    'defineRadioComponents',
    'defineSelectComponents',
    'defineSplitComponents',
    'defineTabsComponents',
    'defineTooltipComponents',
    'defineTreeComponents',
    'defineVirtualListComponents',
  ];
  assert.deepEqual(Object.keys(ui).sort(), expected.sort());
  assert.equal(Object.keys(ui).some(name => /^GE[A-Z]/u.test(name)), false);
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
});

test('virtual list keeps data off-DOM and cleans up owned observers and listeners', () => {
  const source = readFileSync(new URL('../src/virtual-list.ts', import.meta.url), 'utf8');
  assert.match(source, /for \(let index = range\.startIndex; index < range\.endIndex/);
  assert.match(source, /this\._items\[index\]/);
  assert.match(source, /itemSlot\.name = 'items'/);
  assert.match(source, /data-hy-virtual-list-generated/);
  assert.match(source, /this\._resizeObserver\?\.disconnect\(\)/);
  assert.match(source, /removeEventListener\('scroll', this\._onScroll\)/);
  assert.match(source, /'visible-range-change'/);
  assert.match(source, /'item-click'/);
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
  assert.match(input, /'text' \| 'number' \| 'color'/);
  assert.match(input, /CustomEvent<HYInputChangeDetail>\('value-change'/);
  assert.match(input, /bubbles: true,[\s\S]*composed: true/);
  assert.match(input, /this\._input\.validity\.valid/);
});

test('shared select preserves options assigned before connection', () => {
  const select = readFileSync(new URL('../src/select.ts', import.meta.url), 'utf8');
  assert.match(select, /if \(this\.hasAttribute\('options'\)\) this\._readOptionsAttribute\(\)/);
  assert.doesNotMatch(select, /private _syncFromAttributes\(\): void \{\s*this\._readOptionsAttribute\(\)/);
});
