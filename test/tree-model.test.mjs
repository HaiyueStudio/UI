import test from 'node:test';
import assert from 'node:assert/strict';
import { HYTreeModel } from '../dist/tree-model.js';

function fixture() {
  return [
    {
      id: 'root-a',
      children: [
        { id: 'child-a' },
        { id: 'child-b', children: [{ id: 'grandchild' }] },
      ],
    },
    { id: 'root-b' },
  ];
}

test('tree model builds stable hierarchy and visible indexes', () => {
  const expanded = new Set(['root-a', 'child-b', 'missing']);
  const model = new HYTreeModel(expanded);
  model.setData(fixture());

  assert.deepEqual([...model.index.keys()], ['root-a', 'child-a', 'child-b', 'grandchild', 'root-b']);
  assert.deepEqual(model.getVisibleIds(), ['root-a', 'child-a', 'child-b', 'grandchild', 'root-b']);
  assert.deepEqual(model.getIndexedNode('grandchild')?.ancestorIds, ['root-a', 'child-b']);
  assert.equal(model.getIndexedNode('grandchild')?.depth, 2);
  assert.equal(expanded.has('missing'), false);
});

test('tree model invalidates visibility without rebuilding data ownership', () => {
  const expanded = new Set(['root-a']);
  const data = fixture();
  const model = new HYTreeModel(expanded);
  model.setData(data);
  assert.deepEqual(model.getVisibleIds(), ['root-a', 'child-a', 'child-b', 'root-b']);

  expanded.add('child-b');
  model.invalidateVisibility();
  assert.deepEqual(model.getVisibleIds(), ['root-a', 'child-a', 'child-b', 'grandchild', 'root-b']);
  assert.equal(model.findNode('grandchild')?.node, data[0].children[1].children[0]);
});

test('tree model moves siblings and reparents subtrees atomically', () => {
  const expanded = new Set(['root-a']);
  const data = fixture();
  const model = new HYTreeModel(expanded);
  model.setData(data);

  assert.equal(model.moveNode('child-b', 'child-a', 'before'), true);
  assert.deepEqual(data[0].children.map(node => node.id), ['child-b', 'child-a']);
  assert.equal(model.getIndexedNode('child-b')?.index, 0);

  assert.equal(model.moveNode('root-b', 'child-b', 'inside'), true);
  assert.deepEqual(data.map(node => node.id), ['root-a']);
  assert.deepEqual(data[0].children[0].children.map(node => node.id), ['grandchild', 'root-b']);
  assert.equal(model.getIndexedNode('root-b')?.parent?.id, 'child-b');
  assert.equal(expanded.has('child-b'), true);
});

test('tree model updates moves incrementally without rebuilding unrelated index records', () => {
  const expanded = new Set(['root-a', 'child-b']);
  const model = new HYTreeModel(expanded);
  model.setData(fixture());
  const unaffected = model.getIndexedNode('child-a');
  const moved = model.getIndexedNode('root-b');

  assert.equal(model.moveNode('root-b', 'child-b', 'inside'), true);
  assert.equal(model.getIndexedNode('child-a'), unaffected);
  assert.equal(model.getIndexedNode('root-b'), moved);
  assert.deepEqual(model.getVisibleIds(), ['root-a', 'child-a', 'child-b', 'grandchild', 'root-b']);
});

test('tree model keeps visible indexes coherent when moving into a collapsed parent', () => {
  const expanded = new Set(['root-a']);
  const data = fixture();
  const model = new HYTreeModel(expanded);
  model.setData(data);

  assert.equal(model.moveNode('root-b', 'child-b', 'inside'), true);
  assert.deepEqual(model.getVisibleIds(), ['root-a', 'child-a', 'child-b', 'grandchild', 'root-b']);
  assert.equal(model.visibleIndex.get('grandchild'), 3);
  assert.equal(model.visibleIndex.get('root-b'), 4);
  assert.equal(model.getIndexedNode('root-b')?.depth, 2);
  assert.equal(expanded.has('child-b'), true);
});

test('tree model rejects cycles and collapses nested selections', () => {
  const model = new HYTreeModel(new Set(['root-a', 'child-b']));
  const data = fixture();
  model.setData(data);

  assert.equal(model.moveNode('root-a', 'grandchild', 'inside'), false);
  assert.deepEqual(data.map(node => node.id), ['root-a', 'root-b']);
  assert.deepEqual(
    model.topLevelSelection(['grandchild', 'root-a', 'child-b', 'root-b', 'missing']),
    ['root-a', 'root-b'],
  );
});

test('tree model removes nodes and prunes stale expansion state', () => {
  const expanded = new Set(['root-a', 'child-b']);
  const model = new HYTreeModel(expanded);
  const data = fixture();
  model.setData(data);

  assert.equal(model.removeNode('child-b'), true);
  assert.equal(model.removeNode('child-b'), false);
  assert.deepEqual(data[0].children.map(node => node.id), ['child-a']);
  assert.equal(model.index.has('grandchild'), false);
  assert.equal(expanded.has('child-b'), false);
});
