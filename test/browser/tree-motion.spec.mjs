import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/tree-motion.html'); await page.waitForFunction(() => window.treeMotionReady);
});
const ids = page => page.locator('#tree').evaluate(element => [...element.shadowRoot.querySelectorAll('.row:not([inert])')].map(row => row.dataset.id));
async function finish(page) {
  await page.locator('#tree').evaluate(async element => {
    const animations = [...element.shadowRoot.querySelectorAll('.row')].flatMap(row => row.getAnimations());
    for (const animation of animations) animation.finish(); await Promise.allSettled(animations.map(animation => animation.finished));
  });
}
async function enable(page) { await page.locator('#tree').evaluate(element => { element.animated = true; element.animationDuration = 1000; }); }

test('focused registration and backward-compatible motion settings are explicit and bounded', async ({ page }) => {
  expect(await page.evaluate(() => [window.explicitTree, window.cleanTreeConstructor])).toEqual([true, true]);
  const tree = page.locator('#tree');
  expect(await tree.evaluate(element => [element.animated, element.animationDuration, element.arrowAnimated, element.arrowAnimationDuration])).toEqual([false, 200, true, 160]);
  await tree.evaluate(element => { element.animated = true; element.animationDuration = 20000; element.arrowAnimationDuration = -1; });
  expect(await tree.evaluate(element => [element.animationDuration, element.arrowAnimationDuration])).toEqual([10000, 0]);
  await tree.evaluate(element => { element.animationDuration = NaN; element.arrowAnimationDuration = Infinity; });
  expect(await tree.evaluate(element => [element.animationDuration, element.arrowAnimationDuration])).toEqual([200, 200]);
});

test('default branch changes and initial rendering stay immediate', async ({ page }) => {
  const result = await page.locator('#tree').evaluate(element => {
    element.expand('root'); const first = element.shadowRoot.querySelector('.row[data-id="editor"]');
    const instant = first.getAnimations().length === 0 && first.offsetHeight === 28;
    element.animated = true; element.data = [{id:'initial',expanded:true,children:[{id:'child'}]}];
    return [instant, element.shadowRoot.querySelectorAll('[data-hy-tree-motion]').length, [...element.shadowRoot.querySelectorAll('.row')].map(row=>row.dataset.id)];
  });
  expect(result).toEqual([true, 0, ['initial', 'child']]);
});

test('expansion and collapse animate height and opacity while logical visibility updates immediately', async ({ page }) => {
  await enable(page);
  const opening = await page.locator('#tree').evaluate(element => {
    element.expand('root'); const row = element.shadowRoot.querySelector('.row[data-id="editor"]'); const animation = row.getAnimations()[0];
    animation.pause(); animation.currentTime = 500;
    return { duration:animation.effect.getTiming().duration, frames:animation.effect.getKeyframes().map(({height,opacity})=>[height,opacity]), height:row.getBoundingClientRect().height, expanded:element.shadowRoot.querySelector('.row[data-id="root"] [role="treeitem"]').getAttribute('aria-expanded') };
  });
  expect(opening.duration).toBe(1000); expect(opening.frames).toEqual([['0px','0'],['28px','1']]);
  expect(opening.height).toBeGreaterThan(0); expect(opening.height).toBeLessThan(28); expect(opening.expanded).toBe('true'); await finish(page);
  await page.locator('#tree').evaluate(element => { element.collapse('root'); for (const row of element.shadowRoot.querySelectorAll('[inert]')) row.getAnimations()[0].pause(); });
  await expect(page.locator('#tree .row[data-id="editor"]')).toHaveAttribute('inert');
  await expect(page.locator('#tree .row[data-id="editor"]')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('#tree .row[data-id="root"] [role="treeitem"]')).toHaveAttribute('aria-expanded','false');
  expect(await ids(page)).toEqual(['root','after','other']); await finish(page);
  await expect(page.locator('#tree .row[data-id="editor"]')).toHaveCount(0);
});

