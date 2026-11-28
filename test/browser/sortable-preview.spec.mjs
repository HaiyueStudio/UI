import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/drag-drop.html'); await page.waitForFunction(() => window.ready);
});

const order = (page, id = 'list') => page.locator('#' + id).evaluate(element => element.order);
async function configure(page, values = { preview: 'move', animation: 350, sourceOpacity: .3 }) {
  await page.locator('#list').evaluate((element, settings) => Object.assign(element, settings), values);
}
async function start(page) {
  const bounds = await page.locator('#a .grab').boundingBox();
  await page.mouse.move(bounds.x + 8, bounds.y + 8); await page.mouse.down(); await page.mouse.move(bounds.x + 28, bounds.y + 8);
  await expect(page.locator('#a')).toHaveAttribute('data-hy-sort-active');
}
async function endPosition(page) {
  const bounds = await page.locator('#c').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height - 2);
}
async function cancel(page) { await page.keyboard.press('Escape'); await page.mouse.up(); }
async function expectClean(page) {
  await expect(page.locator('[data-hy-drag-placeholder], [data-hy-sort-placeholder], [data-hy-drag-preview]')).toHaveCount(0);
  await expect(page.locator('#a')).not.toHaveAttribute('popover'); await expect(page.locator('#a')).not.toHaveAttribute('data-hy-sort-active');
}

test('sortable preview configuration is opt-in, finite and bounded', async ({ page }) => {
  const list = page.locator('#list');
  expect(await list.evaluate(element => [element.preview, element.animation, element.previewOpacity, element.sourceOpacity])).toEqual(['text', 0, 1, .45]);
  await configure(page, { preview: 'clone', animation: 20000, previewOpacity: 2, sourceOpacity: -1 });
  expect(await list.evaluate(element => [element.preview, element.animation, element.previewOpacity, element.sourceOpacity])).toEqual(['clone', 10000, 1, 0]);
  await list.evaluate(element => { for (const name of ['animation', 'preview-opacity', 'source-opacity']) element.setAttribute(name, 'NaN'); element.setAttribute('preview', 'unknown'); });
  expect(await list.evaluate(element => [element.preview, element.animation, element.previewOpacity, element.sourceOpacity])).toEqual(['text', 0, 1, .45]);
});

test('move lifts the original item and animates siblings toward a faded placeholder before one final commit', async ({ page }) => {
  await configure(page, { preview: 'move', animation: 800, sourceOpacity: .3 });
  const original = await page.locator('#a').boundingBox();
  const b = await page.locator('#b').boundingBox();
  await page.locator('#field').fill('Remembered');
  await page.evaluate(() => {
    window.actualItem = document.querySelector('#a'); window.actualField = document.querySelector('#field'); window.sawMovement = false;
    const observe = () => {
      if (document.querySelector('#b').getAnimations().some(animation => animation.playState === 'running')) window.sawMovement = true;
      else requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  });
  await start(page);
  const placeholder = page.locator('#list > [data-hy-drag-placeholder]');
  await expect(placeholder).toHaveCSS('opacity', '0.3'); await expect(placeholder).toHaveAttribute('inert');
  const gap = await placeholder.boundingBox(); expect(Math.abs(gap.y - original.y)).toBeLessThan(2);
  await endPosition(page);
  await expect(placeholder).toHaveCSS('order', '2');
  await expect.poll(() => page.evaluate(() => window.sawMovement)).toBe(true);
  expect(await order(page)).toEqual(['a', 'b', 'c']);
  expect(await page.locator('#list').evaluate(element => element.items.length)).toBe(3);
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'sort-change').length)).toBe(0);
  await expect.poll(async () => (await page.locator('#b').boundingBox()).y).toBeLessThan(b.y - 20);
  await page.mouse.up(); await expectClean(page);
  expect(await order(page)).toEqual(['b', 'c', 'a']); await expect(page.locator('#field')).toHaveValue('Remembered');
  expect(await page.evaluate(() => window.actualItem === document.querySelector('#a') && window.actualField === document.querySelector('#field'))).toBe(true);
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'sort-change').map(event => [event.oldIndex, event.newIndex]))).toEqual([[0, 2]]);
});

