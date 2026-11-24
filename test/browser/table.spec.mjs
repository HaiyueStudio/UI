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

test('shared pagination controls reset table page size once and keep filtered totals in sync', async ({ page }) => {
  const table = page.locator('#table');
  expect(await page.evaluate(() => customElements.get('hy-pagination') === undefined)).toBe(true);
  await table.getByRole('button', { name: 'Next page' }).click();
  await page.evaluate(() => {
    window.paginationChanges = [];
    document.querySelector('#table').addEventListener('table-change', event => window.paginationChanges.push(event.detail));
  });
  const size = table.getByRole('combobox', { name: 'Rows per page' });
  await size.focus();
  await size.selectOption('4');
  await expect(table).toHaveAttribute('page', '1');
  await expect(table.locator('tbody tr')).toHaveCount(4);
  await expect(size).toBeFocused();
  expect(await page.evaluate(() => window.paginationChanges.map(({ reason, page, pageSize }) => ({ reason, page, pageSize })))).toEqual([
    { reason: 'paginate', page: 1, pageSize: 4 },
  ]);

  await table.evaluate(element => { element.setFilter('role', 'Artist'); });
  await expect(table.locator('[part="summary"]')).toHaveText('1–3 of 3');
  await expect(table.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await table.evaluate(element => { element.setFilter('name', 'Missing'); });
  await expect(table.locator('[part="summary"]')).toHaveText('0–0 of 0');
  await expect(table.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await table.getByRole('button', { name: 'Page 1', exact: true }).click();
  expect(await page.evaluate(() => window.paginationChanges.length)).toBe(3);
  await table.evaluate(element => { element.pagination = false; element.clearFilters(); });
  await expect(table.getByRole('navigation', { name: 'Table pagination', includeHidden: true })).toBeHidden();
  await expect(table.locator('tbody tr')).toHaveCount(6);
  await table.evaluate(element => { element.pagination = true; element.dataSource = element.dataSource.slice(0, 1); });
  await expect(table.locator('[part="summary"]')).toHaveText('1–1 of 1');
  await expect(table.locator('tbody tr')).toHaveCount(1);
});

test('shared page buttons keep table focus and bounded page windows during keyboard navigation', async ({ page }) => {
  const table = page.locator('#table');
  await table.evaluate(element => {
    element.dataSource = Array.from({ length: 120 }, (_, index) => ({ name: `Member ${index}`, score: index }));
    element.page = 20;
  });
  const current = () => table.locator('[aria-current="page"]');
  await current().focus();
  await current().press('ArrowRight');
  await expect(table).toHaveAttribute('page', '21');
  await expect(current()).toBeFocused();
  await expect(table.locator('[part="page"]')).toHaveCount(5);
  await current().press('End');
  await expect(table).toHaveAttribute('page', '60');
  await expect(current()).toBeFocused();
  await expect(table.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await table.evaluate(element => { element.dir = 'rtl'; });
  await current().press('ArrowRight');
  await expect(table).toHaveAttribute('page', '59');
  await expect(current()).toBeFocused();
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
  await page.locator('#table-show-filters').evaluate(element => {
    element.checked = false;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(table.locator('summary.filter-trigger')).toHaveCount(0);
  await page.locator('#table-show-filters').evaluate(element => {
    element.checked = true;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(table.locator('summary.filter-trigger')).toHaveCount(2);
  await page.locator('#table-status').selectOption('Blocked');
  await expect(page.locator('#table-event')).toContainText('"filteredTotal":12');
  await page.locator('#table-sort').click();
  await expect(page.locator('#table-event')).toContainText('"reason":"sort"');
  await page.locator('#table-page-size').selectOption('10');
  await expect(table.locator('tbody tr')).toHaveCount(10);
  expect(errors).toEqual([]);
});
