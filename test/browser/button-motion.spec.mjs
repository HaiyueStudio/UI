import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/test/browser/button-motion.html');await page.waitForFunction(()=>window.buttonMotionReady);});
const native=(page,id='animated')=>page.locator('#'+id).getByRole('button');
async function finish(locator){await locator.evaluate(async element=>{const animations=element.getAnimations();for(const animation of animations)animation.finish();await Promise.allSettled(animations.map(animation=>animation.finished));});}
async function durations(locator){return locator.evaluate(element=>element.getAnimations().filter(animation=>'transitionProperty'in animation).map(animation=>animation.effect.getTiming().duration));}
// Pause on the browser's transition event so short durations remain inspectable across slow driver calls.
async function holdMotion(locator,trigger){await locator.evaluate(element=>element.addEventListener('transitionrun',()=>{for(const animation of element.getAnimations())animation.pause();},{once:true}));await trigger();}
async function hoverMotion(locator){await holdMotion(locator,()=>locator.hover());}

test('button motion is opt-in and focused registration remains isolated',async({page})=>{
  expect(await page.evaluate(()=>[window.explicitButtons,window.groupDoesNotRegisterButton,window.cleanButtons])).toEqual([true,true,true]);
  expect(await page.locator('#plain').evaluate(e=>[e.variant,e.animated,e.animationDuration])).toEqual(['outlined',false,160]);
  await native(page,'plain').hover();expect(await durations(native(page,'plain'))).toEqual([]);
  expect(await page.locator('#plain').evaluate(e=>{e.variant='unknown';e.animationDuration=20000;const max=e.animationDuration;e.animationDuration=-1;const min=e.animationDuration;e.animationDuration=NaN;return[e.variant,max,min,e.animationDuration];})).toEqual(['outlined',10000,0,160]);
});

test('solid and outlined variants change appearance without moving content or border geometry',async({page})=>{
  const result=await page.locator('#plain').evaluate(e=>{
    const button=e.shadowRoot.querySelector('button');const before=button.getBoundingClientRect();const outlined=getComputedStyle(button).borderTopColor;
    e.variant='solid';const solid={background:getComputedStyle(button).backgroundColor,border:getComputedStyle(button).borderTopColor,color:getComputedStyle(button).color};const after=button.getBoundingClientRect();
    e.variant='outlined';return {outlined,solid,widths:[before.width,after.width],heights:[before.height,after.height],restored:getComputedStyle(button).borderTopColor};
  });expect(result.solid.border).toBe('rgba(0, 0, 0, 0)');expect(result.solid.color).toBe('rgb(255, 255, 255)');expect(result.solid.background).toBe('rgb(44, 136, 176)');expect(result.widths[0]).toBe(result.widths[1]);expect(result.heights[0]).toBe(result.heights[1]);expect(result.restored).toBe(result.outlined);
});

test('hover and pointer press animate background, border and text colors and emit one native click',async({page})=>{
  const button=native(page);await button.hover();
  const transitions=await button.evaluate(element=>{
    const animations=element.getAnimations();for(const animation of animations){animation.pause();animation.currentTime=500;}
    return {properties:animations.map(animation=>animation.transitionProperty),durations:animations.map(animation=>animation.effect.getTiming().duration),background:getComputedStyle(element).backgroundColor};
  });expect(transitions.properties).toContain('background-color');expect(transitions.properties).toContain('color');expect(transitions.properties.some(value=>value.startsWith('border-'))).toBe(true);expect(transitions.durations.every(value=>value===1000)).toBe(true);expect(transitions.background).toBe('rgb(50, 70, 90)');await finish(button);
  await page.mouse.down();expect((await durations(button)).length).toBeGreaterThan(0);await finish(button);await expect(button).toHaveCSS('background-color','rgb(10, 20, 30)');
  await page.mouse.up();await finish(button);await expect(button).toHaveCSS('background-color','rgb(80, 100, 120)');
  await page.mouse.move(0,0);await finish(button);await expect(button).toHaveCSS('background-color','rgb(20, 40, 60)');expect(await page.evaluate(()=>window.buttonActivations)).toEqual(['animated']);
});