test('rapid reversal keeps the actual renderer, input value and current animation position', async ({ page }) => {
  await enable(page);
  const result = await page.locator('#tree').evaluate(element => {
    element.expand('root'); const row = element.shadowRoot.querySelector('.row[data-id="editor"]'); const input = row.querySelector('tree-motion-probe').shadowRoot.querySelector('input'); input.value = 'Edited';
    let animation = row.getAnimations()[0]; animation.pause(); animation.currentTime = 300;
    const first = row.getBoundingClientRect().height; element.collapse('root');
    animation = row.getAnimations()[0]; const closeFrom = parseFloat(animation.effect.getKeyframes()[0].height); animation.pause(); animation.currentTime = 200;
    const partial = row.getBoundingClientRect().height; element.expand('root'); animation = row.getAnimations()[0]; animation.pause();
    return { first, closeFrom, partial, reopenFrom:parseFloat(animation.effect.getKeyframes()[0].height), sameInput:input===row.querySelector('tree-motion-probe').shadowRoot.querySelector('input'), value:input.value, counts:[window.probeConnections,window.probeDisconnections], inert:row.inert };
  });
  expect(result.closeFrom).toBeCloseTo(result.first, 1); expect(result.reopenFrom).toBeCloseTo(result.partial, 1);
  expect(result.sameInput).toBe(true); expect(result.value).toBe('Edited'); expect(result.counts).toEqual([2,0]); expect(result.inert).toBe(false); await finish(page);
});

test('unchanged rows and focused custom controls stay connected through branch rendering', async ({ page }) => {
  await enable(page); const input = page.locator('#tree .row[data-id="after"] input'); await input.fill('Kept'); await input.focus();
  await page.locator('#tree').evaluate(element => { window.afterRow = element.shadowRoot.querySelector('.row[data-id="after"]'); element.expand('root'); }); await finish(page);
  await expect(input).toBeFocused(); await expect(input).toHaveValue('Kept');
  await page.locator('#tree').evaluate(element => element.collapse('root')); await finish(page); await expect(input).toBeFocused();
  expect(await page.locator('#tree').evaluate(element => window.afterRow===element.shadowRoot.querySelector('.row[data-id="after"]'))).toBe(true);
  expect(await page.evaluate(()=>[window.probeConnections,window.probeDisconnections])).toEqual([2,1]);
});

test('arrow rotation has its own switch and duration and shares an explicit common duration', async ({ page }) => {
  const tree = page.locator('#tree');
  const shared = await tree.evaluate(element => {
    element.animationDuration = 600; const icon = element.shadowRoot.querySelector('.row[data-id="root"] .toggle-icon'); getComputedStyle(icon).transform;
    element.expand('root'); getComputedStyle(icon).transform;
    const animation = icon.getAnimations().find(animation=>animation.transitionProperty==='transform'); animation.pause();
    const duration = animation.effect.getTiming().duration; animation.currentTime = duration;
    const matrix = new DOMMatrix(getComputedStyle(icon).transform);
    return [duration, [matrix.a,matrix.b,matrix.c,matrix.d].map(value=>Math.round(value))];
  });
  expect(shared).toEqual([600,[0,1,-1,0]]);
  const independent = await tree.evaluate(element => {
    element.arrowAnimationDuration = 250; element.collapse('root');
    const icon = element.shadowRoot.querySelector('.row[data-id="root"] .toggle-icon'); getComputedStyle(icon).transform;
    const animation = icon.getAnimations().find(animation=>animation.transitionProperty==='transform'); animation.pause(); return animation.effect.getTiming().duration;
  }); expect(independent).toBe(250);
  const disabled = await tree.evaluate(element => {
    element.animated = true; element.arrowAnimated = false; element.expand('root');
    const icon = element.shadowRoot.querySelector('.row[data-id="root"] .toggle-icon');
    return [icon.getAnimations().length, getComputedStyle(icon).transform, element.shadowRoot.querySelector('.row[data-id="editor"]').getAnimations().length];
  }); expect(disabled).toEqual([0,'matrix(0, 1, -1, 0, 0, 0)',1]);
});

