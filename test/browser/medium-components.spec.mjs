import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.goto('/test/browser/medium-components.html'); });

test('autocomplete registers explicitly, filters and selects enabled options without changing focus', async ({ page }) => {
  expect(await page.evaluate(()=>window.registrationIsExplicit)).toBe(true);
  const host=page.locator('#auto'); const input=host.getByRole('combobox'); await input.fill('o');
  await expect(host.getByRole('option')).toHaveCount(3); await input.press('ArrowDown'); await input.press('Enter');
  await expect(input).toHaveValue('orbit'); await expect(input).toBeFocused(); await expect(input).toHaveAttribute('aria-expanded','false');
  expect(await page.evaluate(()=>window.componentEvents.filter(e=>e.name==='option-select').at(-1).detail.value)).toBe('orbit');
  expect(await host.locator('[part="panel"]').evaluate(e=>e.matches(':popover-open'))).toBe(false);
});

test('autocomplete allows free text, clear, custom filtering and asynchronous result updates', async ({ page }) => {
  const host=page.locator('#auto'); const input=host.getByRole('combobox'); await input.fill('Unlisted'); await expect(host.getByRole('status')).toHaveText('No results');
  await input.press('Enter'); await expect(input).toHaveValue('Unlisted');
  await host.evaluate(e=>{e.loading=true;}); await expect(host.getByRole('status')).toHaveText('Loading…');
  await host.evaluate(e=>{e.filterOption=false;e.options=[{value:'remote',label:'Remote result'}];e.loading=false;});
  await expect(host.getByRole('option')).toHaveText('Remote result'); await host.getByRole('option').click(); await expect(input).toHaveValue('remote');
  await host.getByRole('button',{name:'Clear value'}).click(); await expect(input).toHaveValue('');
  expect(await page.evaluate(()=>window.componentEvents.filter(e=>e.name==='clear').length)).toBe(1);
});

test('autocomplete debounces search, respects IME, and cleans pending work on disconnect', async ({ page }) => {
  await page.clock.install(); const host=page.locator('#auto'); const input=host.getByRole('combobox');
  await host.evaluate(e=>{e.searchDelay=100;}); await input.fill('o'); await input.fill('oc'); await page.clock.fastForward(110);
  expect(await page.evaluate(()=>window.componentEvents.filter(e=>e.name==='search').map(e=>e.detail.value))).toEqual(['oc']);
  await input.dispatchEvent('compositionstart'); await input.fill('海'); await input.dispatchEvent('keydown',{key:'Enter',isComposing:true});
  await expect(input).toHaveValue('海'); await page.clock.fastForward(110); expect(await page.evaluate(()=>window.componentEvents.filter(e=>e.name==='search').length)).toBe(1);
  await input.dispatchEvent('compositionend'); await page.clock.fastForward(110); expect(await page.evaluate(()=>window.componentEvents.filter(e=>e.name==='search').at(-1).detail.value)).toBe('海');
  await input.fill('later'); await host.evaluate(e=>e.remove()); await page.clock.fastForward(200); expect(await page.evaluate(()=>window.componentEvents.filter(e=>e.name==='search').length)).toBe(2);
});

test('autocomplete preserves native undo, constraints, FormData, reset and disabled fieldsets', async ({ page }) => {
  const input=page.locator('#auto input'); await input.focus(); await input.pressSequentially('ocean'); await input.press('Control+z'); await expect(input).toHaveValue('');
  await page.locator('#form-auto input').fill('new'); expect(await page.locator('#native-form').evaluate(e=>new FormData(e).get('query'))).toBe('new');
  await page.locator('#native-form').evaluate(e=>e.reset()); await expect(page.locator('#form-auto input')).toHaveValue('initial');
  await page.locator('#fields').evaluate(e=>{e.disabled=true;}); await expect(page.locator('#form-auto input')).toBeDisabled(); expect(await page.locator('#native-form').evaluate(e=>[...new FormData(e)].length)).toBe(0);
});