test('solid hover and pressed colors use separate skin tokens',async({page})=>{
  const button=native(page,'solid');await button.hover();await finish(button);await expect(button).toHaveCSS('background-color','rgb(45, 90, 145)');
  await page.mouse.down();await finish(button);await expect(button).toHaveCSS('background-color','rgb(10, 40, 80)');await expect(button).toHaveCSS('border-top-color','rgba(0, 0, 0, 0)');await page.mouse.up();
});

test('keyboard press and release preserve native activation and focus',async({page})=>{
  const button=native(page);await button.focus();await page.keyboard.down('Space');await finish(button);await expect(button).toHaveCSS('background-color','rgb(10, 20, 30)');
  await page.keyboard.up('Space');await finish(button);await expect(button).toBeFocused();expect(await page.evaluate(()=>window.buttonActivations)).toEqual(['animated']);
  await button.press('Enter');expect(await page.evaluate(()=>window.buttonActivations)).toEqual(['animated','animated']);
});

test('disabling animation, zero duration and reduced motion cancel active transitions',async({page})=>{
  const button=native(page);await button.hover();await button.evaluate(e=>{for(const animation of e.getAnimations()){animation.pause();animation.currentTime=300;}});
  await page.locator('#animated').evaluate(e=>{e.animated=false;});expect(await durations(button)).toEqual([]);await expect(button).toHaveCSS('background-color','rgb(80, 100, 120)');
  await page.mouse.move(0,0);await page.locator('#animated').evaluate(e=>{e.animated=true;e.animationDuration=0;});await button.hover();expect(await durations(button)).toEqual([]);
  await page.mouse.move(0,0);await page.locator('#animated').evaluate(e=>{e.animationDuration=1000;});await button.hover();await page.emulateMedia({reducedMotion:'reduce'});expect(await durations(button)).toEqual([]);
  await page.mouse.down();await expect(button).toHaveCSS('background-color','rgb(10, 20, 30)');expect(await durations(button)).toEqual([]);await page.mouse.up();
});

test('disabled and loading buttons skip interactive colors and retain loading semantics',async({page})=>{
  const button=native(page);await page.locator('#animated').evaluate(e=>{e.setAttribute('disabled','');});await button.hover({force:true});await page.mouse.down();await expect(button).toHaveCSS('background-color','rgb(20, 40, 60)');expect(await durations(button)).toEqual([]);await page.mouse.up();expect(await page.evaluate(()=>window.buttonActivations)).toEqual([]);
  await page.locator('#animated').evaluate(e=>{e.removeAttribute('disabled');e.loading=true;});await expect(button).toBeDisabled();await expect(button).toHaveAttribute('aria-busy','true');await expect(page.locator('#animated [part=spinner]')).toBeVisible();expect(await durations(button)).toEqual([]);
});

test('group defaults inherit without changing children and allow individual overrides',async({page})=>{
  expect(await page.locator('#inherited').evaluate(e=>[e.animated,e.animationDuration,e.getAttribute('animated'),e.getAttribute('animation-duration')])).toEqual([true,700,null,null]);
  expect(await page.locator('#opt-out').evaluate(e=>e.animated)).toBe(false);expect(await page.locator('#override').evaluate(e=>[e.animated,e.animationDuration])).toEqual([true,250]);
  await hoverMotion(native(page,'inherited'));expect(await durations(native(page,'inherited'))).toContain(700);
  await page.locator('#group').evaluate(e=>{e.animated=false;});expect(await durations(native(page,'inherited'))).toEqual([]);expect(await page.locator('#inherited').evaluate(e=>e.animated)).toBe(false);
  await hoverMotion(native(page,'override'));expect(await durations(native(page,'override'))).toContain(250);
  await native(page,'opt-out').hover();expect(await durations(native(page,'opt-out'))).toEqual([]);
  await hoverMotion(native(page,'opt-in'));expect(await durations(native(page,'opt-in'))).toContain(300);
});

test('dynamic group members inherit motion and removing overrides resumes inheritance',async({page})=>{
  await page.locator('#group').evaluate(e=>{const button=document.createElement('hy-button');button.id='dynamic';button.setAttribute('label','New');e.append(button);});
  expect(await page.locator('#dynamic').evaluate(e=>[e.animated,e.animationDuration,e.getAttribute('animated')])).toEqual([true,700,null]);await hoverMotion(native(page,'dynamic'));expect(await durations(native(page,'dynamic'))).toContain(700);
  await page.locator('#opt-out').evaluate(e=>e.removeAttribute('animated'));await hoverMotion(native(page,'opt-out'));expect(await durations(native(page,'opt-out'))).toContain(700);
  await page.locator('#group').evaluate(e=>{e.animationDuration=0;});expect(await durations(native(page,'opt-out'))).toEqual([]);
});

