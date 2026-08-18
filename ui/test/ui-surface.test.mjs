import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.HTMLElement ??= class HTMLElement {};

test('UI root keeps the supported component surface importable', async () => {
  const ui = await import('../dist/index.js');
  const expected = [
    'GEButton',
    'GECheckbox',
    'GEContextMenu',
    'GEDialog',
    'GEDropdown',
    'GEInput',
    'GERadio',
    'GESelect',
    'GESplit',
    'GETabs',
    'GETooltip',
    'GETree',
    'GETreeNode',
    'defineCheckboxComponents',
    'defineContextMenuComponents',
    'defineDialogComponents',
    'defineDropdownComponents',
    'defineInputComponents',
    'defineHaiyueUI',
    'defineRadioComponents',
    'defineSelectComponents',
    'defineSplitComponents',
    'defineTabsComponents',
    'defineTooltipComponents',
    'defineTreeComponents',
  ];
  assert.deepEqual(Object.keys(ui).sort(), expected.sort());
});

test('tree orchestrator delegates DOM-free hierarchy ownership to tree-model', () => {
  const tree = readFileSync(new URL('../src/tree.ts', import.meta.url), 'utf8');
  const model = readFileSync(new URL('../src/tree-model.ts', import.meta.url), 'utf8');
  const node = readFileSync(new URL('../src/tree-node.ts', import.meta.url), 'utf8');
  assert.match(tree, /new GETreeModel\(this\._expandedIds\)/);
  assert.doesNotMatch(model, /\bdocument\b|\bHTMLElement\b|\bcustomElements\b/);
  assert.match(node, /class GETreeNode extends HTMLElement/);
  assert.ok(tree.split('\n').length <= 1050, 'tree.ts must remain an orchestrator, not absorb model/view ownership');
});

test('shared input keeps native constraints and emits one composed commit contract', () => {
  const input = readFileSync(new URL('../src/input.ts', import.meta.url), 'utf8');
  assert.match(input, /export class GEInput extends HTMLElement/);
  assert.match(input, /'text' \| 'number' \| 'color'/);
  assert.match(input, /CustomEvent<GEInputChangeDetail>\('value-change'/);
  assert.match(input, /bubbles: true,[\s\S]*composed: true/);
  assert.match(input, /this\._input\.validity\.valid/);
});

test('shared select preserves options assigned before connection', () => {
  const select = readFileSync(new URL('../src/select.ts', import.meta.url), 'utf8');
  assert.match(select, /if \(this\.hasAttribute\('options'\)\) this\._readOptionsAttribute\(\)/);
  assert.doesNotMatch(select, /private _syncFromAttributes\(\): void \{\s*this\._readOptionsAttribute\(\)/);
});
