import { test, expect } from '@playwright/test';
test.beforeEach(async ({page})=>{await page.goto('/test/browser/medium-components.html');await page.waitForFunction(()=>customElements.get('hy-auto-complete'));});
const host=page=>page.locator('#auto');
const panel=page=>host(page).locator('[part="panel"]');
async function configure(page){await host(page).evaluate(element=>{element.animated=true;element.animationDuration=1000;});}
async function finish(page){await panel(page).evaluate(async element=>{const animation=element.getAnimations()[0];if(animation){animation.finish();await animation.finished;}});}

test('autocomplete animation is opt-in, bounded and initial rendering stays immediate',async({page})=>{
  expect(await host(page).evaluate(e=>[e.animated,e.animationDuration])).toEqual([false,180]);
  const result=await host(page).evaluate(e=>{
    e.open=true;const immediate=e.shadowRoot.querySelector('.panel').getAnimations().length;e.open=false;
    e.animated=true;e.animationDuration=20000;const max=e.animationDuration;e.animationDuration=-1;const min=e.animationDuration;e.animationDuration=NaN;
    const initial=document.createElement('hy-auto-complete');initial.animated=true;initial.open=true;document.body.append(initial);
    return [immediate,max,min,e.animationDuration,initial.shadowRoot.querySelector('.panel').getAnimations().length];
  });expect(result).toEqual([0,10000,0,180,0]);
});

test('panel reveals in the top layer and filtering or async content does not restart it',async({page})=>{
  await configure(page);await host(page).getByRole('combobox').focus();
  const result=await host(page).evaluate(e=>{
    const panel=e.shadowRoot.querySelector('.panel'),animation=panel.getAnimations()[0];animation.pause();animation.currentTime=400;
    const frames=animation.effect.getKeyframes();e.value='oc';e.loading=true;e.options=[{value:'ocean'}];e.loading=false;
    return {duration:animation.effect.getTiming().duration,frames:frames.map(f=>f.clipPath),same:panel.getAnimations()[0]===animation,opacity:parseFloat(getComputedStyle(panel).opacity),popover:panel.matches(':popover-open'),inert:panel.inert};
  });expect(result.duration).toBe(1000);expect(result.frames[0]).toContain('100%');expect(result.same).toBe(true);expect(result.opacity).toBeGreaterThan(0);expect(result.opacity).toBeLessThan(1);expect(result.popover).toBe(true);expect(result.inert).toBe(false);
  const box=await panel(page).boundingBox();const clip=await page.locator('#clip').boundingBox();expect(box.y+box.height).toBeGreaterThan(clip.y+clip.height);await finish(page);
});

test('closing is immediately inert and logically closed before the top layer disappears',async({page})=>{
  await configure(page);await host(page).getByRole('combobox').focus();await finish(page);
  await host(page).evaluate(e=>{e.open=false;const panel=e.shadowRoot.querySelector('.panel');panel.getAnimations()[0].pause();panel.querySelector('[role=option]').click();});
  await expect(host(page).getByRole('combobox')).toHaveAttribute('aria-expanded','false');await expect(host(page).getByRole('combobox')).not.toHaveAttribute('aria-activedescendant');
  await expect(panel(page)).toHaveAttribute('inert');await expect(panel(page)).toHaveAttribute('aria-hidden','true');expect(await panel(page).evaluate(e=>e.matches(':popover-open'))).toBe(true);
  await expect(host(page).getByRole('combobox')).toHaveValue('');await finish(page);await expect(panel(page)).toBeHidden();expect(await panel(page).evaluate(e=>e.matches(':popover-open'))).toBe(false);
});

test('rapid reopen reverses opacity and clipping without replacing options or losing input focus',async({page})=>{
  await configure(page);await host(page).getByRole('combobox').focus();
  const result=await host(page).evaluate(e=>{
    const panel=e.shadowRoot.querySelector('.panel'),item=panel.querySelector('[role=option]');let animation=panel.getAnimations()[0];animation.pause();animation.currentTime=400;
    const opening=parseFloat(getComputedStyle(panel).opacity);e.open=false;animation=panel.getAnimations()[0];const fromClose=parseFloat(animation.effect.getKeyframes()[0].opacity);animation.pause();animation.currentTime=200;
    const closing=parseFloat(getComputedStyle(panel).opacity);e.open=true;animation=panel.getAnimations()[0];animation.pause();
    return [opening,fromClose,closing,parseFloat(animation.effect.getKeyframes()[0].opacity),item===panel.querySelector('[role=option]'),panel.inert];
  });expect(result[1]).toBeCloseTo(result[0],3);expect(result[3]).toBeCloseTo(result[2],3);expect(result.slice(4)).toEqual([true,false]);await expect(host(page).getByRole('combobox')).toBeFocused();await finish(page);
});

