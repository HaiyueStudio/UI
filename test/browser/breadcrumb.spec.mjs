import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/breadcrumb.html'); });

test('renders an accessible path with hidden separators and current-page state', async ({ page }) => {
  const breadcrumb = page.locator('#breadcrumb');
  await expect(breadcrumb.getByRole('navigation', { name: 'Project path' })).toBeVisible();
  await expect(breadcrumb.locator('li')).toHaveCount(4);
  await expect(breadcrumb.locator('.separator')).toHaveCount(3);
  await expect(breadcrumb.locator('.separator').first()).toHaveText('›');
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Lighting');
  await expect(breadcrumb.locator('[aria-disabled="true"]')).toHaveText('Locked');
});

test('supports links and action items through one cancelable click event', async ({ page }) => {
  const breadcrumb = page.locator('#breadcrumb');
  await breadcrumb.getByRole('link', { name: 'Home' }).click();
  await expect(page).not.toHaveURL(/#home$/u);
  await breadcrumb.getByRole('button', { name: 'Assets' }).click();
  await expect(page.locator('#events')).toHaveText('click:0:Home\nclick:1:Assets\n');
});

test('updates separators and supports custom item rendering', async ({ page }) => {
  const breadcrumb = page.locator('#breadcrumb');
  await page.evaluate(() => {
    const element = document.querySelector('#breadcrumb');
    element.separator = '→';
    element.renderItem = item => {
      const strong = document.createElement('strong');
      strong.textContent = String(item.title ?? item.label).toUpperCase();
      return strong;
    };
  });
  await expect(breadcrumb.locator('.separator').first()).toHaveText('→');
  await expect(breadcrumb.locator('strong')).toHaveCount(4);
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('LIGHTING');
});

test('keeps Ant Design-style title items populated when the item count changes', async ({ page }) => {
  const breadcrumb = page.locator('#breadcrumb');
  await page.evaluate(() => {
    const element = document.querySelector('#breadcrumb');
    element.items = Array.from({ length: 6 }, (_, index) => ({ title: `Level ${index + 1}` }));
  });
  await expect(breadcrumb.locator('li')).toHaveCount(6);
  await expect(breadcrumb.locator('li')).toHaveText(['Level 1', '›Level 2', '›Level 3', '›Level 4', '›Level 5', '›Level 6']);
  await page.evaluate(() => {
    const element = document.querySelector('#breadcrumb');
    element.items = Array.from({ length: 3 }, (_, index) => ({ title: `Level ${index + 1}` }));
  });
  await expect(breadcrumb.locator('li')).toHaveCount(3);
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Level 3');
});

test('component gallery demonstrates breadcrumb parameters without page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/#breadcrumb');
  const breadcrumb = page.locator('#breadcrumb-live');
  await expect(breadcrumb.locator('li')).toHaveCount(4);
  await breadcrumb.getByRole('button', { name: 'Ocean World' }).click();
  await expect(page.locator('#breadcrumb-event')).toContainText('"key":"ocean"');
  await page.locator('#breadcrumb-separator').selectOption('→');
  await expect(breadcrumb.locator('.separator').first()).toHaveText('→');
  await page.locator('#breadcrumb-depth').selectOption('5');
  await expect(breadcrumb.locator('li')).toHaveCount(5);
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Lighting');
  await page.locator('label.toggle', { hasText: 'disable Scenes' }).click();
  await expect(page.locator('#breadcrumb-disabled')).toBeChecked();
  await expect(breadcrumb.locator('[aria-disabled="true"]')).toHaveText('Scenes');
  expect(errors).toEqual([]);
});
