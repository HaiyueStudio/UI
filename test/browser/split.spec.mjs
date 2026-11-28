import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/split.html'); await page.waitForFunction(() => window.splitReady);
});
const bar = page => page.locator('#split [part~="bar"]');
const ratio = page => page.locator('#split').evaluate(element => element.ratio);
async function start(page) {
  const box = await bar(page).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); return box;
}
async function drag(page, distance = 60) {
  const box = await start(page); await page.mouse.move(box.x + box.width / 2 + distance, box.y + box.height / 2); await page.mouse.up();
}

test('focused registration keeps clean constructors and exposes divider, handle and pane parts', async ({ page }) => {
  expect(await page.evaluate(() => [window.explicitSplit, window.cleanSplitConstructor])).toEqual([true,true]);
  await expect(page.locator('#split')).toHaveJSProperty('disabled',false);
  await expect(bar(page)).toHaveAttribute('role','separator'); await expect(bar(page)).toHaveAttribute('aria-disabled','false');
  await expect(bar(page)).toHaveAttribute('tabindex','0'); await expect(bar(page)).toHaveAttribute('aria-orientation','vertical');
  await expect(page.locator('#split [part~="first"]')).toHaveAttribute('part','pane first');
  await expect(page.locator('#split [part~="second"]')).toHaveAttribute('part','pane second');
  await expect(page.locator('#split [part="handle"]')).toHaveAttribute('inert');
  await expect(page.locator('#split [part="handle"]')).toHaveAttribute('aria-hidden','true');
});

test('disabled blocks pointer and keyboard resizing while panes retain editing and button behavior', async ({ page }) => {
  await page.locator('#split').evaluate(element => { element.disabled = true; });
  await expect(bar(page)).toHaveAttribute('aria-disabled','true'); await expect(bar(page)).toHaveAttribute('tabindex','-1');
  await expect(bar(page)).toHaveCSS('cursor','default'); await drag(page);
  await bar(page).focus();
  for (const key of ['ArrowLeft','ArrowRight','Home','End','Shift+ArrowRight']) await bar(page).press(key);
  expect(await ratio(page)).toBe(.5); expect(await page.evaluate(() => window.splitChanges)).toEqual([]);
  await page.locator('#field').fill('Still editable'); await page.locator('#pane-button').click();
  await expect(page.locator('#field')).toHaveValue('Still editable'); expect(await page.evaluate(() => window.paneClicks)).toBe(1);
  await page.locator('#before').focus(); await page.keyboard.press('Tab'); await expect(page.locator('#field')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('#pane-button')).toBeFocused();
  await page.locator('#split').evaluate(element => { element.disabled = false; }); await expect(bar(page)).toHaveAttribute('tabindex','0');
  await drag(page); expect(await ratio(page)).toBeGreaterThan(.5);
});

test('declarative disabled keeps programmatic ratios and responsive layout working in both directions', async ({ page }) => {
  const result = await page.locator('#split').evaluate(async element => {
    element.setAttribute('disabled',''); element.ratio=.3; element.style.width='500px';
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const first=element.shadowRoot.querySelector('.first'); const second=element.shadowRoot.querySelector('.second'); const bar=element.shadowRoot.querySelector('.bar');
    const horizontal=[first.clientWidth+second.clientWidth+bar.offsetWidth,element.clientWidth,first.clientWidth];
    element.direction='vertical'; element.style.height='400px';
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return { horizontal,vertical:[first.clientHeight+second.clientHeight+bar.offsetHeight,element.clientHeight],value:bar.getAttribute('aria-valuenow'),orientation:bar.getAttribute('aria-orientation'),disabled:element.disabled };
  });
  expect(result.horizontal[0]).toBe(result.horizontal[1]); expect(result.horizontal[2]).toBe(Math.round((result.horizontal[1]-10)*.3));
  expect(result.vertical[0]).toBe(result.vertical[1]); expect(result.value).toBe('30'); expect(result.orientation).toBe('horizontal'); expect(result.disabled).toBe(true);
  expect(await page.evaluate(()=>window.splitChanges)).toEqual([]);
});

