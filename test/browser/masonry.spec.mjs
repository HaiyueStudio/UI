import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/masonry.html');
  await expect.poll(() => page.evaluate(() => window.layouts?.at(-1)?.itemCount)).toBe(5);
});

const geometry = page => page.locator('#masonry').evaluate(element => {
  const parent = element.getBoundingClientRect();
  return [...element.children].filter(child => !child.hidden).map(child => {
    const box = child.getBoundingClientRect();
    return { id: child.id, x: box.x - parent.x, y: box.y - parent.y, width: box.width, height: box.height };
  });
});

test('isolated explicit registration packs shortest columns, with correct event geometry and original focus order', async ({ page }) => {
  expect(await page.evaluate(() => window.wasRegisteredOnImport)).toBe(false);
  expect(await geometry(page)).toEqual([
    { id: 'a', x: 0, y: 0, width: 200, height: 100 },
    { id: 'b', x: 210, y: 0, width: 200, height: 200 },
    { id: 'c', x: 420, y: 0, width: 200, height: 80 },
    { id: 'd', x: 420, y: 90, width: 200, height: 120 },
    { id: 'e', x: 0, y: 110, width: 200, height: 60 },
  ]);
  await expect(page.locator('#masonry')).toHaveJSProperty('offsetHeight', 210);
  expect(await page.evaluate(() => window.layouts.at(-1))).toEqual({ columns: 3, itemCount: 5, height: 210 });
  for (const label of ['A', 'B', 'C', 'D', 'E']) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: label, exact: true })).toBeFocused();
  }
});

test('container resizing, fixed columns, RTL, zero gaps and hidden-to-visible layouts stay inside the container', async ({ page }) => {
  const masonry = page.locator('#masonry');
  await masonry.evaluate(element => { element.style.width = '340px'; });
  await expect.poll(() => page.evaluate(() => window.layouts.at(-1).columns)).toBe(1);
  await masonry.evaluate(element => { element.columns = 2; element.gap = 0; element.dir = 'rtl'; });
  await expect.poll(async () => (await geometry(page))[0].width).toBe(170);
  const boxes = await geometry(page);
  expect(boxes[0].x).toBe(170);
  expect(boxes[1].x).toBe(0);
  expect(boxes[2].y).toBe(100);
  await masonry.evaluate(element => { element.hidden = true; element.style.width = '100px'; element.columns = 4; element.gap = 150; });
  await masonry.evaluate(element => { element.hidden = false; });
  await expect.poll(() => page.evaluate(() => window.layouts.at(-1).columns)).toBe(1);
  expect((await geometry(page)).every(box => box.x === 0 && box.width === 100)).toBe(true);
});

test('item resize, visibility, additions, removals and empty state automatically update geometry', async ({ page }) => {
  await page.locator('#a').evaluate(item => { item.style.height = '160px'; });
  await expect.poll(async () => (await geometry(page)).find(box => box.id === 'e').y).toBe(170);
  await page.locator('#c').evaluate(item => { item.hidden = true; });
  await expect.poll(() => page.evaluate(() => window.layouts.at(-1).itemCount)).toBe(4);
  await page.locator('#masonry').evaluate(element => {
    const item = document.createElement('article'); item.id = 'f'; item.style.height = '50px'; element.append(item);
  });
  await expect.poll(() => page.evaluate(() => window.layouts.at(-1).itemCount)).toBe(5);
  await page.locator('#d').evaluate(item => { window.removedItem = item; item.remove(); });
  await expect.poll(() => page.evaluate(() => window.layouts.at(-1).itemCount)).toBe(4);
  expect(await page.evaluate(() => window.removedItem.style.getPropertyValue('--_hy-masonry-width'))).toBe('');
  await page.locator('#masonry').evaluate(element => element.replaceChildren());
  await expect.poll(() => page.evaluate(() => window.layouts.at(-1))).toEqual({ columns: 3, itemCount: 0, height: 0 });
  await expect(page.locator('#masonry')).toHaveJSProperty('offsetHeight', 0);
});