test('theme duration and easing tokens apply with explicit attribute precedence', async ({ page }) => {
  const result = await page.locator('#tree').evaluate(element => {
    element.animated = true; element.style.setProperty('--hy-tree-animation-duration','0.45s'); element.style.setProperty('--hy-tree-arrow-animation-duration','100ms'); element.style.setProperty('--hy-tree-animation-easing','linear');
    element.expand('root'); const row = element.shadowRoot.querySelector('.row[data-id="editor"]');
    const timing = row.getAnimations()[0].effect.getTiming(); const icon = element.shadowRoot.querySelector('.toggle-icon'); const arrow = getComputedStyle(icon).transitionDuration;
    element.collapse('root'); element.animationDuration = 800; element.expand('root');
    return [timing.duration,timing.easing,arrow,element.shadowRoot.querySelector('.row[data-id="editor"]').getAnimations()[0].effect.getTiming().duration,getComputedStyle(icon).transitionDuration];
  }); expect(result).toEqual([450,'linear','0.1s, 0.1s',800,'0.8s, 0.8s']);
  const invalid = await page.locator('#tree').evaluate(element => {
    element.removeAttribute('animation-duration'); element.style.setProperty('--hy-tree-animation-duration','..s'); element.style.setProperty('--hy-tree-animation-easing','invalid-easing');
    element.collapse('root'); const timing = element.shadowRoot.querySelector('.row[data-id="editor"]').getAnimations()[0].effect.getTiming();
    return [timing.duration,timing.easing];
  }); expect(invalid).toEqual([200,'ease']);
});

test('zero duration, disabled effects and reduced motion settle outstanding transitions', async ({ page }) => {
  await enable(page); await page.locator('#tree').evaluate(element => { element.expand('root'); element.collapse('root'); element.animationDuration = 0; });
  await expect(page.locator('#tree [data-hy-tree-motion]')).toHaveCount(0); await expect(page.locator('#tree .row[data-id="editor"]')).toHaveCount(0);
  await page.locator('#tree').evaluate(element => { element.animationDuration=1000; element.expand('root'); element.animated=false; });
  await expect(page.locator('#tree [data-hy-tree-motion]')).toHaveCount(0);
  await page.locator('#tree').evaluate(element => { element.animated=true; element.collapse('root'); });
  await page.emulateMedia({reducedMotion:'reduce'}); await expect(page.locator('#tree [data-hy-tree-motion]')).toHaveCount(0);
  expect(await page.locator('#tree').evaluate(element=>{element.expand('root');return [...element.shadowRoot.querySelectorAll('.row,.toggle-icon')].flatMap(row=>row.getAnimations()).length;})).toBe(0);
});