test('disabling during a drag releases capture and stops subsequent moves and events', async ({ page }) => {
  const box=await start(page); await page.mouse.move(box.x+70,box.y+100);
  await expect(bar(page)).toHaveAttribute('part',/bar-active/u);
  await page.locator('#split').evaluate(element=>{element.disabled=true;});
  const frozen=await ratio(page); const count=await page.evaluate(()=>window.splitChanges.length);
  await expect(bar(page)).not.toHaveClass(/dragging/u); await expect(bar(page)).not.toHaveAttribute('part',/bar-active/u);
  expect(await bar(page).evaluate(element=>element.hasPointerCapture(window.splitPointerId))).toBe(false);
  await page.mouse.move(box.x+160,box.y+100); await page.mouse.up(); expect(await ratio(page)).toBe(frozen); expect(await page.evaluate(()=>window.splitChanges.length)).toBe(count);
  await page.locator('#split').evaluate(element=>{element.disabled=false;}); await drag(page,-45); expect(await ratio(page)).toBeLessThan(frozen);
});

test('keyboard sizing preserves direction, step sizes and composed events when enabled', async ({ page }) => {
  await bar(page).focus(); await bar(page).press('ArrowRight'); expect(await ratio(page)).toBeCloseTo(.52);
  await bar(page).press('Shift+ArrowLeft'); expect(await ratio(page)).toBeCloseTo(.42);
  await bar(page).press('Home'); expect(await ratio(page)).toBe(0); await bar(page).press('End'); expect(await ratio(page)).toBe(1);
  await page.locator('#split').evaluate(element=>{element.direction='vertical';element.ratio=.5;});
  await bar(page).press('ArrowDown'); expect(await ratio(page)).toBeCloseTo(.52); await bar(page).press('ArrowUp'); expect(await ratio(page)).toBeCloseTo(.5);
  expect(await page.evaluate(()=>window.splitChanges.every(event=>event.composed))).toBe(true);
  expect(await page.evaluate(()=>window.splitChanges.at(-1).direction)).toBe('vertical');
});

test('fractional sizes and transformed pointer coordinates still snap to complete pane tracks', async ({ page }) => {
  await page.locator('#split').evaluate(element=>{element.style.width='503.5px';element.style.height='287.5px';element.style.transform='scale(.8)';element.style.transformOrigin='top left';element.barSize=7.3;});
  for(const direction of ['horizontal','vertical']){
    await page.locator('#split').evaluate((element,value)=>{element.direction=value;element.ratio=.5;},direction);
    await expect(bar(page)).toHaveAttribute('aria-orientation',direction==='vertical'?'horizontal':'vertical');
    const bounds=await page.locator('#split').boundingBox(); await start(page);
    await page.mouse.move(bounds.x+bounds.width*(direction==='horizontal'?.7:.5),bounds.y+bounds.height*(direction==='vertical'?.7:.5)); await page.mouse.up();
    const sizes=await page.locator('#split').evaluate(element=>{
      const vertical=element.direction==='vertical';const first=element.shadowRoot.querySelector('.first');const second=element.shadowRoot.querySelector('.second');const bar=element.shadowRoot.querySelector('.bar');
      const rect=element.getBoundingClientRect();
      return {size:vertical?element.clientHeight:element.clientWidth,first:vertical?first.clientHeight:first.clientWidth,second:vertical?second.clientHeight:second.clientWidth,bar:vertical?bar.offsetHeight:bar.offsetWidth,offset:vertical?window.lastSplitPoint.y-rect.top:window.lastSplitPoint.x-rect.left,visualSize:vertical?rect.height:rect.width};
    });
    // WebKit may round native pointer coordinates; validate the point actually delivered to the widget.
    const expected=Math.max(80,Math.min(sizes.size-7-80,Math.round(sizes.offset*sizes.size/sizes.visualSize-3.5)));
    expect(sizes.first).toBe(expected); expect(sizes.first+sizes.second+sizes.bar).toBe(sizes.size); expect(sizes.bar).toBe(7);
  }
});