test('Escape restores original order, styles, component instances and form values', async ({ page }) => {
  await configure(page);
  await page.evaluate(() => {
    window.connections = 0; window.disconnections = 0;
    customElements.define('hy-sort-probe', class extends HTMLElement {
      connectedCallback() { window.connections++; }
      disconnectedCallback() { window.disconnections++; }
    });
    document.querySelector('#a').append(document.createElement('hy-sort-probe'));
    const form = document.createElement('form'); document.querySelector('#list').before(form); form.append(document.querySelector('#list'));
    document.querySelector('#field').name = 'task'; window.beforeStyle = document.querySelector('#a').getAttribute('style');
  });
  await start(page); await endPosition(page);
  expect(await page.locator('form').evaluate(element => [...new FormData(element).entries()])).toEqual([['task', 'Original']]);
  expect(await page.evaluate(() => [window.connections, window.disconnections])).toEqual([2, 1]);
  await cancel(page); await expectClean(page);
  expect(await order(page)).toEqual(['a', 'b', 'c']);
  expect(await page.locator('#a').getAttribute('style')).toBe(await page.evaluate(() => window.beforeStyle));
  expect(await page.locator('#list').evaluate(element => element.items.every(item => !item.style.order))).toBe(true);
  expect(await page.evaluate(() => [window.connections, window.disconnections])).toEqual([2, 1]);
  await expect(page.locator('#a')).toBeFocused();
});

test('grouped lists animate an incoming placeholder and commit the real item only on drop', async ({ page }) => {
  await configure(page); await page.locator('#ready').evaluate(element => { element.animation = 350; });
  await start(page); const target = await page.locator('#ready').boundingBox();
  await page.mouse.move(target.x + 40, target.y + 40);
  await expect(page.locator('#ready > [data-hy-sort-placeholder]')).toBeVisible();
  expect(await order(page)).toEqual(['a', 'b', 'c']); expect(await order(page, 'ready')).toEqual([]);
  await page.mouse.move(900, 200); await expect(page.locator('#ready > [data-hy-sort-placeholder]')).toHaveCount(0);
  await page.mouse.move(target.x + 40, target.y + 40); await page.mouse.up(); await expectClean(page);
  expect(await order(page)).toEqual(['b', 'c']); expect(await order(page, 'ready')).toEqual(['a']);
  await expect(page.locator('#ready #a')).toBeFocused();
});

test('a vetoed drop restores both lists without change events or temporary orders', async ({ page }) => {
  await configure(page); await page.locator('#ready').evaluate(element => { element.animation = 250; element.addEventListener('sort-before-change', event => event.preventDefault()); });
  await start(page); const target = await page.locator('#ready').boundingBox(); await page.mouse.move(target.x + 40, target.y + 40);
  await page.mouse.up(); await expectClean(page);
  expect(await order(page)).toEqual(['a', 'b', 'c']); expect(await order(page, 'ready')).toEqual([]);
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'sort-change').length)).toBe(0);
  expect(await page.locator('#list').evaluate(element => element.items.every(item => !item.style.order))).toBe(true);
});

test('preview settings, disabling and removing a list cancel and clean up visual sorting', async ({ page }) => {
  await configure(page); await start(page); await endPosition(page);
  await page.locator('#list').evaluate(element => { element.animation = 100; }); await page.mouse.up(); await expectClean(page);
  expect(await order(page)).toEqual(['a', 'b', 'c']);
  await start(page); await endPosition(page); await page.locator('#list').evaluate(element => { element.disabled = true; }); await page.mouse.up(); await expectClean(page);
  await page.locator('#list').evaluate(element => { element.disabled = false; });
  await start(page); await endPosition(page);
  await page.locator('#list').evaluate(element => { window.removedList = element; element.remove(); }); await page.mouse.up();
  expect(await page.evaluate(() => [window.removedList.order, window.removedList.querySelector('[popover], [data-hy-drag-placeholder], [data-hy-sort-active]'), [...window.removedList.children].some(item => item.style.order)])).toEqual([['a', 'b', 'c'], null, false]);
});

