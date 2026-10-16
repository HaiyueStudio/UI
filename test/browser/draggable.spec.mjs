import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/draggable.html');
});

test('drag handle moves on the grid and emits a complete lifecycle', async ({ page }) => {
  const handle = page.locator('[data-drag-handle]');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + 93, box.y + 62, { steps: 4 });
  await page.mouse.up();

  const draggable = page.locator('#draggable');
  await expect(draggable).toHaveAttribute('x', '90');
  await expect(draggable).toHaveAttribute('y', '70');
  const events = page.locator('#events');
  await expect(events).toContainText('drag-start');
  await expect(events).toContainText('drag-move');
  await expect(events).toContainText('drag-end');
});

test('parent bounds clamp API movement and interactive controls do not drag', async ({ page }) => {
  const result = await page.locator('#draggable').evaluate(element => element.moveTo(999, 999));
  expect(result.x).toBeGreaterThan(300);
  expect(result.y).toBeGreaterThan(180);
  const rects = await page.evaluate(() => ({ stage: document.querySelector('#stage').getBoundingClientRect().toJSON(), item: document.querySelector('#draggable').getBoundingClientRect().toJSON() }));
  expect(rects.item.right).toBeLessThanOrEqual(rects.stage.right - 1);
  expect(rects.item.bottom).toBeLessThanOrEqual(rects.stage.bottom - 1);
  await expect(page.locator('#draggable')).toHaveAttribute('x', String(result.x));
  await expect(page.locator('#draggable')).toHaveAttribute('y', String(result.y));

  await page.locator('#draggable').evaluate(element => element.moveTo(20, 20));
  const button = page.locator('#action');
  const box = await button.boundingBox();
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 50);
  await page.mouse.up();
  await expect(page.locator('#draggable')).toHaveAttribute('x', '20');
  await expect(page.locator('#draggable')).toHaveAttribute('y', '20');
});

test('keyboard honors axis, grid, acceleration, and reset', async ({ page }) => {
  await page.locator('#draggable').evaluate(element => { element.axis = 'x'; });
  const surface = page.locator('#draggable').getByRole('group', { name: 'Test draggable' });
  await surface.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#draggable')).toHaveAttribute('x', '30');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#draggable')).toHaveAttribute('y', '20');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#draggable')).toHaveAttribute('x', '130');
  await page.keyboard.press('Home');
  await expect(page.locator('#draggable')).toHaveAttribute('x', '0');
  await expect(page.locator('#draggable')).toHaveAttribute('y', '20');
  await page.locator('#draggable').evaluate(element => element.reset());
  await expect(page.locator('#draggable')).toHaveAttribute('y', '0');
});

test('component gallery demonstrates API movement and reset controls', async ({ page }) => {
  await page.goto('/examples/#draggable');
  const draggable = page.locator('#draggable-live');
  await page.locator('#draggable-move').click();
  await expect(draggable).toHaveAttribute('x', '72');
  await expect(draggable).toHaveAttribute('y', '56');
  await expect(page.locator('#draggable-position')).toHaveText('72, 56');
  await page.locator('#draggable-reset').click();
  await expect(draggable).toHaveAttribute('x', '0');
  await expect(draggable).toHaveAttribute('y', '0');
});