test('theme timing applies while explicit durations override inherited defaults',async({page})=>{
  await page.locator('#plain').evaluate(e=>{e.style.setProperty('--hy-button-animation-duration','.45s');e.style.setProperty('--hy-button-animation-easing','linear');e.animated=true;});
  expect(await page.locator('#plain').evaluate(e=>e.animationDuration)).toBe(450);await hoverMotion(native(page,'plain'));expect(await durations(native(page,'plain'))).toContain(450);await expect(native(page,'plain')).toHaveCSS('transition-timing-function','linear');
  await page.locator('#plain').evaluate(e=>{e.animationDuration=220;});await holdMotion(native(page,'plain'),()=>page.mouse.move(0,0));expect(await durations(native(page,'plain'))).toContain(220);
});

test('zero group duration cancels inherited motion while child timing and enabled flags override independently',async({page})=>{
  await page.locator('#inherited').evaluate(e=>{e.animated=true;});
  await hoverMotion(native(page,'inherited'));expect(await durations(native(page,'inherited'))).toContain(700);
  await page.locator('#group').evaluate(e=>{e.animationDuration=0;});expect(await durations(native(page,'inherited'))).toEqual([]);
  await page.locator('#inherited').evaluate(e=>{e.removeAttribute('animated');e.animationDuration=500;});
  await holdMotion(native(page,'inherited'),()=>page.mouse.move(0,0));expect(await durations(native(page,'inherited'))).toContain(500);
  await page.locator('#group').evaluate(e=>{e.animated=false;});expect(await durations(native(page,'inherited'))).toEqual([]);
  await page.locator('#group').evaluate(e=>{e.animated=true;});await hoverMotion(native(page,'inherited'));expect(await durations(native(page,'inherited'))).toContain(500);
  await page.locator('#inherited').evaluate(e=>e.removeAttribute('animation-duration'));expect(await durations(native(page,'inherited'))).toEqual([]);
});

test('group orientation and mixed variants retain joined corners and focused children',async({page})=>{
  const first=native(page,'inherited');await first.focus();await page.locator('#inherited').evaluate(e=>{e.variant='solid';});await page.locator('#group').evaluate(e=>{e.orientation='vertical';});await expect(first).toBeFocused();
  await expect(first).toHaveCSS('border-top-left-radius','4px');await expect(first).toHaveCSS('border-bottom-left-radius','0px');await expect(native(page,'override')).toHaveCSS('border-bottom-right-radius','4px');
  await page.locator('#group').evaluate(e=>{e.orientation='horizontal';});await expect(first).toHaveCSS('border-bottom-left-radius','4px');await expect(first).toBeFocused();
});

test('gallery exposes variants and independent button/group motion controls on desktop and mobile',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.goto(`/examples/?button-motion=${width}#button`);const live=page.locator('#button-live');
    await page.locator('#button-variant').selectOption('solid');await page.locator('#button-animation-duration').fill('400');await expect(live).toHaveJSProperty('variant','solid');await expect(live).toHaveJSProperty('animated',true);await expect(live).toHaveJSProperty('animationDuration',400);
    await page.locator('#button').scrollIntoViewIfNeeded();await page.screenshot({path:`.artifacts/button-motion-${width}.png`});
    await page.locator('label:has(#button-animated)').click();await expect(live).toHaveJSProperty('animated',false);
    await page.locator('#button-group-animation-duration').fill('600');const group=page.locator('#button-group-live');expect(await group.locator('hy-button').first().evaluate(e=>[e.animated,e.animationDuration,e.hasAttribute('animated')])).toEqual([true,600,false]);
    await page.locator('label:has(#button-group-animated)').click();expect(await group.locator('hy-button').first().evaluate(e=>e.animated)).toBe(false);
    expect(await page.locator('#content').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  }expect(errors).toEqual([]);
});
