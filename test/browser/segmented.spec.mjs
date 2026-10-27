import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/segmented.html'); });

test('selects enabled options and emits a composed value change', async ({ page }) => {
  const segmented = page.locator('#segmented');
  const detail = await segmented.evaluate(element => new Promise(resolve => {
    element.addEventListener('value-change', event => resolve(event.detail), { once: true });
    element.shadowRoot.querySelector('[data-value="code"]').click();
  }));
  expect(detail).toEqual({ value: 'code', option: { label: 'Code', value: 'code', disabled: false } });
  await expect(segmented).toHaveAttribute('value', 'code');
  await expect(segmented.locator('[data-value="code"]')).toHaveAttribute('aria-checked', 'true');
});

test('uses roving focus and skips disabled options with the keyboard', async ({ page }) => {
  const segmented = page.locator('#segmented');
  const preview = segmented.locator('[data-value="preview"]');
  await preview.focus();
  await page.keyboard.press('ArrowRight');
  await expect(segmented).toHaveAttribute('value', 'code');
  await page.keyboard.press('ArrowRight');
  await expect(segmented).toHaveAttribute('value', 'compare');
  await expect(segmented.locator('[data-value="compare"]')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(segmented).toHaveAttribute('value', 'preview');
});

test('supports block, size, group disable, and gallery controls', async ({ page }) => {
  const segmented = page.locator('#segmented');
  await segmented.evaluate(element => { element.block = true; element.size = 'large'; element.disabled = true; });
  await expect(segmented).toHaveAttribute('block', '');
  await expect(segmented).toHaveAttribute('size', 'large');
  await expect(segmented.locator('button')).toHaveCount(4);
  expect(await segmented.locator('button').evaluateAll(buttons => buttons.every(button => button.disabled))).toBe(true);
  await page.goto('/examples/#segmented');
  await page.locator('#segmented-next').click();
  await expect(page.locator('#segmented-live')).toHaveAttribute('value', 'code');
});
