import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/time-picker.html'); });

test('selects stepped time columns and confirms a stable value', async ({ page }) => {
  const picker = page.locator('#picker'); await picker.getByRole('button', { name: 'Publish time' }).click();
  await picker.getByRole('listbox', { name: 'hour' }).getByRole('option', { name: '12' }).click();
  await picker.getByRole('listbox', { name: 'minute' }).getByRole('option', { name: '45' }).click();
  await picker.getByRole('listbox', { name: 'second' }).getByRole('option', { name: '30' }).click();
  await picker.getByRole('button', { name: 'OK' }).click(); await expect(picker).toHaveAttribute('value', '12:45:30'); await expect(page.locator('#events')).toContainText('value:12:45:30');
});

test('supports column keyboard traversal and Escape closing', async ({ page }) => {
  const picker = page.locator('#picker'); const trigger = picker.getByRole('button', { name: 'Publish time' }); await trigger.focus(); await page.keyboard.press('ArrowDown');
  await expect(picker.getByRole('listbox', { name: 'hour' }).getByRole('option', { name: '10' })).toBeFocused(); await page.keyboard.press('ArrowRight');
  await expect(picker.getByRole('listbox', { name: 'minute' }).getByRole('option', { name: '30' })).toBeFocused(); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});

test('component gallery demonstrates seconds and step controls', async ({ page }) => {
  await page.goto('/examples/#time-picker'); const picker = page.locator('#time-picker-live');
  await page.locator('#time-picker-seconds').evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(picker).toHaveAttribute('show-seconds', ''); await picker.getByRole('button', { name: 'Scene time' }).click();
  await picker.getByRole('button', { name: 'OK' }).click(); await expect(page.locator('#time-picker-event')).toContainText('value-change');
});
