// One platform-independent sequence, consumed by the recording and real Web backends.
import {hyNode as n} from '../../dist/core/index.js';
import {HYPage} from '../../dist/portable/index.js';
export function exercise(renderer) {
  const batches=[],events=[];
  const proxy={capabilities:renderer.capabilities,mount:emit=>renderer.mount(emit),
    commit(revision,mutations){batches.push({revision,mutations});renderer.commit(revision,mutations);},
    focus:key=>renderer.focus(key),suspend:()=>renderer.suspend(),resume:()=>renderer.resume(),dispose:()=>renderer.dispose()};
  const page=new HYPage(proxy,{onEvent:event=>events.push(event)});
  const tree=(text='start',reverse=false)=>n('Column','fixture',{},{
    children:[n('PlatformView','preview',{slot:'preview',resourceId:'same-scene'}),
      n('Row','fields',{}, {children:(reverse?['b','a']:['a','b']).map(key=>n('Text',key,{text:key==='a'?text:'stable'}))})],
    slots:{footer:[n('Button','save',{text:'Save'})]}});
  page.mount(tree());page.render(tree());
  page.transaction(()=>{for(let i=0;i<100;i++)page.setProps('/fixture/fields/a','Text',{text:String(i)});});
  page.render(tree('99',true));
  page.suspend();page.render(tree('resumed',true));page.resume();
  return {page,batches,events};
}