test('menu expands inline submenus, supports keyboard navigation and skips disabled items', async ({ page }) => {
  const menu=page.locator('#menu'); await menu.getByRole('menuitem',{name:'Assets',exact:true}).focus(); await page.keyboard.press('ArrowRight');
  await expect(menu.getByRole('menuitem',{name:'Scenes',exact:true})).toBeFocused(); await page.keyboard.press('ArrowDown'); await expect(menu.getByRole('menuitem',{name:'Textures',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(menu.getByRole('menuitem',{name:'Sand',exact:true})).toBeFocused(); await page.keyboard.press('Enter');
  expect(await menu.evaluate(e=>e.selectedKeys)).toEqual(['sand']); await page.keyboard.press('ArrowLeft'); await expect(menu.getByRole('menuitem',{name:'Textures',exact:true})).toBeFocused();
});

test('menu cancelable selection, multiple choices, typeahead and unsafe href guards', async ({ page }) => {
  const menu=page.locator('#menu'); await menu.evaluate(e=>e.addEventListener('menu-select',event=>event.preventDefault(),{once:true}));
  await menu.getByRole('menuitem',{name:'Home',exact:true}).click(); expect(await menu.evaluate(e=>e.selectedKeys)).toEqual([]);
  await menu.evaluate(e=>{e.multiple=true;}); await menu.getByRole('menuitemcheckbox',{name:'Home',exact:true}).click(); await menu.getByRole('menuitemcheckbox',{name:'Settings',exact:true}).click(); expect(await menu.evaluate(e=>e.selectedKeys)).toEqual(['home','settings']);
  await menu.getByRole('menuitemcheckbox',{name:'Home',exact:true}).focus(); await page.keyboard.press('s'); await expect(menu.getByRole('menuitemcheckbox',{name:'Settings',exact:true})).toBeFocused();
  await menu.evaluate(e=>{e.items=[{key:'unsafe',label:'Unsafe',href:'javascript:alert(1)'}];}); await expect(menu.locator('a')).toHaveCount(0);
});

test('horizontal menu uses top-layer submenus and closes on Escape and outside clicks', async ({ page }) => {
  const menu=page.locator('#menu'); await menu.evaluate(e=>{e.mode='horizontal';}); const assets=menu.getByRole('menuitem',{name:'Assets',exact:true});
  await assets.focus(); await page.keyboard.press('ArrowDown'); await expect(menu.getByRole('menuitem',{name:'Scenes',exact:true})).toBeFocused();
  expect(await menu.locator('[part="submenu"]').first().evaluate(e=>e.matches(':popover-open'))).toBe(true);
  await page.keyboard.press('Escape'); await expect(assets).toBeFocused(); await expect(menu.getByRole('menuitem',{name:'Scenes',exact:true})).toBeHidden();
  await assets.click(); await page.locator('#outside').click(); expect(await menu.evaluate(e=>e.openKeys)).toEqual([]);
});

test('pagination bounds pages, emits user actions only, supports quick jump and page sizes', async ({ page }) => {
  const host=page.locator('#pagination'); await expect(host.getByRole('button',{name:'Previous page'})).toBeDisabled();
  await host.getByRole('button',{name:'Next page'}).click(); await expect(host).toHaveJSProperty('page',2);
  await host.getByRole('spinbutton',{name:'Go to page'}).fill('999'); await host.getByRole('spinbutton').press('Enter'); await expect(host).toHaveJSProperty('page',13);
  await host.getByRole('combobox',{name:'Items per page'}).selectOption('20'); await expect(host).toHaveJSProperty('page',7); await expect(host).toHaveJSProperty('pageSize',20);
  const count=await page.evaluate(()=>window.componentEvents.filter(e=>e.name==='page-change').length); await host.evaluate(e=>{e.total=0;e.page=200;}); await expect(host).toHaveJSProperty('page',1); expect(await page.evaluate(()=>window.componentEvents.filter(e=>e.name==='page-change').length)).toBe(count);
});

test('pagination stays bounded for enormous totals, supports keyboard and disabled state', async ({ page }) => {
  const host=page.locator('#pagination'); await host.evaluate(e=>{e.total=1e12;e.page=5000;}); expect(await host.locator('[part="page"]').count()).toBeLessThanOrEqual(7);
  await host.getByRole('button',{name:'Page 5000',exact:true}).focus(); await page.keyboard.press('ArrowRight'); await expect(host).toHaveJSProperty('page',5001);
  await host.evaluate(e=>{e.disabled=true;}); await expect(host.getByRole('button',{name:'Next page'})).toBeDisabled();
  await host.evaluate(e=>{e.total=1;e.setAttribute('hide-on-single-page','');}); await expect(host.getByRole('navigation')).toBeHidden();
});

test('shared pagination controls preserve standalone size and jump event behavior', async ({ page }) => {
  const pagination = page.locator('#pagination');
  await pagination.evaluate(element => { element.page = 5; });
  const events = () => page.evaluate(() => window.componentEvents.filter(event => event.id === 'pagination' && event.name === 'page-change').map(event => event.detail));
  expect(await events()).toEqual([]);
  const size = pagination.getByRole('combobox', { name: 'Items per page' });
  await size.focus();
  await size.selectOption('20');
  await expect(pagination).toHaveJSProperty('page', 3);
  await expect(size).toBeFocused();
  await expect(pagination.locator('[part="total"]')).toHaveText('41–60 / 125');
  expect(await events()).toEqual([{ page: 3, pageSize: 20, total: 125, source: 'size' }]);
  const jump = pagination.getByRole('spinbutton', { name: 'Go to page' });
  await jump.fill('1000');
  await jump.press('Enter');
  await expect(pagination).toHaveJSProperty('page', 7);
  await expect(jump).toHaveValue('7');
  expect(await events()).toEqual([
    { page: 3, pageSize: 20, total: 125, source: 'size' },
    { page: 7, pageSize: 20, total: 125, source: 'jump' },
  ]);
  await pagination.evaluate(element => { element.total = 0; element.simple = true; element.setAttribute('size', 'small'); });
  await expect(pagination.locator('[part="pages"]')).toHaveText('1 / 1');
  await expect(pagination.locator('[part="total"]')).toHaveText('0–0 / 0');
  await expect(pagination.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await expect(size).toHaveCSS('min-height', '22px');
  expect(await events()).toHaveLength(2);
});

test('tree select filters ancestors, selects leaves and supports expansion keyboard commands', async ({ page }) => {
  const tree=page.locator('#tree'); const input=tree.getByRole('combobox'); await input.focus(); await input.press('ArrowRight'); await input.press('ArrowDown'); await input.press('Enter');
  await expect(input).toHaveValue('Ocean scene'); expect(await tree.evaluate(e=>e.value)).toBe('ocean');
  await input.click(); await input.fill('sand'); await expect(tree.locator('[data-value="assets"]')).toBeVisible(); await expect(tree.locator('[data-value="textures"]')).toBeVisible(); await expect(tree.locator('[data-value="sand"]')).toBeVisible();
  await tree.locator('[data-value="sand"]').click(); await expect(input).toHaveValue('Sand texture');
});

test('tree select independent multiple selection, tags, FormData and reset preserve values', async ({ page }) => {
  const tree=page.locator('#multi'); await tree.getByRole('combobox').focus(); await tree.getByRole('button',{name:'Expand Assets',exact:true}).click(); await tree.locator('[data-value="textures"]').click();
  expect(await tree.evaluate(e=>e.values)).toEqual(['ocean','textures']); expect(await page.locator('#native-form').evaluate(e=>new FormData(e).getAll('tags'))).toEqual(['ocean','textures']);
  await tree.getByRole('button',{name:'Remove Ocean scene'}).click(); expect(await tree.evaluate(e=>e.values)).toEqual(['textures']);
  await page.locator('#native-form').evaluate(e=>e.reset()); expect(await tree.evaluate(e=>e.values)).toEqual(['ocean']);
});

test('tree select handles async options and loading, disabled branches, clear, and form value assignment', async ({ page }) => {
  const tree=page.locator('#tree'); await tree.evaluate(e=>{e.loading=true;}); await tree.getByRole('combobox').focus(); await expect(tree.getByRole('status')).toHaveText('Loading…');
  await tree.evaluate(e=>{e.loading=false;e.value='ocean';}); await tree.getByRole('button',{name:'Clear selection'}).click(); expect(await tree.evaluate(e=>e.value)).toBe('');
  await page.locator('#form').evaluate(e=>e.setValues({destination:['ocean','sand']})); expect(await page.locator('#managed-tree').evaluate(e=>e.values)).toEqual(['ocean','sand']);
  expect(await page.locator('#form').evaluate(e=>e.values.destination)).toEqual(['ocean','sand']);
  await tree.evaluate(e=>{e.disabled=true;}); await expect(tree.getByRole('combobox')).toBeDisabled(); await expect(tree.locator('[part="panel"]')).toBeHidden();
});

test('tree and menu normalize malformed, duplicate and cyclic data safely', async ({ page }) => {
  await page.locator('#tree').evaluate(e=>{const node={value:'a',label:'A',children:[]};node.children.push(node);e.options=[null,node,node];});
  await page.locator('#tree input').focus(); await expect(page.locator('#tree').getByRole('treeitem')).toHaveCount(1);
  await page.locator('#menu').evaluate(e=>{const item={key:'a',label:'<img src=x>',children:[]};item.children.push(item);e.items=[null,item,item];}); await expect(page.locator('#menu').getByRole('menuitem')).toHaveCount(1); await expect(page.locator('#menu img')).toHaveCount(0);
});

test('image loads safely, exposes dimensions and supports modal zoom, rotation and focus return', async ({ page }) => {
  const host=page.locator('#image'); await expect(host).toHaveJSProperty('status','loaded'); await expect(host.locator('[part="image"]')).toHaveAttribute('alt','Ocean artwork');
  const trigger=host.getByRole('button',{name:'Preview Ocean artwork'}); await trigger.click(); const dialog=host.getByRole('dialog',{name:'Image preview'}); await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Zoom in',exact:true}).click(); await dialog.getByRole('button',{name:'Rotate right',exact:true}).click();
  await expect(dialog.locator('[part="preview-image"]')).toHaveCSS('transform',/matrix/); expect(await dialog.locator('[part="preview-image"]').evaluate(e=>e.style.transform)).toContain('rotate(90deg) scale(1.2)');
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
});

test('image fallback is attempted once and stale source loads cannot replace the current image', async ({ page }) => {
  await page.route('**/fail.png',route=>route.fulfill({status:404,body:''})); const host=page.locator('#image');
  await host.evaluate(e=>{e.fallback=window.secondArtwork;e.src='/fail.png';}); await expect(host).toHaveJSProperty('status','loaded');
  expect(await host.locator('[part="image"]').evaluate(e=>e.currentSrc)).toBe(await page.evaluate(()=>window.secondArtwork));
  await host.evaluate(e=>{e.fallback='/fail.png';}); await expect(host).toHaveJSProperty('status','error'); await expect(host.locator('[part="error"]')).toBeVisible();
  await host.evaluate(e=>{e.src=window.artwork;e.preview=false;}); await expect(host).toHaveJSProperty('status','loaded'); await expect(host.locator('[part="preview-trigger"]')).toBeHidden();
});

test('standalone image preview navigates a collection, resets transforms and handles empty collections', async ({ page }) => {
  const host=page.locator('#viewer'); await page.locator('#open-images').click(); const dialog=host.getByRole('dialog');
  await expect(host.locator('[part="counter"]')).toHaveText('1 / 2'); await dialog.getByRole('button',{name:'Zoom in',exact:true}).click(); await page.keyboard.press('ArrowRight');
  await expect(host.locator('[part="counter"]')).toHaveText('2 / 2'); await expect(host.locator('[part="caption"]')).toHaveText('Moon study');
  expect(await host.locator('[part="preview-image"]').evaluate(e=>e.style.transform)).toContain('scale(1)');
  await dialog.getByRole('button',{name:'Close preview'}).click(); await expect(page.locator('#open-images')).toBeFocused();
  await host.evaluate(e=>{e.show();e.images=[];}); await expect(dialog).toBeHidden();
});

test('image previews release modality on disconnect and fit mobile viewports', async ({ page }) => {
  await page.setViewportSize({width:390,height:750}); const host=page.locator('#viewer'); await page.locator('#open-images').click();
  const box=await host.getByRole('dialog').boundingBox(); expect(box.width).toBeLessThanOrEqual(390);
  expect(await host.evaluate(e=>{const dialog=e.shadowRoot.querySelector('dialog');e.remove();return dialog.open;})).toBe(false); await expect(page.locator('#outside')).toBeEnabled();
});

test('tree selection change participates in FormItem change validation and invalidates pending submission', async ({ page }) => {
  const item=page.locator('#managed-tree').locator('..');
  await item.evaluate(e=>{e.validateTrigger='change';e.rules=[{validator:value=>value.includes('ocean')?'Ocean is unavailable':''}];});
  const tree=page.locator('#managed-tree'); await tree.getByRole('combobox').focus(); await tree.getByRole('button',{name:'Expand Assets',exact:true}).click(); await tree.locator('[data-value="ocean"]').click();
  await expect(item.getByRole('alert')).toHaveText('Ocean is unavailable');
  await item.evaluate(e=>{e.validateTrigger='submit';e.rules=[{validator:(_value,signal)=>new Promise(resolve=>{window.finishTreeValidation=()=>resolve(signal.aborted?'':'Stale error');})}];});
  await page.locator('#form').evaluate(e=>{window.formSubmits=0;e.addEventListener('form-submit',()=>window.formSubmits++);void e.submit();});
  await tree.getByRole('button',{name:'Remove Ocean scene'}).click(); await page.evaluate(()=>window.finishTreeValidation());
  expect(await page.evaluate(()=>window.formSubmits)).toBe(0);
  await expect(item.getByRole('alert')).toBeHidden();
});

test('image responds to srcset-only sources and ignores delayed old resources', async ({ page }) => {
  let oldRoute; await page.route('**/delayed.png',route=>{oldRoute=route;}); const image=page.locator('#image');
  await image.evaluate(e=>{e.src='/delayed.png';}); await expect.poll(()=>Boolean(oldRoute)).toBe(true);
  await image.evaluate(e=>{e.src=window.secondArtwork;}); await expect(image).toHaveJSProperty('status','loaded'); await oldRoute.abort();
  await expect(image).toHaveJSProperty('status','loaded');
  await image.evaluate(e=>{e.src='';e.setAttribute('srcset',window.artwork+' 1x');}); await expect(image).toHaveJSProperty('status','loaded');
  await image.getByRole('button',{name:'Preview Ocean artwork'}).click(); await expect(image.getByRole('dialog')).toBeVisible();
});

test('image error listeners can replace the source without stale fallback overwriting it', async ({ page }) => {
  await page.route('**/replace-me.png',route=>route.fulfill({status:404,body:''}));
  const image=page.locator('#image'); await image.evaluate(e=>{e.addEventListener('image-error',()=>{e.src=window.secondArtwork;},{once:true});e.src='/replace-me.png';});
  await expect(image).toHaveJSProperty('status','loaded'); expect(await image.locator('[part="image"]').evaluate(e=>e.currentSrc)).toBe(await page.evaluate(()=>window.secondArtwork));
});

test('gallery demonstrates medium priority controls with matching navigation order', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/examples/#auto-complete');
  const auto=page.locator('#auto-complete-live');await auto.getByRole('combobox').fill('oce');await auto.getByRole('option').click();await expect(page.locator('#auto-complete-event')).toContainText('option-select');
  await page.locator('#menu-mode').selectOption('horizontal');await page.locator('#menu-live').getByRole('menuitem',{name:'资源',exact:true}).click();await page.locator('#menu-live').getByRole('menuitem',{name:'场景',exact:true}).click();await expect(page.locator('#menu-event')).toContainText('scenes');
  await page.locator('#pagination-live').getByRole('button',{name:'Next page'}).click();await expect(page.locator('#pagination-range')).toContainText('11–20');
  await page.locator('#tree-select-live input').focus();await page.locator('#tree-select-live [data-value="ocean"]').click();await expect(page.locator('#tree-select-event')).toContainText('ocean');
  await page.locator('#image-break').click();await expect(page.locator('#image-live')).toHaveJSProperty('status','loaded');
  await page.locator('#image-preview-open').click();await expect(page.locator('#image-preview-live').getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  const ids=await page.locator('#component-nav a').evaluateAll(links=>links.map(link=>link.hash.slice(1)));expect(await page.locator('.component-section').evaluateAll(sections=>sections.map(section=>section.id))).toEqual(ids);expect(errors).toEqual([]);
});
