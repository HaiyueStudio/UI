import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/date-picker.html'); });

test('selects constrained ISO dates and clears the value', async ({ page }) => {
  const picker = page.locator('#picker'); const trigger = picker.getByRole('button', { name: 'Publish date' });
  await trigger.click(); await picker.getByRole('gridcell', { name: /October 18, 2026/ }).click();
  await expect(picker).toHaveAttribute('value', '2026-10-18'); await expect(page.locator('#events')).toContainText('value:2026-10-18');
  await picker.getByRole('button', { name: 'Clear date' }).click(); await expect(picker).not.toHaveAttribute('value');
});

test('supports keyboard month movement and outside or Escape closing', async ({ page }) => {
  const picker = page.locator('#picker'); const trigger = picker.getByRole('button', { name: 'Publish date' });
  await trigger.focus(); await page.keyboard.press('ArrowDown'); await expect(picker.getByRole('gridcell', { name: /October 14, 2026/ })).toBeFocused();
  await page.keyboard.press('PageDown'); await expect(picker.getByRole('gridcell', { name: /November 14, 2026/ })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(picker).not.toHaveAttribute('open', ''); await expect(trigger).toBeFocused();
  await trigger.click(); await page.locator('#outside').click(); await expect(picker).not.toHaveAttribute('open', '');
});

test('component gallery demonstrates date picker parameters', async ({ page }) => {
  await page.goto('/examples/#date-picker'); const picker = page.locator('#date-picker-live');
  await picker.getByRole('button', { name: 'Scene date' }).click(); await picker.getByRole('gridcell', { name: /October 20, 2026/ }).click();
  await expect(page.locator('#date-picker-event')).toContainText('2026-10-20');
});
