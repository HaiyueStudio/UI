import test from 'node:test';
import assert from 'node:assert/strict';
import { hyNode as n, hyKey, HYUIError } from '../../dist/core/index.js';
import { HYPage } from '../../dist/portable/index.js';
import { RecordingRenderer, store } from './recording.mjs';
const root = (children, slots) => n('Column','root',{}, { children, ...(slots ? { slots } : {}) });
const label = (key, text = key) => n('Text', key, { text });
const key = name => hyKey('root', name);
function setup(tree = root([label('a'), label('b')]), options) {
  const renderer = new RecordingRenderer(), events = [];
  const page = new HYPage(renderer, { onEvent: e => events.push(e), ...options });
  page.mount(tree); return { page, renderer, events };
}

test('mount creates shallow instances then inserts; same props cause zero writes', () => {
  const { page, renderer } = setup();
  assert.deepEqual(renderer.order('/root'), [key('a'),key('b')]);
  page.render(root([label('a'), label('b')])); page.setProps(key('a'),'Text',{text:'a'});
  assert.equal(renderer.batches.length, 1); assert.equal(page.revision, 1);
  assert.throws(() => page.mount(root([])), /only mount once/);
});
test('a property update only writes its node and full replacement removes old properties', () => {
  const { page, renderer } = setup(root([n('Text','a',{text:'a', wrap:true}),label('b')]));
  const before = renderer.nodes.get(key('a')).instance;
  page.setProps(key('a'),'Text',{text:'changed'});
  assert.deepEqual(renderer.batches.at(-1).mutations.map(m => [m.type,m.node.key]), [['update',key('a')]]);
  assert.deepEqual(renderer.props(key('a')), { text:'changed' });
  assert.equal(renderer.nodes.get(key('a')).instance, before);
});
test('nested transaction commits the final diff once; reverted values do not write', () => {
  const { page, renderer } = setup();
  page.transaction(() => {
    page.setProps(key('a'),'Text',{text:'transient'});
    page.transaction(() => page.setProps(key('a'),'Text',{text:'final'}));
    page.setProps(key('b'),'Text',{text:'other'});
  });
  assert.equal(renderer.batches.length,2); assert.equal(renderer.batches[1].mutations.length,2);
  page.transaction(() => { page.setProps(key('a'),'Text',{text:'temp'});page.setProps(key('a'),'Text',{text:'final'}); });
  assert.equal(renderer.batches.length,2);
});
test('validation failure aborts a page transaction before any platform writes', () => {
  const { page, renderer } = setup();
  assert.throws(() => page.transaction(() => { page.setProps(key('a'),'Text',{text:'partial'});page.setProps(key('b'),'Text',{text:42}); }), HYUIError);
  assert.equal(renderer.batches.length,1);
  page.setProps(key('b'),'Text',{text:'done'});
  assert.equal(renderer.props(key('a')).text,'a');
});
test('reorder, insert, remove and named slot migration retain surviving instances', () => {
  const {page,renderer} = setup(root([label('a'),label('b'),label('c')]));
  const ids = [...renderer.nodes].map(([key,node]) => [key,node.instance]);
  page.render(root([label('c'),label('a'),label('b'),label('d')]));
  assert.deepEqual(renderer.order('/root'), ['c','a','b','d'].map(key));
  for (const [key,id] of ids) assert.equal(renderer.nodes.get(key).instance,id);
  page.render(root([label('d'),label('c')], { footer:[label('a')], header:[label('b')] }));
  assert.deepEqual(renderer.order('/root'), ['d','c'].map(key));
  assert.deepEqual(renderer.order('/root','footer'), [key('a')]);
  assert.equal(renderer.released.length,0);
});
test('ancestor removal recursively releases once; changing kind rebuilds its subtree', () => {
  const tree = kind => root([n(kind,'box',{}, {children:[label('child')]})]);
  const { page, renderer } = setup(tree('Column'));
  const old = renderer.nodes.get('/root/box/child').instance;
  page.render(tree('Row'));
  assert.notEqual(renderer.nodes.get('/root/box/child').instance,old);
  assert.equal(renderer.released.length,2);
  assert.deepEqual(renderer.batches.at(-1).mutations.filter(m => m.type === 'remove'), [{type:'remove',key:'/root/box'}]);
  page.render(root([]));page.dispose();page.dispose();
  assert.equal(new Set(renderer.released).size,renderer.released.length);
  assert.equal(renderer.released.length,5);
});
test('same author key is legal under different parents and escaping cannot collide', () => {
  const {renderer} = setup(root([n('Row','left',{}, {children:[label('a/b')]}),n('Row','right',{}, {children:[label('a/b')]})]));
  assert.ok(renderer.nodes.has('/root/left/a~1b'));assert.ok(renderer.nodes.has('/root/right/a~1b'));
  assert.notEqual(hyKey('a/b'),hyKey('a','b'));assert.notEqual(hyKey('a~1b'),hyKey('a/b'));
});
test('one selector subscription batches all targets of a store transaction; unrelated state does no work', () => {
  const s = store({a:'a',b:'b',unrelated:0}); const {page,renderer} = setup();
  const off = page.bind(s,[{key:key('a'),kind:'Text',select:s=>({text:s.a})},{key:key('b'),kind:'Text',select:s=>({text:s.b})}]);
  assert.equal(s.subscriptionCount,1);assert.equal(renderer.batches.length,1);
  assert.throws(()=>page.bind(s,[]),/single bind call/);
  s.dispatch({unrelated:1});assert.equal(renderer.batches.length,1);
  s.transaction(()=>{s.dispatch({a:'temporary'});s.dispatch({a:'A'});s.dispatch({b:'B'});});
  assert.equal(renderer.batches.length,2);assert.equal(renderer.batches[1].mutations.length,2);
  s.dispatch({a:'C'});assert.equal(renderer.batches.at(-1).mutations.length,1);
  off();off();assert.equal(s.subscriptionCount,0);page.dispose();assert.equal(s.disposed,0);
});
test('bindings have custom equality, unsubscribe, and no leaked listeners across 50 lifetimes', () => {
  const s = store({text:'a'});
  for(let i=0;i<50;i++) {
    const {page,renderer} = setup();
    page.bind(s,[{key:key('a'),kind:'Text',select:s=>({text:s.text}),equal:(a,b)=>a.text.toLowerCase()===b.text.toLowerCase()}]);
    s.dispatch({text:'A'});assert.equal(renderer.batches.length,1);
    page.dispose();page.dispose();assert.equal(s.subscriptionCount,0);s.dispatch({text:'a'});
  }
  assert.equal(s.disposed,0);
});
test('grouped bindings revisit only changed targets and invalidate after external writes', () => {
  const s=store({a:'a',b:'b'}),{page,renderer}=setup();
  const writes=[],set=page.setProps.bind(page);
  page.setProps=(...args)=>{writes.push(args[0]);return set(...args);};
  page.bind(s,[{key:key('a'),kind:'Text',select:s=>({text:s.a})},{key:key('b'),kind:'Text',select:s=>({text:s.b})}]);
  writes.length=0;s.dispatch({a:'changed'});
  assert.deepEqual(writes,[key('a')]);assert.equal(renderer.props(key('b')).text,'b');
  page.setProps(key('b'),'Text',{text:'external'});writes.length=0;s.dispatch({a:'next'});
  assert.deepEqual(writes,[key('a'),key('b')]);assert.equal(renderer.props(key('b')).text,'b');
  page.render(root([label('a'),n('Button','b',{text:'b'})]));
  assert.throws(()=>s.dispatch({a:'after render'}),/kind changed/);
  assert.equal(renderer.props(key('a')).text,'a','failed binding transaction rolls back all targets');
  page.dispose();
});
test('programmatic setter echoes and old renderer callbacks never become user events', () => {
  const {page,renderer,events} = setup();renderer.setterFeedback=true;
  page.setProps(key('a'),'Text',{text:'update'});assert.equal(events.length,0);
  renderer.emit({key:key('a'),type:'activate',reason:'pointer',transaction:1});assert.equal(events.length,1);
  page.dispose();renderer.emit({key:key('a'),type:'activate',reason:'pointer',transaction:2});assert.equal(events.length,1);
});
test('suspend queues state changes, ignores events, resume submits once', () => {
  const {page,renderer,events} = setup();page.suspend();page.suspend();
  page.setProps(key('a'),'Text',{text:'a1'});page.setProps(key('b'),'Text',{text:'b1'});
  renderer.emit({key:key('a'),type:'activate',reason:'pointer',transaction:1});assert.equal(events.length,0);
  assert.equal(renderer.batches.length,1);page.resume();page.resume();
  assert.equal(renderer.batches.length,2);assert.deepEqual(renderer.lifecycle,['mount','suspend','resume']);
});
test('partial native failure preserves accepted revision, poisons root and explicitly rebuilds latest state', () => {
  const {page,renderer,events} = setup();renderer.failAt=1;
  assert.throws(()=>page.transaction(()=>{page.setProps(key('a'),'Text',{text:'A'});page.setProps(key('b'),'Text',{text:'B'});}), e => {
    assert.equal(e.context.key,key('b'));assert.equal(e.context.operation,'update');assert.equal(e.context.revision,2);return true;
  });
  assert.equal(page.status,'faulted');assert.equal(page.revision,1);assert.equal(renderer.props(key('a')).text,'A');
  page.setProps(key('a'),'Text',{text:'latest'});assert.equal(renderer.batches.length,2);
  const replacement = new RecordingRenderer();page.rebuild(replacement);
  assert.equal(replacement.props(key('a')).text,'latest');assert.equal(replacement.props(key('b')).text,'B');
  assert.equal(page.status,'mounted');assert.equal(page.revision,2);assert.ok(renderer.disposed);
  renderer.emit({key:key('a'),type:'activate',reason:'pointer',transaction:1});assert.equal(events.length,0);
});
test('bindings stay live during a backend fault and resume after rebuild', () => {
  const s=store({text:'a'}),{page,renderer}=setup();page.bind(s,[{key:key('a'),kind:'Text',select:s=>({text:s.text})}]);
  renderer.failAt=0;assert.throws(()=>s.dispatch({text:'fail'}));s.dispatch({text:'latest'});
  const next=new RecordingRenderer();page.rebuild(next);assert.equal(next.props(key('a')).text,'latest');
  s.dispatch({text:'after'});assert.equal(next.props(key('a')).text,'after');page.dispose();assert.equal(s.subscriptionCount,0);
});
test('focused deletion falls back to dialog, opener, then page default; modal owns back', () => {
  const button = id => n('Button',id,{text:id});
  const tree=(open,children=[button('first'),button('second')])=>root([button('opener'),button('default'),n('Dialog','dialog',{open,title:'Settings'}, {children})]);
  const {page,renderer,events}=setup(tree(false), {defaultFocus:key('default')});
  page.focus(key('opener'));page.render(tree(true));assert.equal(renderer.focused.at(-1),'/root/dialog/first');
  assert.equal(page.focus(key('default')),false);assert.equal(page.back(),true);assert.equal(events.at(-1).type,'cancel');
  page.render(tree(true,[button('second')]));assert.equal(renderer.focused.at(-1),'/root/dialog/second');
  page.render(tree(false));assert.equal(renderer.focused.at(-1),key('opener'));assert.equal(page.back(),false);
  page.render(root([button('default')]));assert.equal(renderer.focused.at(-1),key('default'));
});
test('non-dismissible dialogs consume back without cancel; hidden/disabled ancestors gate actions', () => {
  const {page,renderer,events}=setup(root([n('Dialog','modal',{title:'busy',open:true,dismissible:false})]));
  assert.equal(page.back(),true);assert.equal(events.length,0);
  page.render(root([n('Row','hidden',{visible:false},{children:[n('Button','button',{text:'B'})]})]));
  renderer.emit({key:'/root/hidden/button',type:'activate',reason:'pointer',transaction:1});assert.equal(events.length,0);
});
test('disposal continues after one subscription cleanup throws', () => {
  const {page,renderer}=setup();const s=store({text:'a'});
  const throwing={...s,subscribe(...args){const off=s.subscribe(...args);return()=>{off();throw new Error('off failure');};}};
  page.bind(throwing,[{key:key('a'),kind:'Text',select:s=>({text:s.text})}]);
  page.bind(s,[{key:key('b'),kind:'Text',select:s=>({text:s.text})}]);
  assert.throws(()=>page.dispose(),AggregateError);assert.equal(s.subscriptionCount,0);assert.ok(renderer.disposed);page.dispose();
});
test('deterministic arbitrary reorders match desired tree while preserving surviving instance IDs', () => {
  const {page,renderer}=setup(root([]));let seed=7;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let round=0;round<100;round++) {
    const ids=Array.from({length:12},(_,i)=>String(i)).filter(()=>random()>.2);
    for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
    const previous=new Map([...renderer.nodes].map(([k,n])=>[k,n.instance]));
    page.render(root(ids.map(id=>label(id,`${round}`))));assert.deepEqual(renderer.order('/root'),ids.map(key));
    for(const id of ids) if(previous.has(key(id))) assert.equal(renderer.nodes.get(key(id)).instance,previous.get(key(id)));
  }
});
