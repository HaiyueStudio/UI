import test from 'node:test';
import assert from 'node:assert/strict';
import { HYButtonController, HYToggleController, HYSliderController, HYTextController, HYSelectionController, HYPlatformViewController } from '../../dist/core/index.js';

test('button coalesces shared gesture IDs, blocks busy/disabled, and has no programmatic events', () => {
  const events=[];const c=new HYButtonController('button',{text:'Save'},e=>events.push(e));
  c.activate('pointer','tap:1');c.activate('accessibility','tap:1');assert.equal(events.length,1);
  c.update({text:'Saving',busy:true});assert.equal(c.activate(),false);
  c.update({text:'Save',disabled:true});assert.equal(c.activate(),false);
  c.update({text:'Save'});c.activate('keyboard','key:2');assert.equal(events.length,2);
  c.dispose();assert.equal(c.activate(),false);
});
test('toggle emits one preview/commit pair and same accepted value does not resubmit', () => {
  const events=[];const c=new HYToggleController('toggle',{checked:false},e=>{events.push(e);if(e.type==='commit')c.update({checked:e.value});});
  assert.equal(c.choose(true),true);assert.equal(c.choose(true),false);
  assert.deepEqual(events.map(e=>e.type),['valueChange','commit']);assert.equal(events[0].transaction,events[1].transaction);
  c.update({checked:true,disabled:true});assert.equal(c.choose(false),false);c.dispose();assert.equal(c.choose(false),false);
});
test('slider snaps/clamps changes, has one transaction per gesture and restores rejected value', () => {
  const events=[];const c=new HYSliderController('slider',{value:0,min:0,max:1,step:.1},e=>events.push(e));
  c.change(.26);c.change(.64);c.commit();assert.equal(c.value,0);
  assert.deepEqual(events.map(e=>[e.type,e.value]),[['valueChange',.3],['valueChange',.6],['commit',.6]]);
  assert.equal(new Set(events.map(e=>e.transaction)).size,1);assert.equal(c.commit(),false);
  c.change(20);assert.equal(c.value,1);c.cancel();assert.equal(c.value,0);assert.equal(events.at(-1).type,'cancel');
  c.change(.5);c.update({value:.4,min:0,max:1,step:.1});assert.equal(c.commit(),false);
  c.dispose();assert.equal(c.change(.5),false);
});
test('slider accepted commit updates authoritative value without duplicating events', () => {
  const p={value:2,min:2,max:8,step:2};const events=[];
  const c=new HYSliderController('s',p,e=>{events.push(e);if(e.type==='commit')c.update({...p,value:e.value});});
  c.change(5);c.commit();assert.equal(c.value,6);assert.equal(events.length,2);
});
function text(props={value:'accepted'},multiline=false) {
  const events=[],writes=[];let revision=0;
  const c=new HYTextController('text',props,e=>events.push(e),multiline,revision);
  c.attach({apply:p=>{writes.push(p);c.input('setter feedback');}});
  return {c,events,writes,update:p=>c.update(p,++revision)};
}
test('text keeps rejected draft, same accepted props preserve it and do not produce events', () => {
  const {c,events,writes,update}=text();assert.equal(events.length,0);
  c.input('draft');c.commit();update({value:'accepted',placeholder:'validation failed'});
  assert.equal(c.value,'draft');assert.equal(writes.at(-1).value,'draft');assert.equal(events.length,2);
  c.blur();assert.deepEqual(events.map(e=>e.type),['valueChange','commit','blur']);
});
test('IME confirms final value once and does not use composition Enter as commit', () => {
  const {c,events}=text();c.compositionStart();c.input('ni');c.input('你');c.compositionEnd('你好 👩🏽‍💻');
  assert.equal(c.enter(true),false);assert.equal(c.enter(),true);
  assert.deepEqual(events.map(e=>e.type),['compositionStart','compositionUpdate','compositionUpdate','compositionEnd','valueChange','commit']);
  assert.equal(new Set(events.map(e=>e.transaction)).size,1);assert.equal(events.at(-1).value,'你好 👩🏽‍💻');
});
test('external revisions during composition are queued and latest authoritative value wins', () => {
  const {c,events,update}=text();c.compositionStart();c.input('draft');update({value:'remote1'});update({value:'remote2'});
  assert.equal(c.value,'draft');c.compositionEnd('本地');assert.equal(c.value,'remote2');
  assert.equal(events.at(-1).type,'valueChange');assert.equal(events.at(-1).value,'本地');assert.equal(c.commit(),false);
  c.update({value:'stale'},0);assert.equal(c.value,'remote2');
});
test('newer acceptance during compositionEnd event supersedes older queued external state', () => {
  const c=new HYTextController('text',{value:'a'},e=>{if(e.type==='valueChange')c.update({value:e.value},3);});
  c.compositionStart();c.update({value:'external'},2);c.compositionEnd('local');assert.equal(c.value,'local');
});
test('disabling text mid-composition suppresses late IME completion and commit', () => {
  const {c,events,update}=text();c.compositionStart();c.input('ni');
  update({value:'remote',disabled:true});const count=events.length;
  assert.equal(c.compositionEnd('你'),false);assert.equal(c.commit(),false);assert.equal(events.length,count);assert.equal(c.value,'remote');
});
test('multiline Enter remains editing; blur commits, read-only and disabled block input', () => {
  const {c,events,update}=text({value:''},true);c.input('a\nb');assert.equal(c.enter(),false);c.blur();
  assert.deepEqual(events.map(e=>e.type),['valueChange','commit','blur']);
  update({value:'a\nb',readOnly:true});assert.equal(c.input('bad'),false);
  update({value:'a\nb',disabled:true});assert.equal(c.compositionStart(),false);
});
test('text same-props writes are zero, revisions validated and disposal ignores late input', () => {
  const {c,writes,events}=text();c.update({value:'accepted'},0);assert.equal(writes.length,1);
  assert.throws(()=>c.update({value:'changed'},0),/newer revision/);
  c.input('draft');c.cancel();assert.equal(c.value,'accepted');const count=events.length;
  c.dispose();c.dispose();assert.equal(c.input('late'),false);c.blur();assert.equal(events.length,count);
});
test('selection surfaces picker errors and disposal in preview suppresses commit', async () => {
  const options=[{value:'a',label:'A'},{value:'b',label:'B'}];let events=[];
  const c=new HYSelectionController('s',{value:'a',options},e=>{events.push(e);c.dispose();});
  await assert.rejects(c.pick(async()=>{throw new Error('picker unavailable');}),/unavailable/);
  assert.equal(c.choose('b'),false);assert.deepEqual(events.map(e=>e.type),['valueChange']);
});
test('PlatformView queues before mount, dedupes updates, suspends and releases once', () => {
  const calls=[];let allocated=0;
  const view=()=>{allocated++;return Object.fromEntries(['mount','update','layout','visible','focus','dispose'].map(name=>[name,(...args)=>calls.push([name,...args])]));};
  const c=new HYPlatformViewController(view,'resource:1');
  const bounds={x:0,y:2,width:300,height:200,scale:2};c.layout(bounds);c.update('resource:2');c.visible(false);
  assert.equal(allocated,0);c.mount();assert.equal(allocated,1);
  assert.deepEqual(calls.map(c=>c[0]),['mount','update','layout','visible']);assert.equal(calls[1][1],'resource:2');
  c.layout({...bounds});c.update('resource:2');assert.equal(calls.length,4);
  c.visible(true);c.suspend();c.suspend();c.focus();c.resume();c.focus();c.dispose();c.dispose();c.update('late');
  assert.deepEqual(calls.slice(4).map(c=>c[0]),['visible','visible','visible','focus','dispose']);
});
test('PlatformView mount failure releases allocated resource and cannot silently remount', () => {
  let disposed=0;const c=new HYPlatformViewController(()=>({mount(){throw new Error('failed');},dispose(){disposed++;}}),'r');
  assert.throws(()=>c.mount(),/failed/);c.dispose();assert.equal(disposed,1);assert.throws(()=>c.mount(),/disposed/);
});
