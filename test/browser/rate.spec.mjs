import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/rate.html'); });

test('renders a half star and selects half values from pointer position', async ({ page }) => {
  const rate = page.locator('#rate'); await expect(rate.locator('[part="star"]')).toHaveCount(5); await expect(rate).toHaveAttribute('value', '2.5');
  await expect(rate.locator('[part="star"]').nth(2)).toHaveCSS('--_fill', '50%');
  await rate.locator('[part="star"]').nth(3).click({ position: { x: 2, y: 12 } });
  await expect(rate).toHaveAttribute('value', '3.5'); await expect(page.locator('#events')).toContainText('value:3.5');
});

test('supports half-step keyboard changes and clearing the current value', async ({ page }) => {
  const rate = page.locator('#rate'); const slider = rate.getByRole('slider', { name: 'Scene rating' }); await slider.focus(); await page.keyboard.press('ArrowRight');
  await expect(rate).toHaveAttribute('value', '3'); await expect(slider).toHaveAttribute('aria-valuetext', '3: Good');
  await rate.locator('[part="star"]').nth(2).click({ position: { x: 20, y: 12 } }); await expect(rate).toHaveAttribute('value', '0');
});

test('component gallery demonstrates allow-half and value events', async ({ page }) => {
  await page.goto('/examples/#rate'); const rate = page.locator('#rate-live');
  await rate.locator('[part="star"]').nth(4).click({ position: { x: 2, y: 12 } }); await expect(rate).toHaveAttribute('value', '4.5'); await expect(page.locator('#rate-event')).toContainText('4.5');
  await page.locator('#rate-half').evaluate(input => { input.checked = false; input.dispatchEvent(new Event('change', { bubbles: true })); }); await expect(rate).not.toHaveAttribute('allow-half', ''); await expect(rate).toHaveAttribute('value', '5');
});
