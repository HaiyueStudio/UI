import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/input.html'); });

test('renders attribute and slotted prefix/suffix content with public properties', async ({ page }) => {
  const affixed = page.locator('#affixed');
  await expect(affixed.locator('[part="prefix"]')).toContainText('https://');
  await expect(affixed.locator('[part="suffix"]')).toContainText('.studio');
  await expect(page.getByTestId('slot-prefix')).toBeVisible();
  await expect(page.getByTestId('slot-suffix')).toBeVisible();

  await affixed.evaluate(element => { element.prefix = 'project://'; element.suffix = '.scene'; });
  await expect(affixed.locator('[part="prefix"]')).toContainText('project://');
  await expect(affixed.locator('[part="suffix"]')).toContainText('.scene');
});

test('keeps native number constraints and value-change details', async ({ page }) => {
  const input = page.locator('#number').locator('input');
  await input.fill('3');
  await input.blur();
  await expect(page.locator('#number')).toHaveAttribute('value', '3');
  await expect(page.locator('#events')).toContainText('value-change:{"value":"3","valueAsNumber":3,"valid":false}');
  await expect(page.locator('#number').locator('[part="control"]')).toHaveClass(/invalid/);
});

test('searches from Enter, button, and API with an accessible action', async ({ page }) => {
  const search = page.locator('#search');
  const input = search.locator('input');
  await input.fill('moon');
  await input.press('Enter');
  await expect(page.locator('#events')).toContainText('"source":"enter"');
  await search.getByRole('button', { name: 'Search assets' }).click();
  await expect(page.locator('#events')).toContainText('"source":"button"');
  await search.evaluate(element => element.search());
  await expect(page.locator('#events')).toContainText('"source":"api"');
});

test('component gallery demonstrates editable affixes and search events', async ({ page }) => {
  await page.goto('/examples/#input');
  await page.locator('#input-prefix').fill('asset://');
  await page.locator('#input-suffix').fill('.mesh');
  await expect(page.locator('#input-text').locator('[part="prefix"]')).toContainText('asset://');
  await expect(page.locator('#input-text').locator('[part="suffix"]')).toContainText('.mesh');
  await page.locator('#input-search').locator('input').fill('ocean');
  await page.locator('#input-search').getByRole('button', { name: 'Search assets' }).click();
  await expect(page.locator('#input-event')).toContainText('"value":"ocean"');
  await expect(page.locator('#input-event')).toContainText('"source":"button"');
});
