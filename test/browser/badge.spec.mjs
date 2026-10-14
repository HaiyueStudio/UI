import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/badge.html'); });

test('caps numeric counts and controls zero and dot visibility', async ({ page }) => {
  const badge = page.locator('#badge'); const indicator = badge.locator('[part="badge"]');
  await expect(indicator).toHaveText('99+'); await expect(indicator).toHaveAttribute('aria-label', '99+'); await expect(indicator).toHaveAttribute('title', '120');
  await badge.evaluate(element => { element.count = 0; }); await expect(indicator).toBeHidden();
  await badge.evaluate(element => { element.showZero = true; }); await expect(indicator).toBeVisible(); await expect(indicator).toHaveText('0');
  await badge.evaluate(element => { element.count = null; element.dot = true; }); await expect(indicator).toHaveClass(/dot/); await expect(indicator).toHaveText('');
});

test('renders semantic status text and supports custom color and offset', async ({ page }) => {
  const status = page.locator('#status'); await expect(status.locator('[part="status"]')).toContainText('Rendering'); await expect(status.locator('[part="status"]')).toHaveAttribute('aria-label', 'Rendering');
  const badge = page.locator('#badge'); await badge.evaluate(element => { element.color = '#7c5cff'; element.offset = [6, -3]; });
  await expect(badge).toHaveCSS('--_badge-color', '#7c5cff'); await expect(badge).toHaveCSS('--_offset-x', '6px'); await expect(badge).toHaveCSS('--_offset-y', '-3px');
});

test('component gallery demonstrates badge counts, dots, and statuses', async ({ page }) => {
  await page.goto('/examples/#badge'); const badge = page.locator('#badge-live');
  await page.locator('#badge-count').fill('120'); await expect(badge.locator('[part="badge"]')).toHaveText('99+');
  await page.locator('#badge-dot').evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }); await expect(badge.locator('[part="badge"]')).toHaveClass(/dot/);
  await page.locator('#badge-status').selectOption('success'); await expect(badge.locator('[part="status"]')).toContainText('Online');
});