test('horizontal RTL and grid previews retain keyboard focus and animate accepted changes', async ({ page }) => {
  await configure(page, { preview: 'move', animation: 500, direction: 'horizontal' });
  await page.locator('#list').evaluate(element => { element.dir = 'rtl'; element.style.width = '600px'; });
  const item = page.locator('#a'); await item.focus(); await item.press('Space'); await item.press('ArrowLeft');
  expect(await order(page)).toEqual(['a', 'b', 'c']); await expect(item).toHaveCSS('order', '1');
  await expect(page.locator('[data-hy-drag-preview], [data-hy-drag-placeholder]')).toHaveCount(0);
  await item.press('Enter'); expect(await order(page)).toEqual(['b', 'a', 'c']); await expect(item).toBeFocused();
  await page.locator('#list').evaluate(element => { element.direction = 'grid'; element.columns = 2; element.dir = 'ltr'; });
  await item.press('Space'); await item.press('End'); await item.press('Enter');
  expect(await order(page)).toEqual(['b', 'c', 'a']); await expect(item).toBeFocused();
});

test('API animations preserve authored transforms, orders and focused editors', async ({ page }) => {
  await configure(page, { animation: 500 });
  await page.locator('#a').evaluate(element => { element.style.transform = 'rotate(1deg)'; element.style.order = '0'; window.originalAStyle = element.getAttribute('style'); });
  await page.locator('#field').fill('Keep'); await page.locator('#field').focus();
  expect(await page.locator('#list').evaluate(element => { const moved = element.move(0, 2); return [moved, element.querySelector('#a').getAnimations().length > 0]; })).toEqual([true, true]);
  await expect(page.locator('#field')).toBeFocused(); await expect(page.locator('#field')).toHaveValue('Keep');
  expect(await page.locator('#a').evaluate(element => [element.style.transform, element.style.order])).toEqual(['rotate(1deg)', '0']);
  await page.locator('#list').evaluate(element => { element.preview = 'move'; }); await start(page); await endPosition(page); await cancel(page);
  expect(await page.locator('#a').getAttribute('style')).toBe(await page.evaluate(() => window.originalAStyle));
});

test('clone and legacy text previews can animate, and zero duration keeps indicator-only behavior', async ({ page }) => {
  for (const preview of ['clone', 'text']) {
    await configure(page, { preview, animation: 300, sourceOpacity: .2 }); await start(page); await endPosition(page);
    await expect(page.locator(`[data-hy-drag-preview="${preview}"]`)).toBeVisible(); await expect(page.locator('#a')).toHaveCSS('order', '2');
    await expect(page.locator('#a')).toHaveCSS('opacity', '0.2'); await cancel(page); await expectClean(page);
  }
  await configure(page, { preview: 'move', animation: 0 }); await start(page); await endPosition(page);
  expect(await page.locator('#list').evaluate(element => element.items.every(item => !item.style.order))).toBe(true);
  await expect(page.locator('#list [part="indicator"]')).toBeVisible(); await cancel(page);
});

test('reduced motion retains previewed order and disables movement animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await configure(page); await start(page); await endPosition(page);
  await expect(page.locator('#list > [data-hy-drag-placeholder]')).toHaveCSS('order', '2');
  expect(await page.locator('#b').evaluate(element => element.getAnimations().length)).toBe(0);
  await page.mouse.up(); expect(await order(page)).toEqual(['b', 'c', 'a']);
  expect(await page.locator('#list').evaluate(element => element.items.flatMap(item => item.getAnimations()).length)).toBe(0);
});

