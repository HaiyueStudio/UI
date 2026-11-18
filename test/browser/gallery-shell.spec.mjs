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

test('design skins update inherited component styles and retain local overrides', async ({ page }) => {
  await page.locator('#component-nav a[href="#design-tokens"]').click();
  const design = page.locator('#design-tokens');
  const preview = design.locator('#design-preview');
  const button = preview.getByRole('button', { name: '收藏' });
  const input = preview.getByRole('textbox');
  const inputFrame = preview.locator('hy-input [part="control"]');

  await expect(button).toHaveCSS('background-color', 'rgb(255, 253, 248)');
  await expect(button).toHaveCSS('font-size', '15px');
  await expect(button).toHaveCSS('padding-left', '15px');
  await expect(button).toHaveCSS('border-top-left-radius', '10px');
  await expect(input).toHaveCSS('font-size', '15px');
  await expect(inputFrame).toHaveCSS('height', '38px');
  await expect(inputFrame).toHaveCSS('border-top-left-radius', '10px');
  await expect(preview.locator('hy-alert [part="icon"]')).toHaveCSS('background-color', 'rgb(55, 103, 73)');
  await expect(preview.locator('[data-design-token="--hy-space-4"]')).toHaveText('12px');
  await input.fill('保留预览内容');
  await preview.locator('hy-input').evaluate(element => element.style.setProperty('--hy-input-radius', '2px'));

  await design.getByRole('button', { name: '夜阑' }).click();
  await expect(design.getByRole('button', { name: '夜阑' })).toHaveAttribute('aria-pressed', 'true');
  await expect(preview).not.toHaveAttribute('data-design-skin');
  await expect(button).toHaveCSS('background-color', 'rgb(24, 26, 64)');
  await expect(button).toHaveCSS('font-size', '12px');
  await expect(button).toHaveCSS('padding-left', '10px');
  await expect(button).toHaveCSS('border-top-left-radius', '4px');
  await expect(inputFrame).toHaveCSS('height', '28px');
  await expect(inputFrame).toHaveCSS('border-top-left-radius', '2px');
  await expect(input).toHaveValue('保留预览内容');

  await design.getByRole('button', { name: '月白' }).click();
  await expect(button).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await design.getByRole('button', { name: '陶土' }).click();
  await expect(preview.locator('[data-design-token="--hy-accent-color"]')).toHaveText('#a44932');
  await expect(design.locator('#design-skin-source')).toContainText('--hy-radius-sm: 10px');
  await design.locator('details.code').first().locator('summary').click();
  await expect(design.locator('.cm-content').first()).toContainText('--hy-accent-color: #a44932');
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

test('Dropdown example renders a visible slotted trigger and opens its menu', async ({ page }) => {
  await page.goto('/examples/#dropdown');
  const dropdown = page.locator('#dropdown-live');
  const trigger = dropdown.locator('[slot="trigger"]');

  const triggerBox = await trigger.boundingBox();
  const dropdownBox = await dropdown.boundingBox();
  expect(triggerBox?.width).toBeGreaterThan(0);
  expect(triggerBox?.height).toBeGreaterThan(0);
  expect(dropdownBox?.width).toBeGreaterThan(0);
  expect(dropdownBox?.height).toBeGreaterThan(0);

  await trigger.click();
  await expect(dropdown).toHaveAttribute('open', '');
  await expect(dropdown.locator('.menu')).toBeVisible();
});
