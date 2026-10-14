import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/cascader.html'); });

test('expands hierarchical columns and commits a leaf path', async ({ page }) => {
  const cascader = page.locator('#cascader');
  await cascader.getByRole('button', { name: 'Location' }).click();
  await expect(cascader.getByRole('listbox')).toHaveCount(1);
  await cascader.getByRole('option', { name: 'Asia' }).click();
  await expect(cascader.getByRole('listbox')).toHaveCount(2);
  await cascader.getByRole('option', { name: 'China' }).click();
  await expect(cascader.getByRole('listbox')).toHaveCount(3);
  await cascader.getByRole('option', { name: 'Hangzhou' }).click();
  await expect(cascader).not.toHaveAttribute('open', '');
  await expect(cascader).toHaveAttribute('value', '["asia","china","hangzhou"]');
  await expect(cascader.getByRole('button', { name: 'Location' })).toContainText('Asia / China / Hangzhou');
  await expect(page.locator('#events')).toContainText('value:asia.china.hangzhou:Asia.China.Hangzhou');
});

test('supports arrow-key traversal, Escape, and clearing', async ({ page }) => {
  const cascader = page.locator('#cascader');
  const trigger = cascader.getByRole('button', { name: 'Location' });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(cascader.getByRole('option', { name: 'Asia' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(cascader.getByRole('option', { name: 'China' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(cascader.getByRole('option', { name: 'Hangzhou' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(cascader.getByRole('option', { name: 'Ningbo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('Asia / China / Ningbo');
  await cascader.getByRole('button', { name: 'Clear selection' }).click();
  await expect(trigger).toContainText('Choose a location');
  await expect(page.locator('#events')).toContainText('value::');
});

test('keeps disabled options inert and closes on outside pointer or Escape', async ({ page }) => {
  const cascader = page.locator('#cascader');
  const trigger = cascader.getByRole('button', { name: 'Location' });
  await trigger.click();
  await expect(cascader.getByRole('option', { name: 'Europe' })).toBeDisabled();
  await page.locator('#outside').click();
  await expect(cascader).not.toHaveAttribute('open', '');
  await trigger.click();
  await cascader.getByRole('option', { name: 'Asia' }).focus();
  await page.keyboard.press('Escape');
  await expect(cascader).not.toHaveAttribute('open', '');
  await expect(trigger).toBeFocused();
});

test('change-on-select commits parent paths while the panel remains open', async ({ page }) => {
  const cascader = page.locator('#cascader');
  await page.evaluate(() => { document.querySelector('#cascader').changeOnSelect = true; });
  await cascader.getByRole('button', { name: 'Location' }).click();
  await cascader.getByRole('option', { name: 'Asia' }).click();
  await expect(cascader).toHaveAttribute('open', '');
  await expect(cascader).toHaveAttribute('value', '["asia"]');
  await expect(page.locator('#events')).toContainText('value:asia:Asia');
});

test('component gallery demonstrates cascader parameters without page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/#cascader');
  const cascader = page.locator('#cascader-live');
  const trigger = cascader.getByRole('button', { name: 'Asset location' });
  await trigger.click();
  await cascader.getByRole('option', { name: 'Project' }).click();
  await cascader.getByRole('option', { name: 'Scenes' }).click();
  await cascader.getByRole('option', { name: 'Crystal Shore' }).click();
  await expect(trigger).toContainText('Project / Scenes / Crystal Shore');
  await expect(page.locator('#cascader-event')).toContainText('"value":["project","scenes","shore"]');
  await page.locator('#cascader-separator').selectOption(' → ');
  await expect(trigger).toContainText('Project → Scenes → Crystal Shore');
  await page.locator('#cascader-reset').click();
  await expect(trigger).toContainText('Moon Temple');
  expect(errors).toEqual([]);
});
