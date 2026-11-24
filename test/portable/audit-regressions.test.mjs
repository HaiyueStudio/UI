import test from 'node:test';
import assert from 'node:assert/strict';
import { hyNode as n, hyValidateNode, hyValidateProps, hyValidateCapabilities, HYUIError, HYSelectionController, HYPlatformViewController } from '../../dist/core/index.js';
import { HYPage } from '../../dist/portable/index.js';
import { RecordingRenderer, store } from './recording.mjs';

const root = children => n('Column', 'root', {}, { children });
const text = (key, value = key) => n('Text', key, { text: value });
function setup(children = [text('a'), text('b')]) {
  const renderer = new RecordingRenderer(), page = new HYPage(renderer);
  page.mount(root(children)); return { page, renderer };
}

test('grouped bindings respect individual equality and still recover after external writes', () => {
  const state = store({ a: 'a', b: 'b' }), { page, renderer } = setup();
  page.bind(state, [
    { key: '/root/a', kind: 'Text', select: s => ({ text: s.a }), equal: (a, b) => a.text.toLowerCase() === b.text.toLowerCase() },
    { key: '/root/b', kind: 'Text', select: s => ({ text: s.b }) },
  ]);
  state.dispatch({ a: 'A' }); assert.equal(renderer.batches.length, 1);
  state.dispatch({ b: 'B' });
  assert.equal(renderer.props('/root/a').text, 'a');
  assert.deepEqual(renderer.batches.at(-1).mutations.map(m => m.node.key), ['/root/b']);
  page.setProps('/root/a', 'Text', { text: 'external' }); state.dispatch({ b: 'C' });
  assert.equal(renderer.props('/root/a').text, 'A'); page.dispose();
});

test('nested drafts retain rollback boundaries and immutable prior mutations', () => {
  const { page, renderer } = setup(); const prior = renderer.batches[0].mutations.find(m => m.node?.key === '/root/a').node;
  page.transaction(() => {
    page.setProps('/root/a', 'Text', { text: 'outer' });
    assert.throws(() => page.transaction(() => {
      page.setProps('/root/a', 'Text', { text: 'inner' });
      page.render(root([text('a', 'inner topology'), text('c')])); throw new Error('rollback inner');
    }), /rollback inner/);
    page.setProps('/root/b', 'Text', { text: 'after inner' });
  });
  assert.equal(renderer.props('/root/a').text, 'outer'); assert.equal(renderer.props('/root/b').text, 'after inner');
  assert.equal(renderer.nodes.has('/root/c'), false);
  assert.equal(prior.props.text, 'a'); assert.ok(Object.isFrozen(prior.props));
  assert.throws(() => page.transaction(() => {
    page.transaction(() => page.render(root([text('a', 'discard'), text('c')])));
    throw new Error('rollback outer');
  }), /rollback outer/);
  page.setProps('/root/b', 'Text', { text: 'final' });
  assert.equal(renderer.props('/root/a').text, 'outer'); assert.equal(renderer.nodes.has('/root/c'), false);
  const batches = renderer.batches.length;
  page.transaction(() => { page.setProps('/root/a', 'Text', { text: 'temporary' }); page.setProps('/root/a', 'Text', { text: 'outer' }); });
  assert.equal(renderer.batches.length, batches); page.dispose();
});

test('one transaction avoids whole-page copying for each property edit', () => {
  const { page, renderer } = setup(Array.from({ length: 1000 }, (_, i) => text(String(i))));
  const OriginalMap = globalThis.Map; let copiedEntries = 0;
  try {
    globalThis.Map = class extends OriginalMap {
      constructor(iterable) { super(iterable); if (iterable instanceof OriginalMap) copiedEntries += iterable.size; }
    };
    page.transaction(() => { for (let i = 0; i < 100; i++) page.setProps('/root/0', 'Text', { text: String(i + 1) }); });
  } finally { globalThis.Map = OriginalMap; }
  assert.ok(copiedEntries <= renderer.nodes.size * 3, `Copied ${copiedEntries} entries for ${renderer.nodes.size} nodes`);
  assert.equal(renderer.batches.at(-1).mutations.length, 1);
  assert.equal(renderer.props('/root/0').text, '100'); page.dispose();
});

