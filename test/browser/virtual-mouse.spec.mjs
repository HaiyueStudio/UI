import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/virtual-mouse.html'); });

test('moves with optional animation and exposes a fixed non-interactive visual', async ({ page }) => {
  const mouse = page.locator('#mouse');
  await expect(mouse).toHaveAttribute('data-state', 'idle');
  await expect(mouse).toHaveCSS('position', 'fixed');
  await expect(mouse).toHaveCSS('pointer-events', 'none');

  await page.evaluate(async () => {
    const virtualMouse = document.querySelector('#mouse');
    await virtualMouse.moveTo(120, 80, { animate: false });
    await virtualMouse.moveBy(30, 20, { animate: true, duration: 30, easing: 'linear' });
  });

  await expect(mouse).toHaveAttribute('x', '150');
  await expect(mouse).toHaveAttribute('y', '100');
  await expect(page.locator('#events')).toContainText('virtual-mouse-move-end:150');
});

test('reflects button states, supports right click, and switches state images', async ({ page }) => {
  const mouse = page.locator('#mouse');
  await page.evaluate(() => {
    const virtualMouse = document.querySelector('#mouse');
    virtualMouse.setStateImage('idle', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');
    virtualMouse.press('left');
  });
  await expect(mouse).toHaveAttribute('data-state', 'left-down');
  await page.evaluate(() => document.querySelector('#mouse').release('left'));
  await expect(mouse).toHaveAttribute('data-state', 'idle');

  await page.evaluate(async () => document.querySelector('#mouse').rightClick({ holdDuration: 0 }));
  await expect(mouse).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#events')).toContainText('virtual-mouse-down:right');
  await expect(page.locator('#events')).toContainText('virtual-mouse-up:right');
  await expect(page.locator('#events')).toContainText('virtual-mouse-click:right');
});

test('component gallery demonstrates the public cursor controls without page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/');
  await page.locator('#virtual-mouse-left').click();
  await expect(page.locator('#virtual-mouse-live')).not.toHaveAttribute('hidden', '');
  await expect(page.locator('#virtual-mouse-event')).toContainText('virtual-mouse-click');
  await page.locator('#virtual-mouse-images').check({ force: true });
  await page.locator('#virtual-mouse-right').click();
  await expect(page.locator('#virtual-mouse-event')).toContainText('"button":"right"');
  expect(errors).toEqual([]);
});