test('pointer sorting previews horizontal RTL and grid positions without animation hit-test jitter', async ({ page }) => {
  for (const direction of ['horizontal', 'grid']) {
    await page.reload(); await page.waitForFunction(() => window.ready);
    await configure(page, { preview: 'move', animation: 180, direction, columns: 2 });
    await page.locator('#list').evaluate((element, mode) => { element.style.width = '520px'; element.dir = mode === 'horizontal' ? 'rtl' : 'ltr'; }, direction);
    await start(page);
    const first = await page.locator('#b').boundingBox(); const last = await page.locator('#c').boundingBox();
    const points = direction === 'horizontal' ? [{ x: last.x + 2, y: last.y + 20 }, { x: first.x + first.width - 2, y: first.y + 20 }, { x: last.x + 2, y: last.y + 20 }] : [{ x: last.x + last.width - 2, y: last.y + last.height - 2 }, { x: first.x + 2, y: first.y + 2 }, { x: last.x + last.width - 2, y: last.y + last.height - 2 }];
    for (const point of points) await page.mouse.move(point.x, point.y);
    await expect.poll(() => page.locator('#b').evaluate(element => element.getAnimations().length)).toBe(0);
    await page.mouse.move(points[2].x, points[2].y); await page.mouse.up();
    expect(await order(page)).toEqual(['b', 'c', 'a']); await expectClean(page);
  }
});

test('source theme tokens apply to the real preview and app style updates survive cleanup', async ({ page }) => {
  await configure(page, { preview: 'move', animation: 200 });
  await page.locator('#list').evaluate(element => { element.style.setProperty('--hy-sortable-preview-opacity', '.7'); element.style.setProperty('--hy-sortable-source-opacity', '.25'); });
  await start(page); await expect(page.locator('#a')).toHaveCSS('opacity', '0.7');
  await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCSS('opacity', '0.25'); await endPosition(page);
  await page.locator('#b').evaluate(element => { element.style.order = '9'; element.style.color = 'rgb(12, 34, 56)'; });
  await cancel(page); expect(await page.locator('#b').evaluate(element => element.style.order)).toBe('9');
  await expect(page.locator('#b')).toHaveCSS('color', 'rgb(12, 34, 56)');
});

