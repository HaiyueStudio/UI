import {test,expect} from '@playwright/test';
import {RecordingRenderer} from '../portable/recording.mjs';
import {exercise} from './scenario.js';
test.beforeEach(async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.testErrors=errors;
  await page.goto('/examples/portable-ui/');await page.waitForFunction(()=>!!window.demo);
});
test.afterEach(async({page})=>expect(page.testErrors).toEqual([]));

test('the exact recording sequence reaches the real backend, with stable resource and bounded writes',async({page})=>{
  const recording=new RecordingRenderer(),expected=exercise(recording);
  const result=await page.evaluate(async()=>{
    demo.dispose();
    const {HYWebRenderer}=await import('/dist/adapters/web/index.js');
    const {exercise}=await import('/test/web-adapter/scenario.js');
    let mounts=0,disposals=0;
    const renderer=new HYWebRenderer(document.querySelector('#app'),{platformViews:{preview:()=>({
      mount(){mounts++;},update(){},layout(){},visible(){},focus(){},dispose(){disposals++;}})}});
    const run=exercise(renderer);
    const before=renderer.diagnostics;
    const observer=new MutationObserver(()=>{});
    observer.observe(document.querySelector('#app'),{subtree:true,attributes:true,childList:true,characterData:true});
    run.page.setProps('/fixture/fields/a','Text',{text:'resumed'});
    const equalWrites=observer.takeRecords().length;observer.disconnect();
    const text=document.querySelector('[data-hy-key="/fixture/fields/a"]').textContent;
    const order=[...document.querySelector('[data-hy-key="/fixture/fields"]').children].map(el=>el.dataset.hyKey);
    run.page.dispose();return {batches:run.batches,text,order,mounts,disposals,equalWrites,before,after:renderer.diagnostics};
  });
  expect(result.batches).toEqual(expected.batches);expected.page.dispose();
  expect(result).toMatchObject({mounts:1,disposals:1,text:'resumed',equalWrites:0,order:['/fixture/fields/b','/fixture/fields/a']});
  expect(result.before).toMatchObject({commits:4,created:6,updated:2,moved:1,activeResources:1});
  expect(result.after).toMatchObject({activeNodes:0,activeResources:0,activeListeners:0});
});

test('50 lifecycles release resources, window handlers, observers, animation requests and late events',async({page})=>{
  const result=await page.evaluate(async()=>{
    demo.dispose();
    const {HYWebRenderer}=await import('/dist/adapters/web/index.js');
    const {HYPage}=await import('/dist/portable/index.js');
    const {hyNode:n}=await import('/dist/core/index.js');
    let mounts=0,disposed=0,events=0,lateLayouts=0;const rafs=new Set(),observers=new Set(),renderers=[];
    const raf=window.requestAnimationFrame,caf=window.cancelAnimationFrame,RO=window.ResizeObserver;
    window.requestAnimationFrame=callback=>{const id=raf(time=>{rafs.delete(id);callback(time);});rafs.add(id);return id;};
    window.cancelAnimationFrame=id=>{rafs.delete(id);caf(id);};
    window.ResizeObserver=class extends RO {constructor(cb){super(cb);observers.add(this);}disconnect(){observers.delete(this);super.disconnect();}};
    try{
      for(let i=0;i<50;i++){
        let dead=false;const renderer=new HYWebRenderer(document.querySelector('#app'),{platformViews:{preview:()=>({
          mount(){mounts++;},update(){},layout(){if(dead)lateLayouts++;},visible(){},focus(){},dispose(){dead=true;disposed++;}})}});
        const page=new HYPage(renderer,{onEvent(){events++;}});
        page.mount(n('Column','cycle',{}, {children:[n('TextInput','input',{value:'初始'}),
          n('Select','select',{value:'a',options:[{value:'a',label:'A'},{value:'b',label:'B'}]}),
          n('Dialog','dialog',{open:false,title:'dialog'}),
          n('PlatformView','preview',{slot:'preview',resourceId:'scene'})]}));
        const stale=document.querySelector('[data-hy-key="/cycle/input"]').shadowRoot.querySelector('input');
        page.dispose();page.dispose();
        stale.value='late';stale.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true}));
        window.dispatchEvent(new Event('resize'));renderers.push(renderer.diagnostics);
      }
      await new Promise(resolve=>setTimeout(resolve,40));
      return {mounts,disposed,events,lateLayouts,rafs:rafs.size,observers:observers.size,renderers,roots:document.querySelectorAll('[data-hy-portable-root]').length};
    }finally{window.requestAnimationFrame=raf;window.cancelAnimationFrame=caf;window.ResizeObserver=RO;}
  });
  expect(result).toMatchObject({mounts:50,disposed:50,events:0,lateLayouts:0,rafs:0,observers:0,roots:0});
  for(const stats of result.renderers)expect(stats).toMatchObject({activeNodes:0,activeResources:0,activeListeners:0});
});

