import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/test/browser/badge.html');await page.waitForFunction(()=>customElements.get('hy-badge'));await page.locator('#badge').evaluate(e=>{
  e.count=8;window.badgeRemovals=[];window.badgeClicks=0;e.addEventListener('badge-remove',event=>window.badgeRemovals.push({...event.detail,composed:event.composed,cancelable:event.cancelable}));e.addEventListener('click',()=>window.badgeClicks++);
});});
const badge=page=>page.locator('#badge');const marker=page=>badge(page).locator('[part="badge"]');
async function start(page){const box=await marker(page).boundingBox();const point={x:box.x+box.width/2,y:box.y+box.height/2};await page.mouse.move(point.x,point.y);await page.mouse.down();return point;}
async function drag(page,distance,release=true){const p=await start(page);await page.mouse.move(p.x+distance,p.y,{steps:3});if(release)await page.mouse.up();return p;}
async function enable(page){await badge(page).evaluate(e=>{e.dragRemovable=true;});}
async function holdRemoval(page){await page.evaluate(()=>window.addEventListener('pointerup',()=>{for(const animation of document.querySelector('[data-hy-badge-remove]')?.getAnimations({subtree:true})??[]){animation.pause();animation.currentTime=0;}},{once:true}));}
async function removeWithEffect(page){await enable(page);await drag(page,100,false);await holdRemoval(page);await page.mouse.up();return page.locator('[data-hy-badge-remove]');}

test('badge dismissal is opt-in and removal settings are bounded',async({page})=>{
  expect(await badge(page).evaluate(e=>[e.dragRemovable,e.removeDistance,e.removed])).toEqual([false,80,false]);await drag(page,100);await expect(marker(page)).toBeVisible();expect(await page.evaluate(()=>window.badgeRemovals)).toEqual([]);
  expect(await badge(page).evaluate(e=>{e.removeDistance=-1;const min=e.removeDistance;e.removeDistance=20000;const max=e.removeDistance;e.removeDistance=NaN;return[min,max,e.removeDistance];})).toEqual([1,10000,80]);
});

test('short drags and returning within the threshold restore the original marker',async({page})=>{
  await enable(page);const original=await marker(page).boundingBox();await drag(page,35);await expect(marker(page)).toBeVisible();expect(await badge(page).evaluate(e=>e.removed)).toBe(false);
  const p=await drag(page,110,false);await expect(page.locator('[data-hy-badge-drag]')).toBeVisible();await expect(marker(page)).toHaveCSS('opacity','0');await page.mouse.move(p.x+20,p.y);await page.mouse.up();
  await expect(page.locator('[data-hy-badge-drag]')).toHaveCount(0);const restored=await marker(page).boundingBox();expect(restored.x).toBeCloseTo(original.x,1);expect(await page.evaluate(()=>window.badgeRemovals)).toEqual([]);
  await expect(page.locator('[data-hy-badge-remove]')).toHaveCount(0);
});

test('release beyond the threshold dismisses only the marker once and can be restored',async({page})=>{
  await enable(page);await badge(page).evaluate(e=>{window.originalContent=e.firstElementChild;});await drag(page,100);await expect(marker(page)).toBeHidden();await expect(badge(page)).toHaveAttribute('removed');
  expect(await badge(page).evaluate(e=>[e.count,e.firstElementChild===window.originalContent])).toEqual([8,true]);await expect(badge(page).locator('.avatar')).toBeVisible();
  expect(await page.evaluate(()=>window.badgeRemovals.map(({count,dot,source,composed,cancelable})=>[count,dot,source,composed,cancelable]))).toEqual([[8,false,'pointer',true,true]]);
  expect(await page.evaluate(()=>window.badgeClicks)).toBe(0);await badge(page).evaluate(e=>{e.removed=false;});await expect(marker(page)).toBeVisible();
  await marker(page).click();expect(await badge(page).evaluate(e=>e.removed)).toBe(false);expect(await page.evaluate(()=>window.badgeClicks)).toBe(1);
});

test('removal can be vetoed and handlers do not remove newly updated data',async({page})=>{
  await enable(page);await badge(page).evaluate(e=>e.addEventListener('badge-remove',event=>event.preventDefault(),{once:true}));await drag(page,100);await expect(marker(page)).toBeVisible();await expect(badge(page)).not.toHaveAttribute('removed');
  await badge(page).evaluate(e=>e.addEventListener('badge-remove',()=>{e.count=15;},{once:true}));await drag(page,100);await expect(marker(page)).toHaveText('15');await expect(badge(page)).not.toHaveAttribute('removed');
  await expect(page.locator('[data-hy-badge-remove]')).toHaveCount(0);
});