test('edge scrolling with a moving real item retains order until cancellation', async ({ page }) => {
  await page.locator('#scroll-list').evaluate(element => { element.preview = 'move'; element.animation = 200; });
  await page.locator('#scroll').scrollIntoViewIfNeeded();
  const first = page.locator('#scroll-list article').first(); await first.scrollIntoViewIfNeeded();
  const a = await first.boundingBox(); const stage = await page.locator('#scroll').boundingBox();
  await page.mouse.move(a.x + 8, a.y + 8); await page.mouse.down(); await page.mouse.move(a.x + 28, a.y + 8);
  await page.mouse.move(stage.x + 80, stage.y + stage.height - 3);
  await expect.poll(() => page.locator('#scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(24);
  expect((await order(page, 'scroll-list'))[0]).toBe('scroll-0');
  await cancel(page); await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCount(0);
});

test('edge scrolling keeps scheduling when the scrolling surface reports offsets on the next frame', async ({ page }) => {
  await page.locator('#scroll').evaluate(element => {
    const scroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    Object.defineProperty(element, 'scrollTop', {
      get() { return scroll.get.call(this); },
      set(value) { requestAnimationFrame(() => scroll.set.call(this, value)); },
    });
  });
  await page.locator('#scroll-list').evaluate(element => { element.preview = 'move'; element.animation = 200; });
  await page.locator('#scroll').scrollIntoViewIfNeeded();
  const first = page.locator('#scroll-list article').first(); await first.scrollIntoViewIfNeeded();
  const a = await first.boundingBox(); const stage = await page.locator('#scroll').boundingBox();
  await page.mouse.move(a.x + 8, a.y + 8); await page.mouse.down(); await page.mouse.move(a.x + 28, a.y + 8);
  await page.mouse.move(stage.x + 80, stage.y + stage.height - 3);
  await expect.poll(() => page.locator('#scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(24);
  await cancel(page); await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCount(0);
});

test('horizontal RTL edge scrolling preserves negative scroll offsets', async ({ page }) => {
  await page.locator('#scroll-list').evaluate(element => {
    element.preview = 'move'; element.animation = 150; element.direction = 'horizontal'; element.dir = 'rtl'; element.style.width = '2552px';
    element.parentElement.dir = 'rtl';
    for (const item of element.items) item.style.flex = '0 0 120px';
  });
  await page.locator('#scroll').scrollIntoViewIfNeeded();
  const first = page.locator('#scroll-list article').first(); await first.scrollIntoViewIfNeeded();
  const a = await first.boundingBox(); const stage = await page.locator('#scroll').boundingBox();
  await page.mouse.move(a.x + 8, a.y + 8); await page.mouse.down(); await page.mouse.move(a.x + 28, a.y + 8);
  await page.mouse.move(stage.x + 3, stage.y + 30);
  await expect.poll(() => page.locator('#scroll').evaluate(element => element.scrollLeft)).toBeLessThan(-24);
  await cancel(page); await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCount(0);
});

test('touch sorting moves the actual item and cancellation removes its placeholder', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch input is Chromium-specific');
  await configure(page); const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x == null ? [] : [{ x, y, id: 1 }] });
  const a = await page.locator('#a .grab').boundingBox(); const c = await page.locator('#c').boundingBox();
  await touch('touchStart', a.x + 8, a.y + 8); await touch('touchMove', a.x + 28, a.y + 8);
  await expect(page.locator('#a')).toHaveAttribute('data-hy-live-drag');
  await touch('touchMove', c.x + 40, c.y + c.height - 2); await touch('touchEnd');
  expect(await order(page)).toEqual(['b', 'c', 'a']); await expectClean(page);
  const moved = await page.locator('#a .grab').boundingBox();
  await touch('touchStart', moved.x + 8, moved.y + 8); await touch('touchMove', moved.x + 28, moved.y + 8); await touch('touchCancel');
  await expectClean(page); expect(await order(page)).toEqual(['b', 'c', 'a']); await cdp.detach();
});

test('gallery exposes animation and all preview modes on desktop and mobile', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto(`/examples/?sortable-preview-width=${width}#sortable`);
    const list = page.locator('#sortable-backlog'); await expect(list).toHaveAttribute('animation', '250');
    await page.locator('#sortable-animation').fill('500'); await page.locator('#sortable-source-opacity').fill('0.3');
    for (const mode of ['move', 'clone', 'text']) {
      await page.locator('#sortable-preview').selectOption(mode); await list.scrollIntoViewIfNeeded();
      const first = list.locator('article').first(); const last = list.locator('article').last();
      const a = await first.boundingBox(); const c = await last.boundingBox();
      await page.mouse.move(a.x + 8, a.y + 8); await page.mouse.down(); await page.mouse.move(a.x + 28, a.y + 8);
      await page.mouse.move(c.x + 40, c.y + c.height - 2);
      await expect(page.locator(`[data-hy-drag-preview="${mode}"]`)).toBeVisible();
      await expect.poll(() => list.evaluate(element => element.items.filter(item => !item.hasAttribute('data-hy-live-drag')).flatMap(item => item.getAnimations()).length)).toBe(0);
      await page.screenshot({ path: `.artifacts/sortable-${mode}-${width}.png` }); await cancel(page);
    }
    expect(await list.evaluate(element => [element.animation, element.sourceOpacity, element.order])).toEqual([500, .3, ['ocean', 'moon', 'mountain']]);
    expect(await page.locator('#content').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  expect(errors).toEqual([]);
});
