import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/examples/'); });

test('gallery shell dogfoods Haiyue inputs, buttons, and status components', async ({ page }) => {
  await expect(page.locator('.theme-picker hy-button')).toHaveCount(2);
  await expect(page.locator('#component-search')).toHaveJSProperty('tagName', 'HY-INPUT');
  await expect(page.locator('.sidebar-foot hy-badge')).toHaveCount(1);
  expect(await page.locator('hy-button.native-trigger').count()).toBeGreaterThan(15);

  await page.locator('.theme-picker hy-button[data-theme="light"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-hy-theme', 'light');
  await expect(page.locator('.theme-picker hy-button[data-theme="light"]').getByRole('button')).toHaveAttribute('aria-pressed', 'true');
});

test('Haiyue component search filters navigation and command results', async ({ page }) => {
  const search = page.locator('#component-search').locator('input');
  await search.fill('resizable');
  await expect(page.locator('#component-nav a[href="#resizable"]')).toBeVisible();
  await expect(page.locator('#component-nav a[href="#button"]')).toBeHidden();

  await page.keyboard.press('Control+K');
  await expect(page.locator('#command')).toBeVisible();
  await expect(page.locator('#command-input')).toHaveJSProperty('tagName', 'HY-INPUT');
  await page.locator('#command-input').locator('input').fill('input');
  await expect(page.locator('#command-results hy-button')).toHaveCount(1);
  await expect(page.locator('#command-results hy-button')).toContainText('Input');
});

test('gallery shell and demo cards use adjustable Split panes', async ({ page }) => {
  const shell = page.locator('#gallery-shell');
  await expect(shell).toHaveJSProperty('tagName', 'HY-SPLIT');
  await expect(shell.locator(':scope > [slot="first"]')).toHaveClass(/sidebar/);
  await expect(shell.locator(':scope > [slot="second"]')).toHaveAttribute('id', 'content');

  const buttonCard = page.locator('#button .demo-card');
  await expect(buttonCard).toHaveJSProperty('tagName', 'HY-SPLIT');
  await expect(buttonCard).toHaveAttribute('bar-size', '3');
  await expect(buttonCard.locator('.preview')).toHaveAttribute('slot', 'first');
  await expect(buttonCard.locator('.controls')).toHaveAttribute('slot', 'second');
  expect(await page.locator('hy-split.demo-split').count()).toBeGreaterThan(20);

  const originalRatio = Number(await shell.getAttribute('ratio'));
  const separator = shell.getByRole('separator').first();
  await separator.focus();
  await separator.press('ArrowRight');
  expect(Number(await shell.getAttribute('ratio'))).toBeGreaterThan(originalRatio);
});

test('usage blocks are rendered by read-only CodeMirror with syntax highlighting', async ({ page }) => {
  const usage = page.locator('#button details.code');
  await usage.locator('summary').click();
  await expect(usage).toHaveAttribute('data-code-mirror-ready', 'true');
  await expect(usage.locator('.cm-editor')).toBeVisible();
  await expect(usage.locator('.cm-content')).toHaveAttribute('contenteditable', 'false');
  expect(await usage.locator('.cm-line span').count()).toBeGreaterThan(0);
});