test('legacy defaults and event contracts remain independent of the portable opt-in modes',async({page})=>{
  const result=await page.evaluate(async()=>{
    demo.dispose();const root=document.querySelector('#app'),received=[];
    const select=document.createElement('hy-select'),tabs=document.createElement('hy-tabs'),range=document.createElement('hy-range'),input=document.createElement('hy-input'),dialog=document.createElement('hy-dialog'),toggle=document.createElement('hy-checkbox');
    root.append(select,tabs,range,input,dialog,toggle);
    const options=[{value:'a',label:'A'},{value:'b',label:'B'},{value:'locked',label:'Locked',disabled:true}];
    select.options=options;select.value='a';tabs.options=options;tabs.value='locked';
    range.min=0;range.max=1;range.step=.1;range.value=.25;
    input.type='color';input.value='#aabbcc';
    for(const [host,name] of [[select,'value-change'],[tabs,'tab-change'],[range,'value-change'],[input,'value-change'],[toggle,'checked-change'],[dialog,'dialog-close']]){
      host.addEventListener(name,e=>received.push({type:e.type,bubbles:e.bubbles,composed:e.composed,detail:e.detail}));
    }
    const fallback=tabs.value,rounded=range.value;
    const internal=select.shadowRoot.querySelector('select');internal.value='b';internal.dispatchEvent(new Event('change',{bubbles:true}));
    tabs.shadowRoot.querySelector('button[data-value=b]').click();
    range.shadowRoot.querySelector('button.upper').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    const text=input.shadowRoot.querySelector('input');text.value='#112233';text.dispatchEvent(new Event('change',{bubbles:true}));
    toggle.shadowRoot.querySelector('input').click();
    const closed=new Promise(resolve=>dialog.addEventListener('dialog-close',resolve,{once:true}));
    dialog.open=true;dialog.shadowRoot.querySelector('button').click();await closed;
    return {fallback,rounded,controlled:[tabs.controlled,range.controlled,dialog.controlled],inputType:text.type,dialogOpen:dialog.open,received};
  });
  expect(result).toMatchObject({fallback:'a',rounded:.3,controlled:[false,false,false],inputType:'color',dialogOpen:false});
  expect(result.received.map(e=>e.type)).toEqual(['value-change','tab-change','value-change','value-change','checked-change','dialog-close']);
  for(const e of result.received)expect(e).toMatchObject({bubbles:true,composed:true});
  expect(result.received[0].detail).toEqual({value:'b',option:{value:'b',label:'B'}});
  expect(result.received[1].detail).toEqual({value:'b',option:{value:'b',label:'B'}});
  expect(result.received[2].detail).toMatchObject({value:.4,handle:'single'});
  expect(result.received[3].detail).toEqual({value:'#112233',valueAsNumber:null,valid:true});
  expect(result.received[4].detail).toEqual({checked:true,value:'on'});
});

