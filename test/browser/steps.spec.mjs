import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/steps.html'); });

test('derives finish, process, wait states and exposes the current semantic step', async ({ page }) => {
  const steps = page.locator('#steps'); const items = steps.getByRole('listitem'); await expect(steps.getByRole('list', { name: 'Publish progress' })).toBeVisible(); await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toHaveClass(/status-finish/); await expect(items.nth(1)).toHaveClass(/status-process/); await expect(items.nth(2)).toHaveClass(/status-error/);
  await expect(items.nth(1).locator('[part="step"]')).toHaveAttribute('aria-current', 'step'); await expect(items.nth(3).getByRole('button')).toBeDisabled();
});

test('supports clickable navigation and switching to vertical direction', async ({ page }) => {
  const steps = page.locator('#steps'); await steps.getByRole('button', { name: /Review/ }).click(); await expect(steps).toHaveAttribute('current', '2'); await expect(page.locator('#events')).toHaveText('1->2:review');
  await page.evaluate(() => { document.querySelector('#steps').direction = 'vertical'; }); await expect(steps).toHaveAttribute('direction', 'vertical'); await expect(steps.locator('[part="list"]')).toHaveCSS('flex-direction', 'column');
});

test('component gallery demonstrates horizontal and vertical settings', async ({ page }) => {
  await page.goto('/examples/#steps'); const steps = page.locator('#steps-live'); await page.locator('#steps-direction').selectOption('vertical');
  await expect(steps).toHaveAttribute('direction', 'vertical'); await expect(steps.locator('[part="list"]')).toHaveCSS('flex-direction', 'column');
  await page.locator('#steps-current').selectOption('2'); await expect(steps).toHaveAttribute('current', '2'); await expect(page.locator('#steps-state')).toContainText('Review');
});