test('Escape, lost capture, blur and disconnection clean active styling and window listeners', async ({ page }) => {
  for(const reason of ['Escape','capture','blur']){
    const box=await start(page); await page.mouse.move(box.x+30,box.y+60);
    if(reason==='Escape')await page.keyboard.press('Escape');
    else if(reason==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    else { await bar(page).evaluate(element=>element.releasePointerCapture(window.splitPointerId)); await page.mouse.move(box.x+31,box.y+60); }
    await expect(bar(page)).not.toHaveClass(/dragging/u);const frozen=await ratio(page);
    await page.mouse.move(box.x+100,box.y+60);await page.mouse.up();expect(await ratio(page)).toBe(frozen);
  }
  await start(page);await page.locator('#split').evaluate(element=>{window.detachedSplit=element;element.remove();});await page.mouse.up();
  expect(await page.evaluate(()=>window.detachedSplit.shadowRoot.querySelector('.bar').classList.contains('dragging'))).toBe(false);
  await page.evaluate(()=>document.querySelector('#after').before(window.detachedSplit)); await drag(page,-35);
  expect(await page.evaluate(()=>window.splitChanges.length)).toBeGreaterThan(0);
});

test('CSS parts style the bar and custom handle with a separate active part', async ({ page }) => {
  await page.addStyleTag({content:'#split::part(bar){background:rgb(20,70,120);border:1px solid rgb(80,90,100);border-radius:6px;transition:none} #split::part(handle){color:rgb(190,120,30)} #split::part(bar-active){background:rgb(100,120,20)} #split[disabled]::part(bar){opacity:.25}'});
  await expect(bar(page)).toHaveCSS('background-color','rgb(20, 70, 120)');await expect(bar(page)).toHaveCSS('border-top-left-radius','6px');await expect(bar(page)).toHaveCSS('border-left-width','1px');
  await expect(page.locator('#split [part="handle"]')).toHaveCSS('color','rgb(190, 120, 30)'); await start(page);
  await expect(page.locator('#split [part~="bar-active"]')).toHaveCSS('background-color','rgb(100, 120, 20)');await page.mouse.up();
  await page.locator('#split').evaluate(element=>{element.disabled=true;});await expect(bar(page)).toHaveCSS('opacity','0.25');
});

test('theme tokens independently control normal, hover, dragging and disabled appearances', async ({ page }) => {
  await page.locator('#split').evaluate(element=>{
    for(const [name,value] of Object.entries({'bar-color':'rgb(10,20,30)','bar-hover-color':'rgb(40,50,60)','bar-drag-color':'rgb(70,80,90)','bar-disabled-color':'rgb(100,110,120)','bar-disabled-opacity':'.4','bar-radius':'5px','bar-transition-duration':'0s'}))element.style.setProperty('--hy-split-'+name,value);
  });
  await expect(bar(page)).toHaveCSS('background-color','rgb(10, 20, 30)');await bar(page).hover();await expect(bar(page)).toHaveCSS('background-color','rgb(40, 50, 60)');
  await page.mouse.down();await expect(bar(page)).toHaveCSS('background-color','rgb(70, 80, 90)');
  await page.locator('#split').evaluate(element=>{element.disabled=true;});await expect(bar(page)).toHaveCSS('background-color','rgb(100, 110, 120)');await expect(bar(page)).toHaveCSS('opacity','0.4');await page.mouse.up();
});

test('slotted components remain connected, decorative and outside keyboard navigation', async ({ page,browserName }) => {
  await page.evaluate(()=>{
    window.gripConnections=0;window.gripDisconnections=0;window.gripClicks=0;
    customElements.define('split-test-grip',class extends HTMLElement{
      constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<button id="grip-button">Grip action</button>';this.shadowRoot.querySelector('button').addEventListener('click',()=>window.gripClicks++);}
      connectedCallback(){window.gripConnections++;}disconnectedCallback(){window.gripDisconnections++;}
    });
    const grip=document.createElement('split-test-grip');grip.slot='handle';document.querySelector('#custom-handle').replaceWith(grip);window.originalGrip=grip;
  });
  await page.locator('#field').focus();await page.keyboard.press('Tab');await expect(bar(page)).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('#pane-button')).toBeFocused();
  await page.locator('split-test-grip button').evaluate(element=>element.focus());await expect(page.locator('#pane-button')).toBeFocused();
  if(browserName==='chromium'){
    const cdp=await page.context().newCDPSession(page);const {nodes}=await cdp.send('Accessibility.getFullAXTree');
    expect(nodes.filter(node=>!node.ignored&&node.name?.value==='Grip action')).toHaveLength(0);await cdp.detach();
  }
  const box=await page.locator('split-test-grip').boundingBox();const divider=await bar(page).boundingBox();
  expect(Math.abs(box.x+box.width/2-divider.x-divider.width/2)).toBeLessThan(1);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await expect(bar(page)).toHaveClass(/dragging/u);await page.mouse.up();
  await page.locator('#split').evaluate(element=>{element.disabled=true;element.direction='vertical';element.ratio=.6;element.disabled=false;});
  expect(await page.evaluate(()=>[window.gripConnections,window.gripDisconnections,window.gripClicks,window.originalGrip===document.querySelector('split-test-grip')])).toEqual([1,0,0,true]);
});

