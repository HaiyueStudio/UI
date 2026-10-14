import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/watermark.html'); });

test('renders a repeated text pattern with configured geometry', async ({ page }) => {
  const watermark = page.locator('#watermark'); const pattern = watermark.locator('pattern');
  await expect(pattern).toHaveAttribute('width', '220'); await expect(pattern).toHaveAttribute('height', '130');
  await expect(watermark.locator('[part~="text"]')).toContainText('HAIYUE PREVIEW');
  await expect(watermark.locator('g')).toHaveAttribute('opacity', '0.2');
  await expect(watermark.locator('g')).toHaveAttribute('transform', /rotate\(-30/);
});

test('keeps slotted content interactive and supports multiline or image marks', async ({ page }) => {
  await page.locator('#action').click(); await expect(page.locator('#events')).toHaveText('clicked');
  const watermark = page.locator('#watermark');
  await page.evaluate(() => { document.querySelector('#watermark').content = ['Haiyue', 'Internal']; });
  await expect(watermark.locator('tspan')).toHaveCount(2);
  await page.evaluate(() => { document.querySelector('#watermark').image = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E'; });
  await expect(watermark.locator('[part~="image"]')).toHaveCount(1); await expect(watermark.locator('[part~="text"]')).toHaveCount(0);
});

test('component gallery demonstrates watermark content and angle controls', async ({ page }) => {
  await page.goto('/examples/#watermark'); const watermark = page.locator('#watermark-live');
  await page.locator('#watermark-content').fill('INTERNAL'); await expect(watermark.locator('[part~="text"]')).toContainText('INTERNAL');
  await page.locator('#watermark-rotate').fill('-10'); await expect(watermark.locator('g')).toHaveAttribute('transform', /rotate\(-10/);
});
