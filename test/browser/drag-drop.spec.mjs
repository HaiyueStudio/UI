import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/drag-drop.html');
  await page.waitForFunction(() => window.ready);
});

async function drag(page, source, target, bottom = false, before = false) {
  const from = await source.boundingBox(); const to = await target.boundingBox();
  await page.mouse.move(from.x + 10, from.y + 10); await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 10);
  await page.mouse.move(to.x + (before ? 2 : to.width / 2), to.y + (bottom ? to.height - 2 : to.height / 2), { steps: 6 });
  await page.mouse.up();
}
const order = (page, id = 'list') => page.locator('#' + id).evaluate(element => element.order);

test('focused entries register explicitly and clean constructors join root registration', async ({ page }) => {
  expect(await page.evaluate(() => window.explicit && window.constructorsClean)).toBe(true);
  expect(await page.evaluate(async () => {
    const root = await import('/dist/index.js'); root.defineHaiyueUI(); root.defineHaiyueUI();
    return document.querySelector('#list') instanceof root.HYSortable && document.querySelector('#source') instanceof root.HYDragSource && document.querySelector('#zone') instanceof root.HYDropzone;
  })).toBe(true);
});

test('pointer sorting commits once and preserves the actual content nodes', async ({ page }) => {
  await page.locator('#field').fill('Edited');
  await page.evaluate(() => { window.originalField = document.querySelector('#field'); });
  await drag(page, page.locator('#a .grab'), page.locator('#c'), true);
  expect(await order(page)).toEqual(['b', 'c', 'a']);
  await expect(page.locator('#field')).toHaveValue('Edited');
  expect(await page.evaluate(() => window.originalField === document.querySelector('#field'))).toBe(true);
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'sort-change').map(({ oldIndex, newIndex, toOrder }) => ({ oldIndex, newIndex, toOrder })))).toEqual([{ oldIndex: 0, newIndex: 2, toOrder: ['b', 'c', 'a'] }]);
  await expect(page.locator('#a')).not.toHaveAttribute('data-hy-sort-active');
});

test('same-group lists transfer into empty lists and reject other groups', async ({ page }) => {
  await drag(page, page.locator('#a .grab'), page.locator('#ready'));
  expect(await order(page)).toEqual(['b', 'c']);
  expect(await order(page, 'ready')).toEqual(['a']);
  await drag(page, page.locator('#ready #a .grab'), page.locator('#other'));
  expect(await order(page, 'ready')).toEqual(['a']);
  expect(await order(page, 'other')).toEqual(['x']);
});

test('keyboard sorting previews, cancels and commits without stealing editing keys', async ({ page }) => {
  const item = page.locator('#a');
  await expect(item).toHaveAccessibleDescription(/Press Space to pick up/u);
  await item.focus(); await item.press('Space'); await item.press('ArrowDown');
  expect(await order(page)).toEqual(['a', 'b', 'c']);
  await item.press('Escape'); expect(await order(page)).toEqual(['a', 'b', 'c']);
  await item.press('Space'); await item.press('End'); await item.press('Enter');
  expect(await order(page)).toEqual(['b', 'c', 'a']); await expect(item).toBeFocused();
  await page.locator('#field').focus(); await page.locator('#field').press('Home'); await page.locator('#field').press('Space');
  await expect(item).not.toHaveAttribute('data-hy-sort-active');
});

test('keyboard transfer reaches an empty list and horizontal RTL reverses arrows', async ({ page }) => {
  const list = page.locator('#list'); const item = page.locator('#a');
  await list.evaluate(element => { element.direction = 'horizontal'; element.dir = 'rtl'; });
  await item.focus(); await item.press('Space'); await item.press('ArrowLeft'); await item.press('Enter');
  expect(await order(page)).toEqual(['b', 'a', 'c']);
  await item.press('Space');
  await page.locator('#ready').getByRole('list', { name: 'Ready' }).focus(); await page.keyboard.press('Enter');
  expect(await order(page, 'ready')).toEqual(['a']);
});

