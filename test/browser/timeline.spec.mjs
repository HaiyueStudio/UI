import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/timeline.html'); });

test('renders semantic events, alternating sides, status colors, and pending state', async ({ page }) => {
  const timeline = page.locator('#timeline'); const items = timeline.getByRole('listitem');
  await expect(timeline.getByRole('list', { name: 'Release history' })).toBeVisible(); await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText('Project created'); await expect(items.nth(1)).toHaveClass(/content-left/);
  await expect(items.nth(1).locator('[part~="dot"]')).toContainText('✓'); await expect(items.nth(3)).toHaveClass(/pending/);
});

test('supports reverse ordering and custom item and dot renderers', async ({ page }) => {
  const timeline = page.locator('#timeline');
  await page.evaluate(() => {
    const element = document.querySelector('#timeline'); element.pending = ''; element.reverse = true;
    element.renderItem = (item, index) => { const strong = document.createElement('strong'); strong.textContent = `${index}:${item.title}`; return strong; };
    element.renderDot = item => item.status === 'warning' ? '!' : '';
  });
  const items = timeline.getByRole('listitem'); await expect(items).toHaveCount(3); await expect(items.nth(0)).toContainText('0:Review warning'); await expect(items.nth(0).locator('[part~="dot"]')).toContainText('!');
});

test('component gallery demonstrates mode, reverse, and pending controls', async ({ page }) => {
  await page.goto('/examples/#timeline'); const timeline = page.locator('#timeline-live');
  await page.locator('#timeline-mode').selectOption('alternate'); await expect(timeline).toHaveAttribute('mode', 'alternate');
  await page.locator('#timeline-reverse').evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(timeline).toHaveAttribute('reverse', ''); await expect(timeline.getByRole('listitem').first()).toContainText('Rendering next frame');
});