test('faulted transactions retain the latest desired state for rebuild', () => {
  const { page, renderer } = setup(); renderer.failAt = 0;
  assert.throws(() => page.transaction(() => page.setProps('/root/a', 'Text', { text: 'failed write' })), HYUIError);
  page.transaction(() => { page.setProps('/root/a', 'Text', { text: 'latest' }); page.setProps('/root/b', 'Text', { text: 'also latest' }); });
  const fresh = new RecordingRenderer(); page.rebuild(fresh);
  assert.equal(fresh.props('/root/a').text, 'latest'); assert.equal(fresh.props('/root/b').text, 'also latest'); page.dispose();
});

for (const [kind, props] of [
  ['Checkbox', { checked: false, text: 'Accept' }],
  ['RadioGroup', { value: 'a', options: [{ value: 'a', label: 'A' }] }],
  ['Rate', { value: 1, count: 5 }],
]) test(`${kind} participates in modal initial focus`, () => {
  const { page, renderer } = setup([n('Dialog', 'dialog', { open: true, title: 'Choice' }, { children: [n(kind, 'field', props), n('Button', 'later', { text: 'Later' })] })]);
  assert.equal(renderer.focused.at(-1), '/root/dialog/field'); page.dispose();
});

test('non-enumerable required fields and array accessors are rejected without evaluating getters', () => {
  for (const value of [42, 'valid but hidden']) {
    const props = Object.defineProperty({}, 'text', { value });
    assert.throws(() => n('Text', 'hidden', props), HYUIError);
  }
  let calls = 0;
  const options = [null]; Object.defineProperty(options, '0', { enumerable: true, get() { calls++; return { value: 'a', label: 'A' }; } });
  assert.throws(() => new HYSelectionController('selection', { value: 'a', options }, () => {}), HYUIError);
  assert.equal(calls, 0);
  const value = Object.assign(Object.create(null), { text: 'Plain data' });
  assert.equal(n('Text', 'null-proto', value).props.text, 'Plain data');
});

test('all node metadata and capability collections use descriptor-safe data', () => {
  let calls = 0;
  for (const key of ['source', 'slots', 'children', 'requires', 'props']) {
    const node = { kind: 'Column', key: 'root', props: {} };
    Object.defineProperty(node, key, { enumerable: true, get() { calls++; throw new Error('Getter must not run'); } });
    assert.throws(() => hyValidateNode(node), HYUIError);
  }
  const content = Object.defineProperty({}, 'children', { enumerable: true, get() { calls++; return []; } });
  assert.throws(() => n('Column', 'root', {}, content), HYUIError);
  assert.equal(calls, 0);
  const caps = new RecordingRenderer().capabilities;
  const bad = Object.defineProperty({ ...caps }, 'features', { enumerable: true, get() { calls++; return []; } });
  assert.throws(() => hyValidateCapabilities(bad), HYUIError);
  assert.equal(calls, 0);
  for (const options of [Array(1), Object.assign([{ value: 'a', label: 'A' }], { extra: true }), Object.assign([{ value: 'a', label: 'A' }], { [Symbol.iterator]: function* () {} })]) {
    assert.throws(() => hyValidateProps('Select', { value: 'a', options }), HYUIError);
  }
});

test('mutable and shallow-frozen inputs never alter previously accepted snapshots', () => {
  const options = [{ value: 'a', label: 'A' }], source = { file: 'view.ts', line: 1 };
  const node = n('Select', 'select', Object.freeze({ value: 'a', options }), { source });
  options[0].label = 42; source.line = 99;
  assert.equal(node.props.options[0].label, 'A'); assert.equal(node.source.line, 1);
  assert.ok(Object.isFrozen(node.props.options[0]));
  assert.throws(() => n('Select', 'invalid', { value: 'a', options }), HYUIError);
});

test('PlatformView preserves both initialization and cleanup failures and disposes once', () => {
  const initial = new Error('mount failed'), cleanup = new Error('cleanup failed'); let disposed = 0;
  const controller = new HYPlatformViewController(() => ({ mount() { throw initial; }, update() {}, layout() {}, visible() {}, focus() {}, dispose() { disposed++; throw cleanup; } }), 'resource');
  assert.throws(() => controller.mount(), error => {
    assert.ok(error instanceof AggregateError); assert.deepEqual(error.errors, [initial, cleanup]); assert.equal(error.cause, initial); return true;
  });
  controller.dispose(); assert.equal(disposed, 1); assert.throws(() => controller.mount(), HYUIError);
});