test('API reorders preserve focused editors and cancelable changes leave order intact', async ({ page }) => {
  const field = page.locator('#field'); await field.fill('Keep'); await field.focus();
  expect(await page.locator('#list').evaluate(element => element.move(0, 2))).toBe(true);
  await expect(field).toBeFocused(); await expect(field).toHaveValue('Keep');
  await page.locator('#list').evaluate(element => element.addEventListener('sort-before-change', event => event.preventDefault(), { once: true }));
  expect(await page.locator('#list').evaluate(element => element.move(0, 1))).toBe(false);
  expect(await order(page)).toEqual(['b', 'c', 'a']);
});

test('activation threshold, handles, disabled state and cancelled starts protect content', async ({ page }) => {
  const item = page.locator('#a .grab'); const box = await item.boundingBox();
  await page.mouse.move(box.x + 5, box.y + 5); await page.mouse.down(); await page.mouse.move(box.x + 7, box.y + 7); await page.mouse.up();
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'sort-start'))).toHaveLength(0);
  await page.locator('#list').evaluate(element => { element.handle = '.grab'; element.disabled = true; });
  await expect(page.locator('#a')).toHaveAttribute('tabindex', '-1');
  await page.locator('#list').evaluate(element => { element.disabled = false; });
  await expect(page.locator('#a')).toHaveAttribute('tabindex', '0');
  await page.locator('#list').evaluate(element => element.addEventListener('sort-start', event => event.preventDefault(), { once: true }));
  await drag(page, item, page.locator('#c'), true); expect(await order(page)).toEqual(['a', 'b', 'c']);
  await drag(page, page.locator('#b button'), page.locator('#c'), true); expect(await order(page)).toEqual(['a', 'b', 'c']);
});

test('change handlers may update or detach lists without committing stale positions', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.locator('#list').evaluate(element => element.addEventListener('sort-before-change', () => element.querySelector('#c').remove(), { once: true }));
  expect(await page.locator('#list').evaluate(element => element.move(0, 1))).toBe(false);
  expect(await order(page)).toEqual(['a', 'b']);
  await page.evaluate(() => {
    const list = document.querySelector('#list'); window.detachedList = list;
    list.addEventListener('sort-end', event => { window.detachedSortEnd = event.detail; }, { once: true });
    document.querySelector('#ready').addEventListener('sort-before-change', () => list.remove(), { once: true });
  });
  await drag(page, page.locator('#a .grab'), page.locator('#ready'));
  expect(await order(page, 'ready')).toEqual([]);
  expect(await page.evaluate(() => window.detachedList.order)).toEqual(['a', 'b']);
  expect(await page.evaluate(() => window.detachedSortEnd.accepted)).toBe(false);
  expect(errors).toEqual([]);
});

test('data sources deliver original data once to the innermost accepting zone', async ({ page }) => {
  await drag(page, page.locator('#source'), page.locator('#inner'));
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'data-drop').map(({ target, data, input }) => ({ target, data, input })))).toEqual([{ target: 'inner', data: { id: 'ocean', name: 'Ocean asset' }, input: 'pointer' }]);
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'drag-end').map(event => event.accepted))).toEqual([true]);
  await page.locator('#zone').evaluate(element => { element.accept = 'different'; });
  await drag(page, page.locator('#source'), page.locator('#zone'));
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'data-drop'))).toHaveLength(1);
});

test('keyboard data drops, rejection and Escape release the drag session', async ({ page }) => {
  const source = page.locator('#source'); const zone = page.locator('#zone');
  await source.evaluate(element => element.focus()); await page.keyboard.press('Space');
  await zone.evaluate(element => element.focus()); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'data-drop').map(event => event.input))).toEqual(['keyboard']);
  await zone.evaluate(element => element.addEventListener('data-drop', event => event.preventDefault(), { once: true }));
  await drag(page, source, zone);
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'drag-end').at(-1).accepted)).toBe(false);
  await source.evaluate(element => element.focus()); await page.keyboard.press('Space'); await page.keyboard.press('Escape');
  await expect(source).not.toHaveAttribute('dragging'); await expect(source.locator('[part="surface"]')).toBeFocused();
});