test('unsupported slot and resource failures include key/revision; explicit rebuild releases partial mounts',async({page})=>{
  const result=await page.evaluate(async()=>{
    demo.dispose();
    const {HYWebRenderer}=await import('/dist/adapters/web/index.js');
    const {HYPage}=await import('/dist/portable/index.js');
    const {hyNode:n}=await import('/dist/core/index.js');
    const renderer=new HYWebRenderer(document.querySelector('#app')),page=new HYPage(renderer);
    let failure;
    try{page.mount(n('Button','bad',{text:'bad'}, {slots:{unsupported:[n('Text','label',{text:'test'})]}}));}catch(e){failure={status:page.status,...e.context};}
    page.render(n('Text','good',{text:'Recovered'}));page.rebuild(new HYWebRenderer(document.querySelector('#app')));
    const text=document.querySelector('[data-hy-key="/good"]').textContent;
    page.dispose();return {failure,text,old:renderer.diagnostics};
  });
  expect(result.failure).toMatchObject({status:'faulted',key:'/bad',operation:'insert',revision:1});
  expect(result.text).toBe('Recovered');expect(result.old.activeNodes).toBe(0);expect(result.old.activeListeners).toBe(0);
});

test('controlled rejection preserves text draft/error, discrete controls restore and revised text wins after composition',async({page})=>{
  await page.evaluate(async()=>{
    demo.dispose();
    const {HYWebRenderer}=await import('/dist/adapters/web/index.js');
    const {HYPage}=await import('/dist/portable/index.js');
    const {hyNode:n}=await import('/dist/core/index.js');
    const events=[];const page=new HYPage(new HYWebRenderer(document.querySelector('#app')),{onEvent:e=>{
      events.push(e);if(e.type==='commit'&&e.key==='/form/input')page.setProps('/form','FormGroup',{label:'Name',error:'请保留草稿并修正'});
    }});
    page.mount(n('FormGroup','form',{label:'Name'}, {children:[n('TextInput','input',{value:'accepted'}),
      n('Select','select',{value:'a',a11y:{label:'Choice'},options:[{value:'a',label:'A'},{value:'b',label:'B'}]}),
      n('Slider','slider',{value:.25,min:0,max:1,step:.1,a11y:{label:'Amount'}})]}));
    window.fixture={page,events};
  });
  const input=page.getByRole('textbox',{name:'Name'});await input.fill('unaccepted');await input.press('Enter');
  await expect(input).toHaveValue('unaccepted');await expect(input).toBeFocused();await expect(input).toHaveAttribute('aria-invalid','true');
  await expect(input).toHaveAccessibleDescription('请保留草稿并修正');
  await page.getByRole('combobox',{name:'Choice'}).selectOption('b');await expect(page.getByRole('combobox',{name:'Choice'})).toHaveValue('a');
  const slider=page.getByRole('slider',{name:'Amount'});await expect(slider).toHaveAttribute('aria-valuenow','0.25');await slider.press('ArrowRight');await expect(slider).toHaveAttribute('aria-valuenow','0.25');
  await input.focus();await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,composed:true}));el.value='ni';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
    fixture.page.setProps('/form/input','TextInput',{value:'new-authoritative'});
    el.value='你';el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,composed:true,data:'你'}));});
  await expect(input).toHaveValue('new-authoritative');
  await page.evaluate(()=>fixture.page.setProps('/form/input','TextInput',{value:'new-authoritative',readOnly:true}));
  await expect(input).toHaveAttribute('readonly','');
  await page.evaluate(()=>fixture.page.dispose());
});