test('touch dragging respects disabled state and cancellation', async ({ page,browserName }) => {
  test.skip(browserName!=='chromium','CDP touch input is Chromium-specific');
  const cdp=await page.context().newCDPSession(page);const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:x==null?[]:[{x,y,id:1}]});
  let box=await bar(page).boundingBox();let x=box.x+box.width/2;const y=box.y+40;
  await touch('touchStart',x,y);await touch('touchMove',x+60,y);await touch('touchEnd');expect(await ratio(page)).toBeGreaterThan(.5);
  await page.locator('#split').evaluate(element=>{element.disabled=true;});const frozen=await ratio(page);box=await bar(page).boundingBox();x=box.x+box.width/2;
  await touch('touchStart',x,y);await touch('touchMove',x-60,y);await touch('touchEnd');expect(await ratio(page)).toBe(frozen);
  await page.locator('#split').evaluate(element=>{element.disabled=false;});await touch('touchStart',x,y);await touch('touchMove',x-30,y);await touch('touchCancel');await expect(bar(page)).not.toHaveClass(/dragging/u);await cdp.detach();
});

test('gallery demonstrates disabled state, bar presets and custom handles on desktop and mobile', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.goto(`/examples/?split-width=${width}#split`);
    const split=page.locator('#split-live');const divider=split.locator('[part~="bar"]');
    await page.locator('#split-bar-style').selectOption('rounded');await expect(divider).toHaveCSS('border-top-left-radius','999px');
    await page.locator('#split-bar-style').selectOption('grip');await page.locator('#split-bar').fill('12');await expect(split.locator('[slot="handle"]')).toBeVisible();
    await expect(divider).toHaveCSS('border-left-width','1px');await page.locator('#split-direction').selectOption('vertical');await expect(split.locator('[slot="handle"]')).toHaveText('⋯');
    await page.locator('label:has(#split-disabled)').click();await expect(divider).toHaveAttribute('aria-disabled','true');
    await page.locator('#split-ratio').fill('0.45');await expect(split).toHaveJSProperty('ratio',.45);
    await page.locator('#split .split-controls').evaluate(element=>{element.scrollTop=0;if(element.assignedSlot?.parentElement)element.assignedSlot.parentElement.scrollTop=0;});
    await page.locator('#split').scrollIntoViewIfNeeded();await page.screenshot({path:`.artifacts/split-custom-${width}.png`});
    await page.locator('label:has(#split-disabled)').click();await divider.focus();await divider.press('ArrowDown');expect(await split.evaluate(element=>element.ratio)).toBeCloseTo(.47);
    expect(await page.locator('#content').evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  }
  expect(errors).toEqual([]);
});
