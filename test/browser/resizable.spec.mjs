import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/resizable.html'); });

test('renders eight handles and resizes from the south-east corner on the grid', async ({ page }) => {
  const resizable = page.locator('#resizable');
  await expect(resizable.locator('[data-resize-handle]')).toHaveCount(8);
  const handle = resizable.locator('[data-resize-handle="se"]');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 63, box.y + box.height / 2 + 47, { steps: 4 });
  await page.mouse.up();
  await expect(resizable).toHaveAttribute('width', '260');
  await expect(resizable).toHaveAttribute('height', '170');
  await expect(page.locator('#events')).toContainText('resize-start');
  await expect(page.locator('#events')).toContainText('resize-end');
});

test('north-west resizing changes position and respects minimum dimensions', async ({ page }) => {
  const resizable = page.locator('#resizable');
  const handle = resizable.locator('[data-resize-handle="nw"]');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 100);
  await page.mouse.up();
  await expect(resizable).toHaveAttribute('width', '80');
  await expect(resizable).toHaveAttribute('height', '60');
  await expect(resizable).toHaveAttribute('x', '160');
  await expect(resizable).toHaveAttribute('y', '90');
});

test('moving and API resizing stay inside parent bounds', async ({ page }) => {
  const resizable = page.locator('#resizable');
  const content = resizable.locator('[part="content"]');
  const box = await content.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 330, box.y + 220);
  await page.mouse.up();
  const moved = await resizable.evaluate(element => element.rect);
  expect(moved.x).toBeGreaterThan(200);
  expect(moved.y).toBeGreaterThan(100);

  const resized = await resizable.evaluate(element => element.resizeTo(999, 999));
  expect(resized.width).toBeLessThanOrEqual(520);
  expect(resized.height).toBeLessThanOrEqual(340);
  const rects = await page.evaluate(() => ({ stage: document.querySelector('#stage').getBoundingClientRect().toJSON(), item: document.querySelector('#resizable').getBoundingClientRect().toJSON() }));
  expect(rects.item.right).toBeLessThanOrEqual(rects.stage.right - 1);
  expect(rects.item.bottom).toBeLessThanOrEqual(rects.stage.bottom - 1);
});

test('keyboard resizes the focused edge and API reset restores the initial rectangle', async ({ page }) => {
  const resizable = page.locator('#resizable');
  const east = resizable.locator('[data-resize-handle="e"]');
  await east.focus();
  await page.keyboard.press('ArrowRight');
  await expect(resizable).toHaveAttribute('width', '210');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(resizable).toHaveAttribute('width', '310');
  await resizable.evaluate(element => element.reset());
  await expect(resizable).toHaveAttribute('x', '40');
  await expect(resizable).toHaveAttribute('y', '30');
  await expect(resizable).toHaveAttribute('width', '200');
  await expect(resizable).toHaveAttribute('height', '120');
});

test('component gallery demonstrates resize API, ratio, and reset controls', async ({ page }) => {
  await page.goto('/examples/#resizable');
  const resizable = page.locator('#resizable-live');
  await expect(resizable.locator('[data-resize-handle]')).toHaveCount(8);
  await page.locator('#resizable-grow').click();
  await expect(resizable).toHaveAttribute('width', '304');
  await expect(resizable).toHaveAttribute('height', '192');
  await page.locator('#resizable-aspect').evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#resizable-width').fill('320');
  await page.locator('#resizable-height').fill('100');
  await page.locator('#resizable-height').press('Enter');
  await expect(resizable).toHaveAttribute('width', '320');
  await expect(resizable).toHaveAttribute('height', '184');
  await page.locator('#resizable-reset').click();
  await expect(resizable).toHaveAttribute('x', '48');
  await expect(resizable).toHaveAttribute('width', '240');
});
