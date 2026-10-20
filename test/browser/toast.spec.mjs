import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/toast.html'); });

test('opens typed messages, closes by action, and reports lifecycle details', async ({ page }) => {
  const toast = page.locator('#toast');
  const key = await toast.evaluate(element => element.success({ message: 'Saved', duration: 0, key: 'saved' }));
  expect(key).toBe('saved');
  const item = toast.locator('[part="toast"][data-key="saved"]');
  await expect(item).toContainText('Saved');
  await expect(item).toHaveAttribute('data-type', 'success');
  const detail = await toast.evaluate(element => new Promise(resolve => {
    element.addEventListener('toast-close', event => resolve(event.detail), { once: true });
    element.shadowRoot.querySelector('[data-key="saved"] [part="close-button"]').click();
  }));
  expect(detail).toEqual({ key: 'saved', type: 'success', placement: 'top', reason: 'action' });
  await expect(item).toHaveCount(0);
});

test('auto closes, caps the queue, and keeps loading persistent by default', async ({ page }) => {
  const toast = page.locator('#toast');
  await toast.evaluate(element => { element.info({ key: 'one', message: 'One', duration: 0 }); element.warning({ key: 'two', message: 'Two', duration: 0 }); element.error({ key: 'three', message: 'Three', duration: 0 }); });
  await expect(toast.locator('[part="toast"]')).toHaveCount(2);
  await expect(toast.locator('[data-key="one"]')).toHaveCount(0);
  await toast.evaluate(element => element.loading('Working'));
  await page.waitForTimeout(100);
  await expect(toast.locator('[data-type="loading"]')).toHaveCount(1);
  await toast.evaluate(element => element.info({ key: 'timed', message: 'Done', duration: 0.05 }));
  await expect(toast.locator('[data-key="timed"]')).toHaveCount(0, { timeout: 1000 });
});

test('component gallery demonstrates toast type, placement, duration, and clear', async ({ page }) => {
  await page.goto('/examples/#toast');
  await page.locator('#toast-type').selectOption('error');
  await page.locator('#toast-show').click();
  await expect(page.locator('#toast-live [part="toast"]')).toHaveAttribute('data-type', 'error');
  await page.locator('#toast-clear').click();
  await expect(page.locator('#toast-live [part="toast"]')).toHaveCount(0);
});
