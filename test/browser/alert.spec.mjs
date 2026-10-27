import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/alert.html'); });

test('renders semantic content, icon, action, and type changes', async ({ page }) => {
  const alert = page.locator('#alert');
  await expect(alert.locator('[part="alert"]')).toHaveAttribute('role', 'alert');
  await expect(alert.locator('[part="message"]')).toContainText('Texture budget');
  await expect(alert.locator('[part="description"]')).toContainText('Memory use is above 90%.');
  await expect(alert.locator('[part="icon"]')).toBeVisible();
  await expect(alert.locator('button[slot="action"]')).toBeVisible();
  await alert.evaluate(element => { element.type = 'success'; element.closeText = 'Dismiss'; });
  await expect(alert.locator('[part="alert"]')).toHaveClass(/success/);
  await expect(alert.locator('[part="close-button"]')).toHaveText('Dismiss');
});

test('supports cancelable close and hides after an accepted close', async ({ page }) => {
  const alert = page.locator('#alert');
  await alert.evaluate(element => element.addEventListener('alert-close', event => event.preventDefault(), { once: true }));
  await alert.locator('[part="close-button"]').click();
  await expect(alert).toBeVisible();
  const detail = await alert.evaluate(element => new Promise(resolve => {
    element.addEventListener('alert-close', event => resolve(event.detail), { once: true });
    element.close();
  }));
  expect(detail).toEqual({ type: 'warning', message: 'Texture budget' });
  await expect(alert).toBeHidden();
});

test('gallery exposes live alert controls', async ({ page }) => {
  await page.goto('/examples/#alert');
  const alert = page.locator('#alert-live');
  await page.locator('#alert-type').selectOption('error');
  await expect(alert.locator('[part="alert"]')).toHaveClass(/error/);
  await alert.locator('[part="close-button"]').click();
  await expect(alert).toBeHidden();
  await page.locator('#alert-reset').click();
  await expect(alert).toBeVisible();
});
