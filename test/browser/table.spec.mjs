import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/table.html'); });

test('paginates local data and only renders the current page rows', async ({ page }) => {
  const table = page.locator('#table');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.locator('tbody')).toContainText('Luna');
  await table.getByRole('button', { name: 'Next page' }).click();
  await expect(table).toHaveAttribute('page', '2');
  await expect(table.locator('tbody')).toContainText('Nova');
  await expect(table.locator('tbody')).not.toContainText('Luna');
  await expect(page.locator('#events')).toContainText('change:paginate:2:6');
});

test('cycles stable sorting and resets pagination', async ({ page }) => {
  const table = page.locator('#table');
  const score = table.getByRole('button', { name: 'Sort by Score' });
  await score.click();
  await expect(table.locator('tbody tr').first()).toContainText('Vega');
  await score.click();
  await expect(table.locator('tbody tr').first()).toContainText('Mira');
  await score.click();
  await expect(table.locator('tbody tr').first()).toContainText('Luna');
  await expect(page.locator('#events')).toContainText('change:sort:1:6');
});

test('filters text and options while preserving the active control', async ({ page }) => {
  const table = page.locator('#table');
  await table.locator('summary[aria-label="Filter Name"]').click();
  const nameFilter = table.getByRole('searchbox', { name: 'Filter Name' });
  await nameFilter.fill('a');
  await expect(nameFilter).toBeFocused();
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await table.locator('summary[aria-label="Filter Role"]').click();
  await table.getByRole('combobox', { name: 'Filter Role' }).selectOption('Engineer');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.locator('tbody')).toContainText('Mira');
  await expect(table.locator('tbody')).toContainText('Aster');
  await expect(table.locator('tbody')).not.toContainText('Luna');
  await expect(page.locator('#events')).toContainText('change:filter:1:3');
});

test('supports global and per-column filter-control visibility without disabling filter APIs', async ({ page }) => {
  const table = page.locator('#table');
  await expect(table.locator('summary.filter-trigger')).toHaveCount(2);
  await expect(table.locator('summary[aria-label="Filter Score"]')).toHaveCount(0);
  await page.evaluate(() => {
    const element = document.querySelector('#table');
    element.showFilters = false;
    element.setFilter('name', 'Luna');
  });
  await expect(table.locator('summary.filter-trigger')).toHaveCount(0);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tbody')).toContainText('Luna');
  await page.evaluate(() => { document.querySelector('#table').showFilters = true; });
  await expect(table.locator('summary.filter-trigger')).toHaveCount(2);
});

test('reports source record and absolute index for row clicks', async ({ page }) => {
  const table = page.locator('#table');
  await table.locator('tbody tr').nth(1).click();
  await expect(page.locator('#events')).toContainText('row:Mira:1');
});

test('component gallery demonstrates table controls without page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/#table');
  const table = page.locator('#table-live');
  await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect(table.locator('summary.filter-trigger')).toHaveCount(2);
  await page.locator('#table-show-filters').uncheck({ force: true });
  await expect(table.locator('summary.filter-trigger')).toHaveCount(0);
  await page.locator('#table-show-filters').check({ force: true });
  await expect(table.locator('summary.filter-trigger')).toHaveCount(2);
  await page.locator('#table-status').selectOption('Blocked');
  await expect(page.locator('#table-event')).toContainText('"filteredTotal":12');
  await page.locator('#table-sort').click();
  await expect(page.locator('#table-event')).toContainText('"reason":"sort"');
  await page.locator('#table-page-size').selectOption('10');
  await expect(table.locator('tbody tr')).toHaveCount(10);
  expect(errors).toEqual([]);
});
