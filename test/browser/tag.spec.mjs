import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/tag.html'); });

test('renders semantic content and closes unless the event is canceled', async ({ page }) => {
  const tag = page.locator('#plain');
  await expect(tag.locator('[part="label"]')).toHaveText('Synced');
  await expect(tag.locator('[part="icon"]')).toHaveText('✓');
  await expect(tag.locator('[part="tag"]')).toHaveAttribute('data-variant', 'success');
  await tag.locator('[part="close-button"]').click();
  await expect(tag).toBeHidden();

  await tag.evaluate(element => { element.hidden = false; element.addEventListener('tag-close', event => event.preventDefault(), { once: true }); });
  await tag.locator('[part="close-button"]').click();
  await expect(tag).toBeVisible();
});

test('checkable tags toggle with pointer and keyboard and emit composed details', async ({ page }) => {
  const tag = page.locator('#checkable');
  await tag.click();
  await expect(tag).toHaveAttribute('checked', '');
  await expect(tag).toHaveAttribute('aria-checked', 'true');
  await tag.focus();
  await page.keyboard.press('Space');
  await expect(tag).not.toHaveAttribute('checked', '');
  expect(await tag.evaluate(element => new Promise(resolve => {
    element.addEventListener('checked-change', event => resolve({ detail: event.detail, bubbles: event.bubbles, composed: event.composed }), { once: true });
    element.shadowRoot.querySelector('[part="tag"]').click();
  }))).toEqual({ detail: { checked: true, value: 'featured' }, bubbles: true, composed: true });
});

test('component gallery demonstrates tag parameters and events', async ({ page }) => {
  await page.goto('/examples/#tag');
  const tag = page.locator('#tag-live');
  await page.locator('#tag-variant').selectOption('warning');
  await expect(tag.locator('[part="tag"]')).toHaveAttribute('data-variant', 'warning');
  await page.locator('#tag-checkable').evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await tag.click();
  await expect(page.locator('#tag-event')).toContainText('checked-change');
});