test('late image loading grows the column and moves the following card without overlap', async ({ page }) => {
  await page.locator('#masonry').evaluate(element => {
    element.columns = 1;
    const card = document.createElement('article'); card.id = 'image-card';
    const image = document.createElement('img'); image.id = 'image'; image.style.cssText = 'display:block;width:100%';
    card.append(image); element.prepend(card);
  });
  await expect.poll(() => page.evaluate(() => window.layouts.at(-1).itemCount)).toBe(6);
  await page.locator('#image').evaluate(image => { image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"></svg>'); });
  await expect.poll(async () => (await page.locator('#image').boundingBox()).height).toBeGreaterThan(190);
  await expect.poll(async () => {
    const boxes = await geometry(page);
    return boxes.find(box => box.id === 'a').y - boxes[0].height;
  }).toBeCloseTo(10, 1);
});

test('disconnect cancels pending layouts, restores authored styles and reconnects the same content', async ({ page }) => {
  const result = await page.locator('#masonry').evaluate(async element => {
    const item = element.firstElementChild;
    const created = document.createElement('hy-masonry');
    const constructorAttributes = created.attributes.length;
    const authored = document.createElement('article');
    authored.style.setProperty('--_hy-masonry-x', '5px', 'important');
    authored.style.height = '30px'; element.append(authored);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    element.refresh(); element.remove();
    const count = window.layouts.length;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const detachedCount = window.layouts.length;
    const restored = authored.style.getPropertyValue('--_hy-masonry-x');
    const priority = authored.style.getPropertyPriority('--_hy-masonry-x');
    const cleaned = item.style.getPropertyValue('--_hy-masonry-width');
    const originalHeight = item.style.height;
    document.body.prepend(element);
    window.reconnected = element;
    return { constructorAttributes, count, detachedCount, restored, priority, cleaned, originalHeight };
  });
  expect(result.constructorAttributes).toBe(0);
  expect(result.detachedCount).toBe(result.count);
  expect(result.restored).toBe('5px');
  expect(result.priority).toBe('important');
  expect(result.cleaned).toBe('');
  expect(result.originalHeight).toBe('100px');
  await expect.poll(() => page.evaluate(() => window.layouts.at(-1).itemCount)).toBe(6);
});

test('invalid numeric configuration is normalized and layout events settle after refresh', async ({ page }) => {
  const result = await page.locator('#masonry').evaluate(element => {
    element.columns = Number.NaN; element.minColumnWidth = Infinity; element.gap = -5;
    return { columns: element.columns, minColumnWidth: element.minColumnWidth, gap: element.gap };
  });
  expect(result).toEqual({ columns: 0, minColumnWidth: 240, gap: 0 });
  await expect.poll(() => page.evaluate(() => window.layouts.at(-1).columns)).toBe(2);
  const count = await page.evaluate(() => window.layouts.length);
  await page.locator('#masonry').evaluate(async element => {
    for (let i = 0; i < 10; i++) element.refresh();
    for (let i = 0; i < 4; i++) await new Promise(resolve => requestAnimationFrame(resolve));
  });
  expect(await page.evaluate(() => window.layouts.length)).toBe(count);
});

test('gallery exposes adjustable Masonry in alphabetical category order and adds/removes cards', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/#masonry');
  const masonry = page.locator('#masonry-live');
  await expect(masonry.locator('article')).toHaveCount(6);
  await page.locator('#masonry-columns').selectOption('3');
  await expect(masonry).toHaveJSProperty('columns', 3);
  await page.locator('#masonry-add').click();
  await expect(masonry.locator('article')).toHaveCount(7);
  await expect(page.locator('#masonry-event')).toContainText('"itemCount":7');
  await page.locator('#masonry-remove').click();
  await expect(masonry.locator('article')).toHaveCount(6);
  const ids = await page.locator('#component-nav a').evaluateAll(links => links.map(link => link.hash.slice(1)));
  expect(ids.slice(ids.indexOf('expandable'), ids.indexOf('resizable') + 1)).toEqual(['expandable', 'masonry', 'resizable']);
  expect(await page.locator('.component-section').evaluateAll(sections => sections.map(section => section.id))).toEqual(ids);
  expect(errors).toEqual([]);
});