test('native nested drops receive files once and upload emits one committed change', async ({ page }) => {
  await page.locator('#inner').evaluate(element => {
    const transfer = new DataTransfer(); transfer.items.add(new File(['text'], 'nested.txt', { type: 'text/plain' }));
    element.shadowRoot.querySelector('[part="surface"]').dispatchEvent(new DragEvent('drop', { bubbles: true, composed: true, cancelable: true, dataTransfer: transfer }));
  });
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'data-drop').map(({ target, files }) => ({ target, files })))).toEqual([{ target: 'inner', files: ['nested.txt'] }]);
  await page.locator('#upload').evaluate(element => {
    const transfer = new DataTransfer(); transfer.items.add(new File(['text'], 'upload.txt', { type: 'text/plain' }));
    const zone = element.shadowRoot.querySelector('[part="dropzone"]');
    for (const type of ['dragenter', 'dragenter', 'dragleave']) zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
    if (!zone.classList.contains('dragover')) throw new Error('Nested hover was cleared too early');
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(page.locator('#upload [part="file-name"]')).toHaveText('upload.txt');
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'change' && event.target === 'upload'))).toHaveLength(1);
  await expect(page.locator('#upload [part="dropzone"]')).not.toHaveClass(/dragover/u);
});

test('disabled and disconnected components cancel gestures and restore authored item attributes', async ({ page }) => {
  const a = await page.locator('#a .grab').boundingBox();
  await page.mouse.move(a.x + 8, a.y + 8); await page.mouse.down(); await page.mouse.move(a.x + 28, a.y + 8);
  await page.locator('#list').evaluate(element => { element.disabled = true; }); await page.mouse.up();
  await expect(page.locator('#a')).not.toHaveAttribute('data-hy-sort-active');
  await page.locator('#list').evaluate(element => { element.disabled = false; const parent = element.parentElement; window.detached = element; element.remove(); parent.append(element); });
  await expect(page.locator('#a')).toHaveAttribute('tabindex', '0');
  await page.locator('#list').evaluate(element => element.remove());
  expect(await page.evaluate(() => window.detached.querySelector('#a').getAttribute('tabindex'))).toBeNull();
  await page.locator('#source').evaluate(element => element.focus()); await page.keyboard.press('Space');
  await expect(page.locator('#source')).toHaveAttribute('dragging');
  await page.locator('#source').evaluate(element => {
    element.addEventListener('drag-end', event => { window.disconnectedEnd = event.detail; }, { once: true });
    element.remove();
  });
  await expect(page.locator('#zone')).not.toHaveAttribute('dragover');
  expect(await page.evaluate(() => window.disconnectedEnd.cancelled)).toBe(true);
});

test('grid sorting supports pointer positions and row-sized keyboard steps', async ({ page }) => {
  await page.locator('#list').evaluate(element => {
    element.direction = 'grid'; element.columns = 2; element.style.width = '440px';
    const extra = document.createElement('article'); extra.dataset.id = 'd'; extra.textContent = 'Task D'; element.append(extra);
  });
  const a = page.locator('#a');
  await a.focus(); await a.press('Space'); await a.press('ArrowDown'); await a.press('Enter');
  expect(await order(page)).toEqual(['b', 'c', 'a', 'd']);
  await drag(page, page.locator('#list article').last(), page.locator('#b'), false, true);
  expect(await order(page)).toEqual(['d', 'b', 'c', 'a']);
});

