import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HYSelectionController} from './selection.mjs';
const options = ['1','.75','.5','.25'].map(value => ({value,label:value}));
function fixture({feedback=false,reject=false}={}) {
  const events=[]; let commits=0, listener, removed=0;
  let props={value:'1',options}; const writes=[];
  const controller=new HYSelectionController('scale',props,event=>{
    events.push(event);
    if(event.type==='commit') {commits++; if(!reject){props={...props,value:event.value};controller.update(props);}}
  });
  const view={apply:p=>{writes.push(p.value);if(feedback)listener?.(p.value);},listen:fn=>{listener=fn;return()=>{listener=undefined;removed++;};}};
  return {controller,view,events,writes,get props(){return props;},get commits(){return commits;},get removed(){return removed;}};
}
test('imports without DOM, NativeScript, or Engine',()=>{
  for(const key of ['window','document','HTMLElement','customElements']) assert.equal(typeof globalThis[key],'undefined');
});
test('properties assigned before native readiness are applied on attach, with no event',()=>{
  const f=fixture();f.controller.update({...f.props,value:'.75'});assert.deepEqual(f.writes,[]);
  f.controller.attach(f.view);assert.deepEqual(f.writes,['.75']);assert.equal(f.commits,0);
});
test('one user selection commits once; programmatic setter feedback is suppressed',()=>{
  const f=fixture({feedback:true});f.controller.attach(f.view);f.controller.choose('.75');
  assert.equal(f.commits,1);assert.equal(f.props.value,'.75');
  assert.deepEqual(f.events.map(e=>e.type),['valueChange','commit']);assert.equal(f.events[0].transaction,f.events[1].transaction);
  f.controller.update(f.props);f.controller.choose('.75');assert.equal(f.commits,1);
});
test('rejected input restores authoritative state',()=>{
  const f=fixture({reject:true});f.controller.attach(f.view);f.controller.choose('.75');
  assert.equal(f.props.value,'1');assert.equal(f.writes.at(-1),'1');
});
test('picker cancel leaves state and event count unchanged',async()=>{
  const f=fixture();assert.equal(await f.controller.pick(async()=>null),false);assert.equal(f.commits,0);
});
test('dismissed and superseded picker results cannot change current state',async()=>{
  const f=fixture();let resolve;const old=f.controller.pick(()=>new Promise(r=>resolve=r));
  f.controller.cancel();resolve('.75');assert.equal(await old,false);
  const next=f.controller.pick(()=>new Promise(r=>resolve=r));f.controller.update({...f.props,value:'.5'});
  resolve('.75');assert.equal(await next,false);assert.equal(f.commits,0);
});
test('newest picker wins even when older promise resolves later',async()=>{
  const f=fixture();let resolve;const old=f.controller.pick(()=>new Promise(r=>resolve=r));
  assert.equal(await f.controller.pick(async()=>'.5'),true);resolve('.75');
  assert.equal(await old,false);assert.equal(f.props.value,'.5');assert.equal(f.commits,1);
});
test('disabled and unknown values never dispatch; duplicate options are rejected',()=>{
  const f=fixture();f.controller.update({...f.props,disabled:true});assert.equal(f.controller.choose('.75'),false);
  f.controller.update({...f.props});assert.equal(f.controller.choose('invalid'),false);
  assert.throws(()=>f.controller.update({...f.props,options:[options[0],options[0]]}),/Duplicate/);
});
test('dispose is idempotent, unbinds and ignores an outstanding picker',async()=>{
  const f=fixture();f.controller.attach(f.view);let resolve;const p=f.controller.pick(()=>new Promise(r=>resolve=r));
  f.controller.dispose();f.controller.dispose();resolve('.75');assert.equal(await p,false);assert.equal(f.removed,1);assert.equal(f.commits,0);
});