test('Escape, changed settings and disconnection cancel without removing',async({page})=>{
  await enable(page);await drag(page,100,false);await page.keyboard.press('Escape');await page.mouse.up();await expect(marker(page)).toBeVisible();
  await drag(page,100,false);await badge(page).evaluate(e=>{e.dragRemovable=false;});await page.mouse.up();await expect(marker(page)).toBeVisible();
  await enable(page);await drag(page,100,false);await badge(page).evaluate(e=>{window.detachedBadge=e;e.remove();});await page.mouse.up();await expect(page.locator('[data-hy-badge-drag]')).toHaveCount(0);
  expect(await page.evaluate(()=>[window.detachedBadge.removed,window.detachedBadge.shadowRoot.querySelector('.badge').classList.contains('dragging')])).toEqual([false,false]);expect(await page.evaluate(()=>window.badgeRemovals)).toEqual([]);
});

test('dots can be dismissed, semantic status indicators remain unchanged',async({page})=>{
  await enable(page);await badge(page).evaluate(e=>{e.count=null;e.dot=true;});await drag(page,100);await expect(marker(page)).toBeHidden();
  await badge(page).evaluate(e=>{e.removed=false;e.status='success';e.text='Online';});await expect(badge(page).locator('[part=status]')).toBeVisible();await expect(marker(page)).toBeHidden();
  await expect(badge(page).locator('[part=status]')).not.toHaveAttribute('tabindex');
});

test('Delete provides keyboard dismissal and returns focus to slotted content',async({page})=>{
  await enable(page);await badge(page).evaluate(e=>{const button=document.createElement('button');button.id='notification';button.textContent='Notifications';e.replaceChildren(button);});
  await expect(marker(page)).toHaveAttribute('tabindex','0');await marker(page).focus();await marker(page).press('Delete');await expect(marker(page)).toBeHidden();await expect(page.locator('#notification')).toBeFocused();
  expect(await page.evaluate(()=>window.badgeRemovals.at(-1).source)).toBe('keyboard');await badge(page).evaluate(e=>{e.removed=false;e.addEventListener('badge-remove',event=>event.preventDefault(),{once:true});});
  await marker(page).focus();await marker(page).press('Backspace');await expect(marker(page)).toBeVisible();await expect(marker(page)).toBeFocused();
});

test('touch dismissal and cancellation use the same distance rule',async({page,browserName})=>{
  test.skip(browserName!=='chromium','CDP touch input is Chromium-specific');await enable(page);const cdp=await page.context().newCDPSession(page);const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:x==null?[]:[{x,y,id:1}]});
  let box=await marker(page).boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
  await touch('touchStart',x,y);await touch('touchMove',x+100,y);await touch('touchCancel');await expect(marker(page)).toBeVisible();await expect(page.locator('[data-hy-badge-drag]')).toHaveCount(0);
  await touch('touchStart',x,y);await touch('touchMove',x+100,y);await touch('touchEnd');await expect(marker(page)).toBeHidden();await cdp.detach();
});

test('badge gallery exposes threshold, removal and restoration on desktop and mobile',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.goto(`/examples/?badge-dismiss=${width}#badge`);const live=page.locator('#badge-live'),indicator=live.locator('[part=badge]');
    await live.scrollIntoViewIfNeeded();const initial=await indicator.boundingBox();await page.mouse.move(initial.x+initial.width/2,initial.y+initial.height/2);await page.mouse.down();await page.mouse.move(initial.x+initial.width/2-30,initial.y+initial.height/2-10);
    await expect(page.locator('[data-hy-badge-bridge]')).toBeVisible();await page.screenshot({path:`.artifacts/badge-liquid-gallery-${width}.png`});await page.keyboard.press('Escape');await page.mouse.up();
    await expect(page.locator('#badge-remove-distance')).toHaveAttribute('min','10');await page.locator('#badge-remove-distance').fill('10');await expect(live).toHaveJSProperty('removeDistance',10);await expect(page.locator('#badge-remove-event')).toContainText('10px');await live.scrollIntoViewIfNeeded();const box=await indicator.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-14,box.y+box.height/2+2);
    await holdRemoval(page);await page.mouse.up();await expect(indicator).toBeHidden();await expect(page.locator('[data-hy-badge-remove]')).toHaveCount(1);await expect(page.locator('#badge-remove-event')).toContainText('badge-remove');
    await page.locator('[data-hy-badge-remove]').evaluate(e=>{for(const animation of e.getAnimations({subtree:true}))animation.currentTime=180;});await page.screenshot({path:`.artifacts/badge-release-gallery-${width}.png`});
    await page.locator('#badge-restore').click();await expect(indicator).toBeVisible();await expect(live).toHaveJSProperty('count',8);await expect(page.locator('[data-hy-badge-remove]')).toHaveCount(0);
  }expect(errors).toEqual([]);
});