test('keyboard navigation and collapse focus ignore inert closing descendants', async ({ page }) => {
  await enable(page); const tree=page.locator('#tree'); await tree.focus(); await tree.press('ArrowRight'); await finish(page);
  await tree.press('ArrowRight'); await tree.press('Enter'); expect(await tree.evaluate(element=>element.selectedId)).toBe('editor');
  await tree.locator('.row[data-id="editor"] input').focus();
  await tree.evaluate(element=>{element.collapse('root'); element.shadowRoot.querySelector('.row[data-id="editor"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));});
  await expect(tree).toBeFocused(); expect(await tree.evaluate(element=>element.selectedId)).toBe('editor');
  await expect(tree).toHaveAttribute('aria-activedescendant','hy-tree-item-root');
  expect(await page.evaluate(()=>window.treeEvents.filter(event=>event[0]==='selection-change').length)).toBe(1); await finish(page);
});

test('nested and simultaneous branch changes leave no stale rows after reversal', async ({ page }) => {
  await enable(page);
  await page.locator('#tree').evaluate(element=>{element.expand('root');element.expand('other');element.collapse('nested');element.collapse('root');element.expand('root');});
  await finish(page); expect(await ids(page)).toEqual(['root','editor','nested','after','other','last']);
  await expect(page.locator('#tree [data-hy-tree-motion],[inert]')).toHaveCount(0);
});

test('data replacement and disconnection release animations and reconnect without initial motion', async ({ page }) => {
  await enable(page);
  const result=await page.locator('#tree').evaluate(element=>{
    element.expand('root'); const old=element.shadowRoot.querySelector('.row[data-id="editor"]');
    element.data=[{id:'replacement',children:[{id:'child'}]}]; const replaced=old.getAnimations().length;
    element.expand('replacement'); const child=element.shadowRoot.querySelector('.row[data-id="child"]'); element.remove(); const disconnected=child.getAnimations().length;
    document.body.append(element); return [replaced,disconnected,element.shadowRoot.querySelectorAll('[data-hy-tree-motion]').length];
  }); expect(result).toEqual([0,0,0]); expect(await ids(page)).toEqual(['replacement','child']);
});

test('auto-height resize renders retain in-flight animations rather than snapping', async ({ page }) => {
  await enable(page);
  expect(await page.locator('#tree').evaluate(async element=>{
    element.style.height='auto'; element.expand('root'); const row=element.shadowRoot.querySelector('.row[data-id="editor"]'); const animation=row.getAnimations()[0]; animation.pause(); animation.currentTime=400;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return row.getAnimations()[0]===animation && row.getBoundingClientRect().height>0 && row.getBoundingClientRect().height<28;
  })).toBe(true); await finish(page);
});

test('virtualization keeps fixed row geometry when expanding and collapsing large subtrees', async ({ page }) => {
  await enable(page);
  await page.locator('#tree').evaluate(element=>{element.data=[{id:'large',children:Array.from({length:2000},(_,index)=>({id:'node-'+index}))}];element.expand('large');});
  expect(await page.locator('#tree .row').count()).toBeLessThan(50); await expect(page.locator('#tree [data-hy-tree-motion]')).toHaveCount(0);
  await expect(page.locator('#tree .virtual-spacer')).toHaveAttribute('aria-hidden','true');
  expect(await page.locator('#tree').evaluate(element=>{element.scrollTop=28000;element.dispatchEvent(new Event('scroll'));return [element.scrollHeight,[...element.shadowRoot.querySelectorAll('.row')].every(row=>row.offsetHeight===28)];})).toEqual([56036,true]);
  expect(await page.locator('#tree').evaluate(element=>element.reveal('node-1999'))).toBe(true);
  await expect(page.locator('#tree .row[data-id="node-1999"]')).toBeVisible();
  await page.locator('#tree').evaluate(element=>element.collapse('large')); await expect(page.locator('#tree .row')).toHaveCount(1);
  await expect(page.locator('#tree [data-hy-tree-motion]')).toHaveCount(0);
});

test('gallery exposes independent branch and arrow motion controls at desktop and mobile widths', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.goto(`/examples/?tree-motion-width=${width}#tree`);
    const tree=page.locator('#tree-live');await expect(tree).toHaveJSProperty('animated',true);
    await page.locator('#tree-animation-duration').fill('600');await page.locator('#tree-arrow-animation-duration').fill('400');
    await tree.locator('.row[data-id="lights"] .toggle').click();
    await expect(tree.locator('.row[data-id="sun"]')).toHaveCount(0);
    await tree.locator('.row[data-id="lights"] .toggle').click();await expect(tree.locator('.row[data-id="sun"]')).toBeVisible();
    await page.locator('#tree').scrollIntoViewIfNeeded();await page.screenshot({path:`.artifacts/tree-motion-${width}.png`});
    await page.locator('label:has(#tree-arrow-animated)').click();await expect(tree).toHaveJSProperty('arrowAnimated',false);
    await page.locator('label:has(#tree-animated)').click();await expect(tree).toHaveJSProperty('animated',false);
    expect(await tree.evaluate(element=>[element.animationDuration,element.arrowAnimationDuration])).toEqual([600,400]);
    expect(await page.locator('#content').evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  }
  expect(errors).toEqual([]);
});