test('touch sorting and data dragging commit, and touch cancellation cleans up', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x == null ? [] : [{ x, y, id: 1 }] });
  const a = await page.locator('#a .grab').boundingBox(); const c = await page.locator('#c').boundingBox();
  await touch('touchStart', a.x + 8, a.y + 8); await touch('touchMove', a.x + 28, a.y + 8);
  await touch('touchMove', c.x + 30, c.y + c.height - 2); await touch('touchEnd');
  expect(await order(page)).toEqual(['b', 'c', 'a']);
  const source = await page.locator('#source').boundingBox(); const zone = await page.locator('#zone').boundingBox();
  await touch('touchStart', source.x + 8, source.y + 8); await touch('touchMove', source.x + 28, source.y + 8);
  await touch('touchMove', zone.x + 60, zone.y + 40); await touch('touchEnd');
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'data-drop').map(event => event.target))).toEqual(['zone']);
  await touch('touchStart', source.x + 8, source.y + 8); await touch('touchMove', source.x + 28, source.y + 8);
  await touch('touchCancel'); await expect(page.locator('#source')).not.toHaveAttribute('dragging');
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'drag-end').at(-1).cancelled)).toBe(true);
  await cdp.detach();
});

test('shadow-root drop zones are hit-tested through composed boundaries', async ({ page }) => {
  await page.evaluate(() => {
    const host = document.createElement('div'); host.id = 'shadow-host';
    host.attachShadow({ mode: 'open' }).innerHTML = '<hy-dropzone id="shadow-zone" accept="asset" aria-label="Shadow destination">Shadow destination</hy-dropzone>';
    document.querySelector('#zone').after(host);
  });
  await drag(page, page.locator('#source'), page.locator('#shadow-zone'));
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'drag-end').at(-1).accepted)).toBe(true);
  await expect(page.locator('#shadow-zone')).not.toHaveAttribute('dragover');
});

test('edge scrolling advances an overflowing list while the pointer stays at its edge', async ({ page }) => {
  await page.locator('#scroll').scrollIntoViewIfNeeded();
  const item = page.locator('#scroll-list article').first(); await item.scrollIntoViewIfNeeded();
  const start = await item.boundingBox(); const bounds = await page.locator('#scroll').boundingBox();
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
  await page.mouse.move(start.x + 15, start.y + 15); await page.mouse.down();
  await page.mouse.move(bounds.x + 50, bounds.y + bounds.height - 4, { steps: 4 });
  await expect.poll(() => page.locator('#scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(24);
  await page.keyboard.press('Escape'); await page.mouse.up();
});

test('gallery demonstrates data drops, file drops and sortable controls at desktop and mobile widths', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`/examples/?drag-drop-width=${width}#drag-source`);
    const source = page.locator('#drag-source hy-drag-source').first();
    await source.evaluate(element => element.focus()); await page.keyboard.press('Space');
    await page.locator('#drag-source-target').evaluate(element => element.focus()); await page.keyboard.press('Enter');
    await expect(page.locator('#drag-source-result')).toContainText('已接收 海面材质');
    await page.locator('#drag-source').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.artifacts/drag-source-gallery-${width}.png` });
    await page.locator('#dropzone-live').evaluate(element => {
      const dataTransfer = new DataTransfer(); dataTransfer.items.add(new File(['demo'], 'example.txt', { type: 'text/plain' }));
      element.shadowRoot.querySelector('[part="surface"]').dispatchEvent(new DragEvent('drop', { bubbles: true, composed: true, cancelable: true, dataTransfer }));
    });
    await expect(page.locator('#dropzone-result')).toHaveText('example.txt');
    await page.locator('#sortable-api').click();
    expect(await page.locator('#sortable-backlog').evaluate(element => element.order)).toEqual(['moon', 'mountain', 'ocean']);
    await page.locator('#sortable-direction').selectOption('grid');
    await expect(page.locator('#sortable-ready')).toHaveAttribute('direction', 'grid');
    const section = page.locator('#sortable'); await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.artifacts/drag-drop-gallery-${width}.png` });
    const dimensions = await page.locator('#content').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
  }
  expect(errors).toEqual([]);
});