test('accepted removal fades the liquid snapshot at release and cleans up after finishing',async({page})=>{
  await enable(page);await badge(page).evaluate(e=>{e.color='#ff5d73';e.style.setProperty('--hy-badge-remove-duration','.52s');e.style.setProperty('--hy-badge-remove-easing','linear');});
  await drag(page,100,false);const before=await page.locator('[data-hy-badge-drag]').boundingBox();await holdRemoval(page);await page.mouse.up();
  const effect=page.locator('[data-hy-badge-remove]');await expect(effect).toBeVisible();await expect(marker(page)).toBeHidden();await expect(badge(page)).toHaveJSProperty('removed',true);await expect(effect).toHaveAttribute('inert');await expect(effect).toHaveAttribute('aria-hidden','true');
  const after=await effect.boundingBox();expect(after.x).toBeCloseTo(before.x,0);expect(after.y).toBeCloseTo(before.y,0);await expect(effect.locator('[data-hy-badge-particle]')).toHaveCount(0);await expect(effect.locator('[data-hy-badge-body]')).toHaveCount(1);
  await expect(effect.locator('[data-hy-badge-liquid]')).toHaveAttribute('fill','rgb(255, 93, 115)');await expect(effect).toHaveText('8');
  const timing=await effect.evaluate(e=>e.getAnimations({subtree:true}).map(animation=>animation.effect.getTiming()));expect(timing.every(value=>value.easing==='linear')).toBe(true);expect(Math.max(...timing.map(value=>value.duration+value.delay))).toBeCloseTo(520,3);
  await page.screenshot({path:'.artifacts/badge-liquid-start.png',clip:{x:60,y:45,width:280,height:150}});
  const partial=await effect.evaluate(e=>{for(const animation of e.getAnimations({subtree:true}))animation.currentTime=260;return {opacity:Number(getComputedStyle(e.firstElementChild).opacity),transform:getComputedStyle(e.firstElementChild).transform};});
  expect(partial.opacity).toBeCloseTo(.5,2);expect(partial.transform).not.toBe('none');
  await page.screenshot({path:'.artifacts/badge-liquid-mid.png',clip:{x:60,y:45,width:280,height:150}});
  await effect.evaluate(e=>{for(const animation of e.getAnimations({subtree:true}))animation.finish();});await expect(effect).toHaveCount(0);await expect(badge(page).locator('.avatar')).toBeVisible();expect(await page.evaluate(()=>window.badgeRemovals.length)).toBe(1);
});

test('restoring or updating badge data cancels release snapshots',async({page})=>{
  let effect=await removeWithEffect(page);await expect(effect).toHaveCount(1);await badge(page).evaluate(e=>{e.removed=false;});await expect(effect).toHaveCount(0);await expect(marker(page)).toBeVisible();
  effect=await removeWithEffect(page);await expect(effect).toHaveCount(1);await badge(page).evaluate(e=>{e.count=15;});await expect(effect).toHaveCount(0);await expect(marker(page)).toBeHidden();
  await badge(page).evaluate(e=>{e.removed=false;});await expect(marker(page)).toHaveText('15');await expect(marker(page)).toBeVisible();
});

test('reduced motion skips the release fade and cancels a running effect; disconnection releases animations',async({page})=>{
  let effect=await removeWithEffect(page);await expect(effect).toHaveCount(1);await page.emulateMedia({reducedMotion:'reduce'});await expect(effect).toHaveCount(0);
  await badge(page).evaluate(e=>{e.removed=false;});await drag(page,100);await expect(marker(page)).toBeHidden();await expect(effect).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'no-preference'});await badge(page).evaluate(e=>{e.removed=false;});effect=await removeWithEffect(page);await expect(effect).toHaveCount(1);
  expect(await badge(page).evaluate(e=>{const effect=document.querySelector('[data-hy-badge-remove]');const animations=effect.getAnimations({subtree:true});e.remove();return {connected:effect.isConnected,hasAnimations:animations.length>0,allCancelled:animations.every(animation=>animation.playState==='idle')};})).toEqual({connected:false,hasAnimations:true,allCancelled:true});await expect(effect).toHaveCount(0);
});

test('zero release duration removes immediately and dots retain their shape without text',async({page})=>{
  await badge(page).evaluate(e=>e.style.setProperty('--hy-badge-remove-duration','0ms'));let effect=await removeWithEffect(page);await expect(effect).toHaveCount(0);await expect(marker(page)).toBeHidden();
  await badge(page).evaluate(e=>{e.removed=false;e.count=null;e.dot=true;e.style.removeProperty('--hy-badge-remove-duration');});effect=await removeWithEffect(page);await expect(effect.locator('[data-hy-badge-body]')).toHaveCount(1);await expect(effect).toHaveText('');await expect(marker(page)).toBeHidden();
});
