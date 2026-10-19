import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/examples/portable-ui/');await page.waitForFunction(()=>!!window.demo);await page.evaluate(()=>{window.startErrors=[];window.addEventListener('error',e=>window.startErrors.push(e.message));});expect(errors).toEqual([]);});
test.afterEach(async({page})=>{expect(await page.evaluate(()=>window.startErrors)).toEqual([]);});
test('all 18 semantic kinds render; registration stays focused; resource mounts once',async({page})=>{
  const result=await page.evaluate(()=>({kinds:[...new Set([...document.querySelectorAll('[data-hy-kind]')].map(e=>e.dataset.hyKind))],preview:demo.preview,unrelated:!!customElements.get('hy-tree')}));
  expect(result.kinds).toHaveLength(18);expect(result.preview.mounted).toBe(1);expect(result.unrelated).toBe(false);
  await expect(page.getByRole('textbox',{name:'作品名称'})).toHaveValue('星海漫游');
  await expect(page.getByRole('combobox',{name:'预览清晰度'})).toHaveValue('1');
  await expect(page.getByRole('tab',{name:'外观设置'})).toHaveAttribute('aria-selected','true');
});
test('selector and button keyboard input each produce one transaction; programmatic updates are silent',async({page})=>{
  await page.getByRole('combobox',{name:'预览清晰度'}).selectOption('.75');
  let events=await page.evaluate(()=>demo.events.filter(e=>e.key===demo.key('summary','scale','input')&&['valueChange','commit'].includes(e.type)));
  expect(events.map(e=>e.type)).toEqual(['valueChange','commit']);expect(events[0].transaction).toBe(events[1].transaction);
  await page.evaluate(()=>{demo.events.length=0;demo.state.scale='.5';demo.refresh();});
  expect(await page.evaluate(()=>demo.events.filter(e=>e.type==='commit'||e.type==='valueChange'))).toEqual([]);
  await page.getByRole('button',{name:'保存作品'}).focus();await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>demo.events.filter(e=>e.type==='activate').length)).toBe(1);
});
test('updating parents and reordering preserves input identity, focus, draft and selection',async({page})=>{
  const input=page.getByRole('textbox',{name:'作品名称'});await input.focus();
  await page.evaluate(()=>{const host=document.querySelector('[data-hy-key="/studio/summary/name/input"]');window.originalInput=host.shadowRoot.querySelector('input');originalInput.setSelectionRange(1,3);
    demo.page.setProps('/studio/summary','Grid',{layout:{columns:[{grow:1},{grow:1}],gap:24}});});
  expect(await page.evaluate(()=>({same:originalInput===document.querySelector('[data-hy-key="/studio/summary/name/input"]').shadowRoot.querySelector('input'),selection:[originalInput.selectionStart,originalInput.selectionEnd]}))).toEqual({same:true,selection:[1,3]});
  await expect(input).toBeFocused();
  await page.evaluate(()=>{const tree=demo.tree();const children=[...tree.children];[children[0],children[1]]=[children[1],children[0]];demo.page.render({...tree,children});});
  await expect(input).toBeFocused();expect(await page.evaluate(()=>[originalInput.selectionStart,originalInput.selectionEnd])).toEqual([1,3]);
  expect(await page.evaluate(()=>demo.preview.mounted)).toBe(1);
});
test('Chinese composition sequences never commit on confirmation Enter; later blur commits once',async({page})=>{
  const input=page.getByRole('textbox',{name:'作品名称'});await input.focus();
  await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,composed:true,data:''}));el.value='ni';el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,isComposing:true,data:'ni'}));
    el.value='你好 👩🏽‍💻';el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,composed:true,data:el.value}));el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,data:el.value}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true,isComposing:true}));});
  expect(await page.evaluate(()=>demo.events.filter(e=>e.type==='commit').length)).toBe(0);
  await page.getByRole('button',{name:'保存作品'}).focus();
  const events=await page.evaluate(()=>demo.events.filter(e=>e.key==='/studio/summary/name/input'&&['compositionStart','compositionUpdate','compositionEnd','valueChange','commit'].includes(e.type)));
  expect(events.map(e=>e.type)).toEqual(['compositionStart','compositionUpdate','compositionEnd','valueChange','commit']);
  expect(await page.evaluate(()=>demo.state.title)).toBe('你好 👩🏽‍💻');
});
test('textarea preserves newline and only commits on blur',async({page})=>{
  await page.getByRole('tab',{name:'创作笔记'}).click();const input=page.getByRole('textbox',{name:'创作笔记'});
  await input.fill('第一行');await input.press('Enter');await page.keyboard.insertText('你');
  expect(await page.evaluate(()=>demo.events.filter(e=>e.key.includes('/memo/')&&e.type==='commit').length)).toBe(0);
  await page.getByRole('button',{name:'保存作品'}).focus();await expect(input).toHaveValue('第一行\n你');
  expect(await page.evaluate(()=>demo.events.filter(e=>e.key.includes('/memo/')&&e.type==='commit').length)).toBe(1);
});
test('modal keyboard trap, Escape, opener restoration and immediate reopen',async({page})=>{
  const opener=page.getByRole('button',{name:'预览设置',exact:true});await opener.click();
  const password=page.locator('input[type=password]');await expect(password).toHaveAttribute('aria-label','访问口令（可选）');await expect(password).toBeFocused();
  await page.getByRole('button',{name:'完成',exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Close',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(opener).toBeFocused();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(()=>{demo.state.dialog=true;demo.refresh();demo.state.dialog=false;demo.refresh();demo.state.dialog=true;demo.refresh();});
  await page.waitForTimeout(80);await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(()=>demo.events.filter(e=>e.type==='cancel').length)).toBe(1);
});
test('theme, RTL, scaling and safe area update without replacing controls',async({page})=>{
  const before=await page.evaluate(()=>demo.renderer.diagnostics.created);
  await page.locator('#theme').click();await page.locator('#font').click();await page.locator('#direction').click();
  const values=await page.evaluate(()=>{const root=document.querySelector('[data-hy-portable-root]'),input=document.querySelector('hy-input').shadowRoot.querySelector('input');return{direction:getComputedStyle(root).direction,padding:getComputedStyle(root).paddingTop,color:getComputedStyle(input).color,font:parseFloat(getComputedStyle(input).fontSize),created:demo.renderer.diagnostics.created};});
  expect(values).toEqual({direction:'rtl',padding:'20px',color:'rgb(29, 48, 74)',font:21,created:before});
  await expect(page.getByRole('tab',{name:'外观设置'})).toHaveCSS('color','rgb(29, 48, 74)');
  await page.setViewportSize({width:420,height:760});await expect(page.getByRole('button',{name:'保存作品'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('slider keyboard and toggle pointer changes emit one commit and retain controlled state',async({page})=>{
  const slider=page.getByRole('slider',{name:'光照强度'});await slider.focus();await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow','0.6');
  await page.locator('hy-checkbox label').click();
  await expect(page.getByRole('checkbox',{name:'启用柔和光晕'})).not.toBeChecked();
  expect(await page.evaluate(()=>({exposure:demo.state.exposure,enabled:demo.state.enabled,commits:demo.events.filter(e=>e.type==='commit').length}))).toEqual({exposure:.6,enabled:false,commits:2});
});
test('suspension and cleanup release nodes, listeners and platform resources',async({page})=>{
  await page.evaluate(()=>{demo.page.suspend();demo.state.title='后台更新';demo.refresh();});
  await page.evaluate(()=>demo.page.resume());await expect(page.getByRole('textbox',{name:'作品名称'})).toHaveValue('后台更新');
  const result=await page.evaluate(()=>{demo.dispose();demo.dispose();return{stats:demo.renderer.diagnostics,preview:demo.preview};});
  expect(result.stats.activeNodes).toBe(0);expect(result.stats.activeResources).toBe(0);expect(result.stats.activeListeners).toBe(0);expect(result.preview.disposed).toBe(1);
});
test('slider pointer cancellation restores the accepted value without commit',async({page})=>{
  const slider=page.getByRole('slider',{name:'光照强度'});
  const box=await slider.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await page.evaluate(()=>document.addEventListener('pointerdown',e=>window.dragPointer=e.pointerId,{once:true}));
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+50,y);
  await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:dragPointer,bubbles:true})));
  await page.mouse.up();
  expect(await page.evaluate(()=>({commits:demo.events.filter(e=>e.type==='commit').length,cancels:demo.events.filter(e=>e.type==='cancel').length,exposure:demo.state.exposure}))).toEqual({commits:0,cancels:1,exposure:.5});
  await expect(slider).toHaveAttribute('aria-valuenow','0.5');
});