test('panels above their anchor reveal from the bottom while placement stays stable',async({page})=>{
  await configure(page);await page.locator('#clip').evaluate(e=>{e.style.cssText='position:fixed;bottom:12px;left:24px;width:300px;height:36px;overflow:hidden;transform:translate(2px,0)';});
  const result=await host(page).evaluate(e=>{e.open=true;const panel=e.shadowRoot.querySelector('.panel'),animation=panel.getAnimations()[0];animation.pause();animation.currentTime=500;return [animation.effect.getKeyframes()[0].clipPath,panel.getBoundingClientRect().bottom,e.shadowRoot.querySelector('.control').getBoundingClientRect().top];});
  expect(result[0]).toMatch(/^inset\(100%/u);expect(result[1]).toBeLessThanOrEqual(result[2]-3);await finish(page);
});

test('selection keeps its input and form notifications with a closing animation',async({page})=>{
  await configure(page);const input=host(page).getByRole('combobox');await input.fill('o');await input.press('ArrowDown');await input.press('Enter');
  await expect(input).toHaveValue('orbit');await expect(input).toBeFocused();await expect(input).toHaveAttribute('aria-expanded','false');
  expect(await page.evaluate(()=>window.componentEvents.filter(e=>e.name==='option-select'&&e.id==='auto').length)).toBe(1);
  await finish(page);await expect(panel(page)).toBeHidden();
});

test('configuration, reduced motion, disabled fields and IME settle outstanding effects',async({page})=>{
  await configure(page);await host(page).getByRole('combobox').focus();
  await panel(page).evaluate(e=>{for(const animation of e.getAnimations())animation.pause();});
  await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>panel(page).evaluate(e=>e.getAnimations().length)).toBe(0);
  await host(page).evaluate(e=>{e.open=false;e.open=true;});expect(await panel(page).evaluate(e=>e.getAnimations().length)).toBe(0);
  await page.emulateMedia({reducedMotion:'no-preference'});await host(page).evaluate(e=>{e.open=false;e.open=true;e.disabled=true;});await expect(panel(page)).toBeHidden();expect(await panel(page).evaluate(e=>e.getAnimations().length)).toBe(0);
  await host(page).evaluate(e=>{e.disabled=false;e.open=true;e.readOnly=true;});await expect(panel(page)).toBeHidden();
  await host(page).evaluate(e=>{e.readOnly=false;e.open=true;e.animationDuration=0;});expect(await panel(page).evaluate(e=>e.getAnimations().length)).toBe(0);
  await host(page).getByRole('combobox').dispatchEvent('compositionstart');await expect(panel(page)).toBeHidden();
});

test('motion tokens, explicit duration priority and disconnection clean up owned effects',async({page})=>{
  const result=await host(page).evaluate(e=>{
    e.animated=true;e.style.setProperty('--hy-auto-complete-animation-duration','.45s');e.style.setProperty('--hy-auto-complete-animation-easing','linear');e.open=true;
    const panel=e.shadowRoot.querySelector('.panel');const timing=panel.getAnimations()[0].effect.getTiming();e.open=false;e.animationDuration=700;e.open=true;
    const explicit=panel.getAnimations()[0].effect.getTiming().duration;e.remove();const cleanup=[panel.getAnimations().length,panel.matches(':popover-open')];document.querySelector('#clip').append(e);
    return [timing.duration,timing.easing,explicit,...cleanup,panel.getAnimations().length];
  });expect(result).toEqual([450,'linear',700,0,false,0]);
});

test('autocomplete gallery offers motion configuration at desktop and mobile widths',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.goto(`/examples/?auto-motion=${width}#auto-complete`);const auto=page.locator('#auto-complete-live');
    await expect(auto).toHaveJSProperty('animated',true);await page.locator('#auto-complete-duration').fill('600');await auto.getByRole('combobox').fill('o');await expect(auto.getByRole('option')).toHaveCount(2);
    await auto.locator('[part=panel]').evaluate(async e=>{await Promise.allSettled(e.getAnimations().map(animation=>animation.finished));});
    await page.screenshot({path:`.artifacts/autocomplete-motion-${width}.png`});await auto.getByRole('combobox').press('Escape');await expect(auto.locator('[part=panel]')).toBeHidden();
    await page.locator('label:has(#auto-complete-animated)').click();await expect(auto).toHaveJSProperty('animated',false);expect(await auto.evaluate(e=>e.animationDuration)).toBe(600);
  }expect(errors).toEqual([]);
});
