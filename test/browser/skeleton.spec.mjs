import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/skeleton.html'); });

test('renders configured placeholders while keeping content hidden', async ({ page }) => {
  const skeleton = page.locator('#skeleton');
  await expect(skeleton).toHaveAttribute('aria-busy', 'true');
  await expect(skeleton.locator('[part="avatar"]')).toHaveCount(1);
  await expect(skeleton.locator('[part="title"]')).toHaveCount(1);
  await expect(skeleton.locator('[part="row"]')).toHaveCount(4);
  await expect(skeleton.locator('[part="content"]')).toBeHidden();
});

test('reacts to row parameters and reveals slotted content when loading ends', async ({ page }) => {
  const skeleton = page.locator('#skeleton');
  await page.evaluate(() => { const element = document.querySelector('#skeleton'); element.rows = 2; element.paragraphWidths = ['80%', '42%']; });
  await expect(skeleton.locator('[part="row"]')).toHaveCount(2);
  await expect(skeleton.locator('[part="row"]').nth(1)).toHaveAttribute('style', /width: 42%/);
  await page.evaluate(() => { document.querySelector('#skeleton').loading = false; });
  await expect(skeleton).toHaveAttribute('aria-busy', 'false');
  await expect(skeleton.locator('[part="placeholder"]')).toBeHidden();
  await expect(skeleton.locator('[part="content"]')).toBeVisible();
  await expect(page.locator('#content')).toContainText('Moon Temple');
});

test('component gallery demonstrates loading and shape controls', async ({ page }) => {
  await page.goto('/examples/#skeleton'); const skeleton = page.locator('#skeleton-live');
  await page.locator('#skeleton-loading').evaluate(input => { input.checked = false; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(skeleton).toHaveAttribute('loading', 'false'); await expect(skeleton.locator('[part="content"]')).toBeVisible();
  await expect(page.locator('#skeleton-state')).toContainText('content');
});
