import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/divider.html'); });

test('renders semantic horizontal and vertical separators with optional text', async ({ page }) => {
  const plain = page.locator('#plain'); const labelled = page.locator('#labelled'); const vertical = page.locator('#vertical');
  await expect(plain.getByRole('separator', { name: 'Section divider' })).toHaveAttribute('aria-orientation', 'horizontal');
  await expect(plain.locator('[part="text"]')).toBeHidden(); await expect(labelled.locator('[part="text"]')).toBeVisible(); await expect(labelled).toContainText('Scene settings');
  await expect(labelled.locator('[part~="line"]').first()).toHaveCSS('border-top-style', 'dashed');
  await expect(vertical.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical'); await expect(vertical.locator('[part="text"]')).toContainText('or');
});

test('updates label, placement, color, and double-line thickness through properties', async ({ page }) => {
  const divider = page.locator('#plain');
  await page.evaluate(() => { const element = document.querySelector('#plain'); element.label = 'Assets'; element.textPlacement = 'end'; element.lineStyle = 'double'; element.thickness = 1; element.color = 'rgb(255, 0, 0)'; });
  await expect(divider.locator('[part="text"]')).toContainText('Assets'); await expect(divider).toHaveAttribute('text-placement', 'end');
  const line = divider.locator('[part~="line"]').first(); await expect(line).toHaveCSS('border-top-style', 'double'); await expect(line).toHaveCSS('border-top-width', '3px'); await expect(line).toHaveCSS('border-top-color', 'rgb(255, 0, 0)');
});

test('component gallery demonstrates text and line-style controls', async ({ page }) => {
  await page.goto('/examples/#divider'); const divider = page.locator('#divider-live');
  await page.locator('#divider-style').selectOption('dotted'); await expect(divider.locator('[part~="line"]').first()).toHaveCSS('border-top-style', 'dotted');
  await page.locator('#divider-label').fill('Assets'); await expect(divider.locator('[part="text"]')).toContainText('Assets');
});
