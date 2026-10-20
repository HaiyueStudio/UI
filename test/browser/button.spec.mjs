import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/button.html'); });

test('renders attribute and slotted icons before or after the label', async ({ page }) => {
  const attribute = page.locator('#attribute-icon');
  await expect(attribute.locator('[part="icon"]')).toContainText('↓');
  await expect(attribute.locator('[part="content"]')).toHaveText('Download');

  const slotted = page.locator('#slotted-icon');
  await expect(page.getByTestId('upload-icon')).toBeVisible();
  await expect(page.getByTestId('legacy-icon')).toBeVisible();
  await expect(slotted.getByRole('button')).toHaveClass(/icon-end/);
  await slotted.evaluate(element => { element.iconPosition = 'start'; element.icon = 'fallback'; });
  await expect(slotted).toHaveAttribute('icon-position', 'start');
  await expect(slotted.getByRole('button')).not.toHaveClass(/icon-end/);
});

test('loading shows a spinner, exposes busy state, and blocks clicks', async ({ page }) => {
  const button = page.locator('#loading');
  await button.evaluate(element => { element.loading = true; element.click(); });
  await expect(button.getByRole('button')).toBeDisabled();
  await expect(button.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  await expect(button.locator('[part="spinner"]')).toBeVisible();
  await expect(page.locator('#events')).toHaveText('0');

  await button.evaluate(element => { element.loading = false; element.click(); });
  await expect(button.getByRole('button')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#events')).toHaveText('1');
});

test('button group exposes group semantics and horizontal or vertical layout', async ({ page }) => {
  const group = page.locator('#group');
  await expect(group.getByRole('group', { name: 'History actions' })).toBeVisible();
  await expect(group.locator('hy-button')).toHaveCount(3);
  await group.evaluate(element => { element.orientation = 'vertical'; });
  await expect(group).toHaveAttribute('orientation', 'vertical');
  await expect(group.locator('[part="group"]')).toHaveCSS('flex-direction', 'column');
});

test('component gallery demonstrates loading and button-group orientation', async ({ page }) => {
  await page.goto('/examples/#button');
  await page.locator('#button-request').click();
  await expect(page.locator('#button-request').getByRole('button')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#button-event')).toContainText('"loading":true');
  await expect(page.locator('#button-request').getByRole('button')).not.toHaveAttribute('aria-busy', 'true', { timeout: 2000 });
  await expect(page.locator('#button-event')).toContainText('"status":200');

  await page.locator('#button-group-orientation').selectOption('vertical');
  await expect(page.locator('#button-group-live')).toHaveAttribute('orientation', 'vertical');
});