test('scroll survives placement; RTL tabs use visual direction and long content stays within the viewport',async({page})=>{
  await page.evaluate(()=>demo.renderer.setEnvironment({direction:'rtl',safeArea:[12,18,12,18]}));
  const tab=page.getByRole('tab',{name:'外观设置'});await tab.focus();await tab.press('ArrowLeft');
  await expect(page.getByRole('tab',{name:'创作笔记'})).toBeFocused();
  await page.evaluate(()=>{
    demo.page.setProps('/studio/tabs/notes/memo/input','TextArea',{value:'Long text '.repeat(250),layout:{height:600}});
  });
  const scroll=page.locator('[data-hy-key="/studio/tabs/notes"]');
  expect(await scroll.evaluate(el=>getComputedStyle(el).overflowY)).toBe('auto');
  expect(await scroll.evaluate(el=>{el.scrollTop=100;return el.scrollTop;})).toBe(100);
  await page.setViewportSize({width:420,height:760});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('slotted button content activates once; non-dismissible modal blocks Escape and restores focus on explicit close',async({page})=>{
  await page.evaluate(async()=>{
    demo.dispose();
    const {HYWebRenderer}=await import('/dist/adapters/web/index.js');
    const {HYPage}=await import('/dist/portable/index.js');
    const {hyNode:n}=await import('/dist/core/index.js');
    const events=[],p=new HYPage(new HYWebRenderer(document.querySelector('#app')),{onEvent:e=>events.push(e)});
    p.mount(n('Column','root',{}, {children:[n('Button','action',{text:'',a11y:{label:'Open'}},{children:[n('Text','label',{text:'Slotted action'})]}),
      n('Dialog','modal',{open:false,title:'Busy',dismissible:false},{children:[n('Button','done',{text:'Done'})]})]}));
    window.fixture={page:p,events};
  });
  await page.getByText('Slotted action',{exact:true}).click();
  expect(await page.evaluate(()=>fixture.events.filter(e=>e.type==='activate').length)).toBe(1);
  await page.evaluate(()=>{fixture.page.focus('/root/action');fixture.page.setProps('/root/modal','Dialog',{open:true,title:'Busy',dismissible:false});});
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button',{name:'Close',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>{const back=fixture.page.back();return{back,cancels:fixture.events.filter(e=>e.type==='cancel').length};})).toEqual({back:true,cancels:0});
  await page.evaluate(()=>fixture.page.setProps('/root/modal','Dialog',{open:false,title:'Busy',dismissible:false}));
  await expect(page.getByRole('button',{name:'Open',exact:true})).toBeFocused();
  await page.evaluate(()=>fixture.page.dispose());
});

test('PlatformView starts hidden in inactive slots and failure owns/reclaims the allocated resource',async({page})=>{
  const result=await page.evaluate(async()=>{
    demo.dispose();
    const {HYWebRenderer}=await import('/dist/adapters/web/index.js');
    const {HYPage}=await import('/dist/portable/index.js');
    const {hyNode:n}=await import('/dist/core/index.js');
    let disposeCount=0;const visibility=[];
    const options={platformViews:{preview:()=>({mount(){},update(){},layout(){},visible:v=>visibility.push(v),focus(){},dispose(){disposeCount++;}})}};
    const p=new HYPage(new HYWebRenderer(document.querySelector('#app'),options));
    p.mount(n('Tabs','tabs',{value:'a',options:[{value:'a',label:'A'},{value:'b',label:'B'}]},{slots:{b:[n('PlatformView','preview',{slot:'preview',resourceId:'scene'})]}}));
    const hidden=[...visibility];
    p.setProps('/tabs','Tabs',{value:'b',options:[{value:'a',label:'A'},{value:'b',label:'B'}]});p.dispose();
    const renderer=new HYWebRenderer(document.querySelector('#app'),{platformViews:{broken:()=>({
      mount(){throw new Error('allocation failed');},update(){},layout(){},visible(){},focus(){},dispose(){disposeCount++;}})}});
    const failing=new HYPage(renderer);let failure;
    try{failing.mount(n('PlatformView','broken',{slot:'broken',resourceId:'scene'},{source:{file:'fixture.ts',line:20}}));}catch(e){failure=e.context;}
    failing.dispose();
    const imagePage=new HYPage(new HYWebRenderer(document.querySelector('#app')));let imageFailure;
    try{imagePage.mount(n('Image','missing',{resource:{id:'missing',alt:'Missing'}}));}catch(e){imageFailure=e.context;}imagePage.dispose();
    return {hidden,visibility,disposeCount,failure,imageFailure,stats:renderer.diagnostics};
  });
  expect(result.hidden).toEqual([false]);expect(result.visibility).toEqual([false,true]);expect(result.disposeCount).toBe(2);
  expect(result.failure).toMatchObject({key:'/broken',revision:1,source:{file:'fixture.ts',line:20}});
  expect(result.imageFailure).toMatchObject({key:'/missing',operation:'create',revision:1});
  expect(result.stats).toMatchObject({activeNodes:0,activeListeners:0,activeResources:0});
});

test('typing, selection and browser undo survive an unrelated page update',async({page})=>{
  await page.evaluate(()=>{demo.state.title='before';demo.refresh();});
  const input=page.getByRole('textbox',{name:'作品名称'});await input.focus();
  await input.press('End');await input.pressSequentially(' after');
  await page.evaluate(()=>demo.page.setProps('/studio/actions/hint','Text',{text:'unrelated update'}));
  await input.press('ControlOrMeta+z');
  await expect(input).toHaveValue('before');
  await input.press('ControlOrMeta+Shift+z');await expect(input).toHaveValue('before after');
});

test('props-only updates keep focus and selection without a synchronous focus geometry read',async({page})=>{
  const input=page.getByRole('textbox',{name:'作品名称'});await input.focus();
  const result=await input.evaluate(el=>{
    el.setSelectionRange(1,3);const original=Element.prototype.getClientRects;let reads=0;
    Element.prototype.getClientRects=function(){reads++;return original.call(this);};
    try {
      demo.page.setProps('/studio/actions/hint','Text',{text:'updated hint'});
      let active=document.activeElement;while(active?.shadowRoot?.activeElement)active=active.shadowRoot.activeElement;
      return {reads,focused:active===el,selection:[el.selectionStart,el.selectionEnd]};
    }finally{Element.prototype.getClientRects=original;}
  });
  expect(result).toEqual({reads:0,focused:true,selection:[1,3]});
});

test('select value updates retain option nodes while labels and parent errors stay current',async({page})=>{
  const result=await page.evaluate(async()=>{
    demo.dispose();
    const {HYWebRenderer}=await import('/dist/adapters/web/index.js');
    const {HYPage}=await import('/dist/portable/index.js');
    const {hyNode:n}=await import('/dist/core/index.js');
    const p=new HYPage(new HYWebRenderer(document.querySelector('#app')));
    const props={value:'a',options:[{value:'a',label:'A'},{value:'b',label:'B'}],a11y:{label:'Choice'}};
    p.mount(n('FormGroup','form',{label:'Form'},{children:[n('Select','choice',props)]}));
    const select=document.querySelector('[data-hy-key="/form/choice"]').shadowRoot.querySelector('select');
    const options=[...select.options];
    p.setProps('/form/choice','Select',{...props,value:'b'});
    const retained=options.every((el,i)=>el===select.options[i]);
    p.setProps('/form/choice','Select',{...props,value:'b',a11y:{label:'New choice'}});
    p.setProps('/form','FormGroup',{label:'Form',error:'Choose carefully'});
    const state={retained,value:select.value,label:select.getAttribute('aria-label'),error:select.getAttribute('aria-description')};
    p.setProps('/form/choice','Select',{...props,disabled:true});
    state.disabled=select.disabled&&[...select.options].every(option=>option.disabled);
    p.dispose();return state;
  });
  expect(result).toEqual({retained:true,value:'b',label:'New choice',error:'Choose carefully',disabled:true});
});

test('44px semantic controls paint the complete touch target',async({page})=>{
  const result=await page.evaluate(async()=>{
    demo.dispose();
    const {HYWebRenderer}=await import('/dist/adapters/web/index.js');
    const {HYPage}=await import('/dist/portable/index.js');
    const {hyNode:n}=await import('/dist/core/index.js');
    const renderer=new HYWebRenderer(document.querySelector('#app')),view=new HYPage(renderer);
    view.mount(n('Row','row',{layout:{gap:8}}, {children:[
      n('Button','button',{text:'Run',layout:{minHeight:44,width:96}}),
      n('Select','select',{value:'1',options:[{value:'1',label:'100%'}],layout:{minHeight:44,width:96}}),
      n('TextInput','input',{value:'Name',layout:{minHeight:44,width:120}}),
    ]}));
    await new Promise(requestAnimationFrame);
    const result=[...document.querySelectorAll('[data-hy-key]')].filter(el=>el.shadowRoot).map(el=>{
      // HYInput paints its border/background on .control (input is inset by that border).
      const control=el.shadowRoot.querySelector('.control,select')??el.shadowRoot.querySelector('button,input'),a=el.getBoundingClientRect(),b=control.getBoundingClientRect();return {host:a.height,control:b.height,width:a.width,paint:b.width};
    });view.dispose();return result;
  });
  expect(result).toHaveLength(3);
  for(const item of result){expect(item.host).toBeGreaterThanOrEqual(44);expect(item.control).toBe(item.host);expect(item.paint).toBe(item.width);}
});
